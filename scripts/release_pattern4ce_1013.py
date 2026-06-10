#!/usr/bin/env python3
"""Create + release pattern4ce v1.0.13 (all functions incl. workflow + Lakebase).

Reuses build helpers from create_pattern4ce.py so the function/secret contract stays
identical to prior releases. Creates a new VERSION on the existing package id, then
releases it (user explicitly approved release of 1.0.13).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
VENV_SITE = Path.home() / ".local/pipx/venvs/community-domo-cli/lib/python3.14/site-packages"
sys.path.insert(0, str(VENV_SITE))
sys.path.insert(0, str(REPO / "scripts"))

import create_pattern4ce as cp  # noqa: E402  reuse fn/input/secret helpers
from community_domo_cli.http import DomoApiError  # noqa: E402

PKG = "36a18258-0fb7-407a-b268-4a326c5b73c3"
VERSION = "1.0.13"


def build_functions() -> list:
    f, t, n, o, ol = (
        cp.fn,
        cp.text_input,
        cp.number_input,
        cp.object_input,
        cp.object_list_input,
    )
    return [
        f("askGenie", "Ask Pattern 4 Genie", [t("question", False), t("conversationId", True), t("persona", True), t("model", True)]),
        f("writeActionStatus", "Write Action Status", [t("actionId", False), t("decision", True), t("executionStatus", True), t("approvedBy", True), t("note", True), t("persona", True)]),
        f("askReasoningModel", "Ask Reasoning Model (AI Gateway)", [t("prompt", False), t("persona", True)]),
        f("startRetentionWorkflow", "Start Retention Workflow", [t("actionId", False), t("account", True), t("recommendation", True), t("persona", True), n("predicted", True), n("protectedRevenue", True), t("sourceQuestion", True)]),
        f("getRetentionWorkflowResult", "Get Retention Workflow Result", [t("instanceId", True), t("actionId", False)]),
        f("listScenarios", "List Lakebase Scenarios", []),
        f("createScenario", "Create Lakebase Scenario", [t("name", False), t("status", True), t("createdBy", True), o("assumptions", True), o("results", True)]),
        f("updateScenario", "Update Lakebase Scenario", [n("id", False), t("name", False), t("status", True), t("createdBy", True), o("assumptions", True), o("results", True)]),
        f("deleteScenario", "Delete Lakebase Scenario", [n("id", False)]),
        f("listPredictionFeedback", "List Prediction Feedback", []),
        f("savePredictionFeedback", "Save Prediction Feedback", [t("predictionId", False), t("entityType", False), t("entityId", False), t("feedback", False), n("predictedValue", True), n("correctedValue", True), t("comment", True), t("createdBy", True)]),
        f("runModelInference", "Run Renewal-Risk Model Inference", [ol("records", False)]),
        f("getUcReadinessState", "Get UC Readiness State", [t("tableName", False)]),
        f("getDomoAiReadiness", "Get Domo AI Readiness", [t("datasetId", False)]),
        f("syncDomoAiReadiness", "Sync Domo AI Readiness", [t("datasetId", False), o("desiredState", False), ol("columns", True)]),
        f("wipeDomoAiReadiness", "Wipe Domo AI Readiness", [t("datasetId", False), ol("columns", True)]),
        f("updateUcColumnContext", "Update UC Column Context", [t("tableName", False), t("columnName", False), t("context", True), ol("synonyms", True), t("aiEnabled", True), t("updatedBy", True)]),
        f("runSql", "Run SQL", [t("statement", False)], private=True),
        f("sqlString", "SQL String", [t("value", False)], private=True),
        f("lakebaseQuery", "Lakebase Query", [t("sql", False), t("params", True)], private=True),
    ]


def build_code() -> str:
    token = cp.read_token()
    domo_token = cp.read_domo_token()
    bundle = cp.read_lakebase_bundle()
    code = (
        cp.FUNCTIONS_JS.read_text()
        .replace("REPLACE_WITH_DATABRICKS_TOKEN", token)
        .replace("REPLACE_WITH_DOMO_DEVELOPER_TOKEN", domo_token)
        .replace("__LAKEBASE_PG_BUNDLE_B64__", bundle)
    )
    for placeholder in ("__LAKEBASE_PG_BUNDLE_B64__", "REPLACE_WITH_DATABRICKS_TOKEN", "REPLACE_WITH_DOMO_DEVELOPER_TOKEN"):
        if placeholder in code:
            raise SystemExit(f"Placeholder injection failed: {placeholder}")
    return code


def version_released(c, version: str):
    d = c.request("GET", f"/codeengine/v2/packages/{PKG}")
    for v in d.get("versions", []):
        if v.get("version") == version:
            return v.get("released")
    return "MISSING"


def main() -> int:
    payload = {
        "id": PKG,
        "version": VERSION,
        "name": "pattern4ce",
        "description": "Consolidated Pattern 4 CE package. v1.0.13: adds AI-Gateway reasoning + retention-workflow functions (askReasoningModel, startRetentionWorkflow, getRetentionWorkflowResult) alongside the existing Genie, Lakebase, ML inference, and AI Readiness functions so the app manifest binds cleanly.",
        "code": build_code(),
        "environment": "LAMBDA",
        "language": "JAVASCRIPT",
        "manifest": {
            "functions": build_functions(),
            "configuration": {"accountsMapping": [], "mlModel": [], "externalPackageMapping": {}},
        },
    }

    c = cp.client()

    # 1) Create version 1.0.13
    created = False
    for path in ("/codeengine/v2/packages", "/api/codeengine/v2/packages"):
        try:
            resp = c.request("POST", path, json_body=payload)
            slim = {k: v for k, v in (resp or {}).items() if k != "code"}
            print(f"CREATED {VERSION} via {path}: {json.dumps(slim)[:600]}")
            created = True
            break
        except DomoApiError as err:
            print(f"  create {err.status_code} POST {path}: {json.dumps(err.payload)[:300]}")
    if not created:
        return 1

    print("released-before:", version_released(c, VERSION))

    # 2) Release version 1.0.13 (user explicitly approved release)
    released = False
    attempts = [
        ("POST", f"/codeengine/v2/packages/{PKG}/versions/{VERSION}/release", None),
        ("POST", f"/api/codeengine/v2/packages/{PKG}/versions/{VERSION}/release", None),
        ("PUT", f"/codeengine/v2/packages/{PKG}/versions/{VERSION}/release", None),
        ("POST", f"/codeengine/v2/packages/{PKG}/versions/{VERSION}/releases", None),
    ]
    for method, path, body in attempts:
        try:
            r = c.request(method, path, json_body=body) if body is not None else c.request(method, path)
            print(f"RELEASE ok via {method} {path}: {json.dumps(r)[:300] if r else '(empty)'}")
            released = True
            break
        except DomoApiError as err:
            print(f"  release {err.status_code} {method} {path}: {json.dumps(err.payload)[:200]}")

    after = version_released(c, VERSION)
    print("released-after:", after)
    if not released and (after in (None, "MISSING")):
        print("WARN: release endpoint not confirmed; inspect manually.")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
