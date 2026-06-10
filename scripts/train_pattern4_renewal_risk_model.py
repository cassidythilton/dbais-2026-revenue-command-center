#!/usr/bin/env python3
"""Train and register the Sprint 7 renewal-risk model.

The model is intentionally a classical sklearn pipeline wrapped in MLflow
pyfunc so Model Serving returns churn probability values for dataframe_records.
It uses the Databricks CLI profile for data access and MLflow auth; no tokens
are read from or written to this script.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import mlflow
import mlflow.sklearn
import numpy as np
import pandas as pd
from mlflow.models import infer_signature
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, average_precision_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


REPO = Path(__file__).resolve().parents[1]
CLI = str(Path.home() / "bin" / "databricks")
PROFILE = "pattern4"
WAREHOUSE_ID = "ea829ba58bcae093"
CATALOG = "databricks_raptor"
SCHEMA = "pattern4_agent_automation"
SOURCE_TABLE = f"{CATALOG}.{SCHEMA}.gold_customer_renewal_risk"
MODEL_NAME = f"{CATALOG}.{SCHEMA}.pattern4_renewal_risk"
EXPERIMENT = "/Users/cassidy.hilton@domo.com/pattern4-renewal-risk"
REPORT_PATH = REPO / "pattern-4-renewal-risk-model-report.json"

CATEGORICAL_FEATURES = ["segment", "region", "industry"]
NUMERIC_FEATURES = [
    "annual_recurring_revenue",
    "cases_90d",
    "sla_breaches_90d",
    "negative_cases_90d",
    "avg_usage_score_90d",
    "usage_drop_days_90d",
    "days_to_renewal",
]
FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES
TARGET_COLUMN = "predicted_churn_probability"


def databricks_api(method: str, path: str, body: dict | None = None) -> dict:
    cmd = [CLI, "api", method.lower(), path, "--profile", PROFILE]
    if body is not None:
        cmd += ["--json", json.dumps(body)]
    result = subprocess.run(cmd, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    if not result.stdout.strip():
        return {}
    return json.loads(result.stdout)


def execute_sql(statement: str) -> dict:
    payload = {
        "warehouse_id": WAREHOUSE_ID,
        "catalog": CATALOG,
        "schema": SCHEMA,
        "statement": statement,
        "wait_timeout": "50s",
        "on_wait_timeout": "CONTINUE",
    }
    response = databricks_api("post", "/api/2.0/sql/statements", payload)
    statement_id = response.get("statement_id")
    state = response.get("status", {}).get("state")
    while state in {"PENDING", "RUNNING"}:
        time.sleep(5)
        response = databricks_api("get", f"/api/2.0/sql/statements/{statement_id}")
        state = response.get("status", {}).get("state")
    if state != "SUCCEEDED":
        raise RuntimeError(f"SQL failed with state={state}: {response.get('status', {}).get('error')}")
    return response


def sql_to_frame(statement: str) -> pd.DataFrame:
    response = execute_sql(statement)
    columns = [
        c["name"]
        for c in response.get("manifest", {}).get("schema", {}).get("columns", [])
    ]
    rows = response.get("result", {}).get("data_array", []) or []
    frame = pd.DataFrame(rows, columns=columns)
    for col in NUMERIC_FEATURES + [TARGET_COLUMN]:
        frame[col] = pd.to_numeric(frame[col], errors="coerce")
    return frame


def build_pipeline() -> Pipeline:
    try:
        encoder = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    except TypeError:
        encoder = OneHotEncoder(handle_unknown="ignore", sparse=False)
    preprocessor = ColumnTransformer(
        transformers=[
            ("categorical", Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("onehot", encoder)]), CATEGORICAL_FEATURES),
            ("numeric", Pipeline([("imputer", SimpleImputer(strategy="median"))]), NUMERIC_FEATURES),
        ],
        remainder="drop",
    )
    classifier = HistGradientBoostingClassifier(
        max_iter=180,
        learning_rate=0.055,
        max_leaf_nodes=17,
        l2_regularization=0.06,
        random_state=42,
    )
    return Pipeline([("preprocess", preprocessor), ("classifier", classifier)])


def main() -> int:
    os.environ.setdefault("DATABRICKS_CONFIG_PROFILE", PROFILE)
    mlflow.set_tracking_uri(f"databricks://{PROFILE}")
    mlflow.set_registry_uri(f"databricks-uc://{PROFILE}")
    mlflow.set_experiment(EXPERIMENT)

    query = f"""
    SELECT
      segment,
      region,
      industry,
      annual_recurring_revenue,
      cases_90d,
      sla_breaches_90d,
      negative_cases_90d,
      avg_usage_score_90d,
      usage_drop_days_90d,
      days_to_renewal,
      predicted_churn_probability
    FROM {SOURCE_TABLE}
    WHERE predicted_churn_probability IS NOT NULL
    """
    data = sql_to_frame(query)
    if data.empty:
        raise RuntimeError(f"No rows returned from {SOURCE_TABLE}")

    threshold = 0.50
    y = (data[TARGET_COLUMN].astype(float) >= threshold).astype(int)
    if y.nunique() < 2:
        threshold = float(data[TARGET_COLUMN].quantile(0.72))
        y = (data[TARGET_COLUMN].astype(float) >= threshold).astype(int)
    if y.nunique() < 2:
        raise RuntimeError("Training target has one class after fallback thresholding")

    X = data[FEATURES].copy()
    for col in NUMERIC_FEATURES:
        X[col] = X[col].astype(float)
    stratify = y if y.value_counts().min() >= 2 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.25,
        random_state=42,
        stratify=stratify,
    )

    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)
    probabilities = pipeline.predict_proba(X_test)[:, 1]
    classes = (probabilities >= 0.5).astype(int)
    metrics = {
        "row_count": int(len(data)),
        "positive_rate": float(y.mean()),
        "target_threshold": float(threshold),
        "accuracy": float(accuracy_score(y_test, classes)),
        "roc_auc": float(roc_auc_score(y_test, probabilities)),
        "average_precision": float(average_precision_score(y_test, probabilities)),
    }

    input_example = X.head(5).copy()
    example_probabilities = pipeline.predict_proba(input_example)
    example_predictions = example_probabilities[:, 1]
    # The endpoint serves sklearn predict_proba, which returns [class_0, class_1].
    # Code Engine normalizes class_1 into the app's probability array.
    signature = infer_signature(input_example, example_probabilities)

    with mlflow.start_run(run_name="pattern4-renewal-risk-sprint7") as run:
        mlflow.log_params(
            {
                "source_table": SOURCE_TABLE,
                "target_column": TARGET_COLUMN,
                "target_threshold": threshold,
                "model_family": "sklearn_hist_gradient_boosting_classifier",
                "runtime_contract": "dataframe_records_named_columns",
                "pyfunc_predict_fn": "predict_proba",
            }
        )
        for key, value in metrics.items():
            mlflow.log_metric(key, value)

        conda_env = {
            "name": "mlflow-env",
            "channels": ["conda-forge"],
            "dependencies": [
                "python=3.11",
                "pip",
                {
                    "pip": [
                        f"mlflow=={mlflow.__version__}",
                        "scikit-learn==1.6.1",
                        "pandas==2.3.3",
                        "numpy==2.0.2",
                        "cloudpickle==3.1.2",
                    ]
                },
            ],
        }

        model_info = mlflow.sklearn.log_model(
            name="model",
            sk_model=pipeline,
            input_example=input_example,
            signature=signature,
            registered_model_name=MODEL_NAME,
            conda_env=conda_env,
            serialization_format="pickle",
            pyfunc_predict_fn="predict_proba",
            metadata={
                "source_table": SOURCE_TABLE,
                "features": ",".join(FEATURES),
                "target": TARGET_COLUMN,
                "positive_class_probability_index": "1",
            },
        )

        report = {
            "status": "registered",
            "registered_model_name": MODEL_NAME,
            "model_uri": model_info.model_uri,
            "run_id": run.info.run_id,
            "experiment": EXPERIMENT,
            "source_table": SOURCE_TABLE,
            "features": FEATURES,
            "target_column": TARGET_COLUMN,
            "metrics": metrics,
            "input_example": input_example.to_dict(orient="records"),
            "example_predictions": [float(x) for x in example_predictions],
            "serving_contract": {
                "request": {"dataframe_records": [input_example.iloc[0].to_dict()]},
                "response": {"predictions": [[float(example_probabilities[0][0]), float(example_probabilities[0][1])]]},
                "code_engine_normalized_response": {"predictions": [float(example_predictions[0])]},
            },
        }

    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({k: report[k] for k in ["status", "registered_model_name", "model_uri", "run_id"]}, indent=2))
    print(f"Wrote {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
