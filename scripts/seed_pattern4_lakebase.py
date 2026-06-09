#!/usr/bin/env python3
"""Seed Pattern 4 Lakebase tables from existing Unity Catalog gold views.

Creates public.p4_scenario_runs and public.p4_prediction_feedback in the
approved cobra-v1 Lakebase project if needed. Seeds only when each table is
empty so later demo edits are preserved.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import time
from pathlib import Path

import psycopg
import requests


REPO = Path(__file__).resolve().parents[1]
DATABRICKS_CLI = Path.home() / "bin" / "databricks"
PROFILE = "pattern4"
HOST = "https://dbc-0516e56c-ba3e.cloud.databricks.com"
WAREHOUSE_ID = "ea829ba58bcae093"
CATALOG = "databricks_raptor"
SCHEMA = "pattern4_agent_automation"
LAKEBASE_ENDPOINT = "projects/cobra-v1/branches/production/endpoints/primary"
LAKEBASE_HOST = "ep-fancy-mud-d2xv4rcd.database.us-east-1.cloud.databricks.com"
LAKEBASE_DB = "databricks_postgres"


def read_pat() -> str:
    token_file = REPO / "databricks token"
    match = re.search(r"(dapi[0-9a-f]+)", token_file.read_text())
    if not match:
        raise SystemExit("Could not find Databricks PAT in local token file")
    return match.group(1)


def cli_json(args: list[str]) -> dict:
    result = subprocess.run([str(DATABRICKS_CLI), *args], check=False, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return json.loads(result.stdout or "{}")


def current_user() -> str:
    return cli_json(["current-user", "me", "--profile", PROFILE, "-o", "json"])["userName"]


def db_token(pat: str) -> str:
    response = requests.post(
        f"{HOST}/api/2.0/postgres/credentials",
        headers={"Authorization": f"Bearer {pat}", "Content-Type": "application/json"},
        json={"endpoint": LAKEBASE_ENDPOINT},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["token"]


def run_sql(statement: str) -> list[dict]:
    payload = {
        "warehouse_id": WAREHOUSE_ID,
        "catalog": CATALOG,
        "schema": SCHEMA,
        "statement": statement,
        "wait_timeout": "30s",
        "on_wait_timeout": "CONTINUE",
    }
    response = cli_json(["api", "post", "/api/2.0/sql/statements", "--profile", PROFILE, "--json", json.dumps(payload)])
    statement_id = response.get("statement_id")
    state = response.get("status", {}).get("state")
    while state in {"PENDING", "RUNNING"}:
        time.sleep(2)
        response = cli_json(["api", "get", f"/api/2.0/sql/statements/{statement_id}", "--profile", PROFILE])
        state = response.get("status", {}).get("state")
    if state != "SUCCEEDED":
        raise RuntimeError(f"Databricks SQL failed: {response.get('status', {}).get('error')}")
    columns = [c["name"] for c in response.get("manifest", {}).get("schema", {}).get("columns", [])]
    data = response.get("result", {}).get("data_array", []) or []
    return [dict(zip(columns, row)) for row in data]


DDL = """
CREATE TABLE IF NOT EXISTS public.p4_scenario_runs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          text        NOT NULL,
  created_by    text        NOT NULL,
  status        text        NOT NULL DEFAULT 'draft',
  assumptions   jsonb       NOT NULL DEFAULT '{}',
  results       jsonb,
  baseline_id   bigint REFERENCES public.p4_scenario_runs(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS p4_scenario_runs_created_at_idx ON public.p4_scenario_runs (created_at DESC);

CREATE TABLE IF NOT EXISTS public.p4_prediction_feedback (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prediction_id   text        NOT NULL,
  entity_type     text        NOT NULL,
  entity_id       text        NOT NULL,
  feedback        text        NOT NULL,
  predicted_value numeric,
  corrected_value numeric,
  comment         text,
  created_by      text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS p4_prediction_feedback_entity_idx ON public.p4_prediction_feedback (entity_type, entity_id);
"""


def main() -> int:
    pat = read_pat()
    user = current_user()
    password = db_token(pat)

    regional = run_sql(
        """
        SELECT region,
               ROUND(SUM(revenue_at_risk), 2) AS revenue_at_risk,
               ROUND(AVG(renewal_risk_score), 2) AS avg_risk,
               COUNT(*) AS account_count
        FROM gold_customer_renewal_risk
        GROUP BY region
        ORDER BY revenue_at_risk DESC
        """
    )
    actions = run_sql(
        """
        SELECT approval_status,
               ROUND(SUM(expected_revenue_protected), 2) AS expected_protected,
               ROUND(SUM(actual_revenue_protected), 2) AS actual_protected
        FROM gold_agent_action_queue
        GROUP BY approval_status
        ORDER BY actual_protected DESC
        """
    )
    accounts = run_sql(
        """
        SELECT account_id, account_name, account_owner_id,
               predicted_churn_probability, revenue_at_risk, recommended_action
        FROM gold_customer_renewal_risk
        ORDER BY revenue_at_risk DESC
        LIMIT 6
        """
    )

    west = next((r for r in regional if r.get("region") == "West"), regional[0] if regional else {})
    protected = sum(float(a.get("actual_protected") or 0) for a in actions)
    expected = sum(float(a.get("expected_protected") or 0) for a in actions)
    exposure = float(west.get("revenue_at_risk") or 0)

    scenarios = [
        (
            "West save play — aggressive",
            "complete",
            "exec.sponsor@domo.com",
            {"region": "West", "source": "gold_customer_renewal_risk", "intervention": "executive_outreach_and_reliability_credit"},
            {"forecast_delta": round(min(protected, exposure), 2), "protected_revenue": round(protected, 2), "avg_risk": west.get("avg_risk")},
        ),
        (
            "Baseline forecast Q3",
            "complete",
            "exec.sponsor@domo.com",
            {"region": "All", "source": "gold_executive_revenue_health", "intervention": "baseline"},
            {"forecast_delta": 0, "expected_protected": round(expected, 2)},
        ),
        (
            "Reliability credits only",
            "running",
            "west.manager@domo.com",
            {"region": "West", "source": "gold_agent_action_queue", "intervention": "reliability_credit_review"},
            {"forecast_delta": round(protected * 0.35, 2), "protected_revenue": round(protected * 0.35, 2)},
        ),
        (
            "No-intervention downside",
            "archived",
            "west.manager@domo.com",
            {"region": "West", "source": "gold_customer_renewal_risk", "intervention": "none"},
            {"forecast_delta": round(-exposure * 0.18, 2), "revenue_at_risk": round(exposure, 2)},
        ),
    ]

    conn = psycopg.connect(
        host=LAKEBASE_HOST,
        port=5432,
        dbname=LAKEBASE_DB,
        user=user,
        password=password,
        sslmode="require",
        connect_timeout=20,
    )
    with conn:
        with conn.cursor() as cur:
            for statement in [s.strip() for s in DDL.split(";") if s.strip()]:
                cur.execute(statement)

            cur.execute("SELECT COUNT(*) FROM public.p4_scenario_runs")
            scenario_count = cur.fetchone()[0]
            if scenario_count == 0:
                cur.executemany(
                    """
                    INSERT INTO public.p4_scenario_runs (name, status, created_by, assumptions, results)
                    VALUES (%s, %s, %s, %s::jsonb, %s::jsonb)
                    """,
                    [(n, s, by, json.dumps(a), json.dumps(r)) for n, s, by, a, r in scenarios],
                )

            cur.execute("SELECT COUNT(*) FROM public.p4_prediction_feedback")
            feedback_count = cur.fetchone()[0]
            if feedback_count == 0:
                cur.executemany(
                    """
                    INSERT INTO public.p4_prediction_feedback
                      (prediction_id, entity_type, entity_id, feedback, predicted_value, corrected_value, comment, created_by)
                    VALUES (%s, 'account', %s, %s, %s, NULL, %s, %s)
                    """,
                    [
                        (
                            f"seed-{row['account_id']}",
                            row["account_name"],
                            "accept" if idx % 2 == 0 else "adjust",
                            float(row.get("predicted_churn_probability") or 0),
                            f"Seeded from {row.get('recommended_action') or 'recommended action'}; source gold_customer_renewal_risk.",
                            row.get("account_owner_id") or "demo.user@domo.com",
                        )
                        for idx, row in enumerate(accounts)
                    ],
                )

    print(json.dumps({"scenario_rows_preexisting": scenario_count, "feedback_rows_preexisting": feedback_count}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
