#!/usr/bin/env python3
"""Create (or version) the consolidated `pattern4ce` Code Engine package.

Reads the Databricks token at runtime from the local `databricks token` file and
injects it into the function code before POSTing. The token is never written back
to disk. Does NOT release (release requires explicit user approval).
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
VENV_SITE = Path.home() / ".local/pipx/venvs/community-domo-cli/lib/python3.14/site-packages"
sys.path.insert(0, str(VENV_SITE))

from community_domo_cli.config import resolve_config  # noqa: E402
from community_domo_cli.http import DomoApiError, DomoClient  # noqa: E402

FUNCTIONS_JS = REPO / "pattern4-agent-portal/codeengine/functions.js"
TOKEN_FILE = REPO / "databricks token"
LAKEBASE_BUNDLE_FILE = REPO / "scripts/lakebase_pg_bundle.b64"


def read_lakebase_bundle() -> str:
    if not LAKEBASE_BUNDLE_FILE.exists():
        raise SystemExit(f"Missing Lakebase pg bundle: {LAKEBASE_BUNDLE_FILE}")
    return LAKEBASE_BUNDLE_FILE.read_text().strip()


def read_token() -> str:
    text = TOKEN_FILE.read_text()
    m = re.search(r"(dapi[0-9a-f]+)", text)
    if not m:
        raise SystemExit("Could not find a dapi... token in 'databricks token'")
    return m.group(1)


def read_domo_token() -> str:
    text = TOKEN_FILE.read_text()
    m = re.search(r"domo access token:\s*([A-Za-z0-9]+)", text, re.IGNORECASE)
    if not m:
        raise SystemExit("Could not find a Domo access token in 'databricks token'")
    return m.group(1)


def text_input(name: str, nullable: bool) -> dict:
    return {
        "name": name,
        "displayName": name,
        "type": "text",
        "value": None,
        "nullable": nullable,
        "isList": False,
        "children": None,
        "entitySubType": None,
    }


def number_input(name: str, nullable: bool) -> dict:
    return {
        "name": name,
        "displayName": name,
        "type": "number",
        "value": None,
        "nullable": nullable,
        "isList": False,
        "children": None,
        "entitySubType": None,
    }


def object_input(name: str, nullable: bool) -> dict:
    return {
        "name": name,
        "displayName": name,
        "type": "object",
        "value": None,
        "nullable": nullable,
        "isList": False,
        "children": None,
        "entitySubType": None,
    }


def object_list_input(name: str, nullable: bool) -> dict:
    return {
        "name": name,
        "displayName": name,
        "type": "object",
        "value": None,
        "nullable": nullable,
        "isList": True,
        "children": None,
        "entitySubType": None,
    }


def account_input(name: str, nullable: bool) -> dict:
    return {
        "name": name,
        "displayName": name,
        "type": "account",
        "value": None,
        "nullable": nullable,
        "isList": False,
        "children": None,
        "entitySubType": None,
    }


def result_output() -> dict:
    return {
        "name": "result",
        "displayName": "result",
        "type": "object",
        "value": None,
        "nullable": False,
        "isList": False,
        "children": None,
        "entitySubType": None,
    }


def fn(name: str, display: str, inputs: list, private: bool = False) -> dict:
    return {
        "name": name,
        "displayName": display,
        "description": "",
        "isPrivate": private,
        "inputs": inputs,
        "output": result_output(),
    }


def client() -> DomoClient:
    cfg = resolve_config(None, "databricks-demo")
    return DomoClient(
        instance=cfg.instance,
        auth_mode=cfg.auth_mode,
        developer_token=cfg.developer_token,
        refresh_token=cfg.refresh_token,
    )


def build_code() -> str:
    """Read the FULL consolidated functions.js and inject secrets (never persisted)."""
    token = read_token()
    domo_token = read_domo_token()
    lakebase_bundle = read_lakebase_bundle()
    code = (
        FUNCTIONS_JS.read_text()
        .replace("REPLACE_WITH_DATABRICKS_TOKEN", token)
        .replace("REPLACE_WITH_DOMO_DEVELOPER_TOKEN", domo_token)
        .replace("__LAKEBASE_PG_BUNDLE_B64__", lakebase_bundle)
    )
    for placeholder in (
        "__LAKEBASE_PG_BUNDLE_B64__",
        "REPLACE_WITH_DATABRICKS_TOKEN",
        "REPLACE_WITH_DOMO_DEVELOPER_TOKEN",
    ):
        if placeholder in code:
            raise SystemExit(f"Placeholder injection failed: {placeholder}")
    return code


def build_functions() -> list:
    """Single source of truth for the pattern4ce function manifest (all 18)."""
    functions = [
        fn(
            "askGenie",
            "Ask Pattern 4 Genie",
            [
                text_input("question", False),
                text_input("conversationId", True),
                text_input("persona", True),
                text_input("model", True),
            ],
        ),
        fn(
            "writeActionStatus",
            "Write Action Status",
            [
                text_input("actionId", False),
                text_input("decision", True),
                text_input("executionStatus", True),
                text_input("approvedBy", True),
                text_input("note", True),
                text_input("persona", True),
            ],
        ),
        fn(
            "askReasoningModel",
            "Ask Reasoning Model (AI Gateway)",
            [
                text_input("prompt", False),
                text_input("persona", True),
            ],
        ),
        fn(
            "askRetentionAgent",
            "Ask Retention Supervisor Agent (Databricks MAS)",
            [
                text_input("prompt", False),
            ],
        ),
        fn(
            "listApprovalTasks",
            "List Approval Tasks",
            [
                number_input("limit", True),
            ],
        ),
        fn(
            "completeApprovalTask",
            "Complete Approval Task",
            [
                text_input("taskId", False),
                text_input("decision", True),
                text_input("version", True),
            ],
        ),
        fn(
            "startRetentionWorkflow",
            "Start Retention Workflow",
            [
                text_input("actionId", False),
                text_input("account", True),
                text_input("recommendation", True),
                text_input("persona", True),
                number_input("predicted", True),
                number_input("protectedRevenue", True),
                text_input("sourceQuestion", True),
            ],
        ),
        fn(
            "getRetentionWorkflowResult",
            "Get Retention Workflow Result",
            [
                text_input("instanceId", True),
                text_input("actionId", False),
            ],
        ),
        fn("listScenarios", "List Lakebase Scenarios", []),
        fn(
            "createScenario",
            "Create Lakebase Scenario",
            [
                text_input("name", False),
                text_input("status", True),
                text_input("createdBy", True),
                object_input("assumptions", True),
                object_input("results", True),
            ],
        ),
        fn(
            "updateScenario",
            "Update Lakebase Scenario",
            [
                number_input("id", False),
                text_input("name", False),
                text_input("status", True),
                text_input("createdBy", True),
                object_input("assumptions", True),
                object_input("results", True),
            ],
        ),
        fn("deleteScenario", "Delete Lakebase Scenario", [number_input("id", False)]),
        fn("listPredictionFeedback", "List Prediction Feedback", []),
        fn(
            "savePredictionFeedback",
            "Save Prediction Feedback",
            [
                text_input("predictionId", False),
                text_input("entityType", False),
                text_input("entityId", False),
                text_input("feedback", False),
                number_input("predictedValue", True),
                number_input("correctedValue", True),
                text_input("comment", True),
                text_input("createdBy", True),
            ],
        ),
        fn(
            "runModelInference",
            "Run Renewal-Risk Model Inference",
            [
                object_list_input("records", False),
            ],
        ),
        fn("getUcReadinessState", "Get UC Readiness State", [text_input("tableName", False)]),
        fn("getDomoAiReadiness", "Get Domo AI Readiness", [text_input("datasetId", False)]),
        fn(
            "syncDomoAiReadiness",
            "Sync Domo AI Readiness",
            [
                text_input("datasetId", False),
                object_input("desiredState", False),
                object_list_input("columns", True),
            ],
        ),
        fn(
            "wipeDomoAiReadiness",
            "Wipe Domo AI Readiness",
            [
                text_input("datasetId", False),
                object_list_input("columns", True),
            ],
        ),
        fn(
            "updateUcColumnContext",
            "Update UC Column Context",
            [
                text_input("tableName", False),
                text_input("columnName", False),
                text_input("context", True),
                object_list_input("synonyms", True),
                text_input("aiEnabled", True),
                text_input("updatedBy", True),
            ],
        ),
        fn("runSql", "Run SQL", [text_input("statement", False)], private=True),
        fn("sqlString", "SQL String", [text_input("value", False)], private=True),
        fn("lakebaseQuery", "Lakebase Query", [text_input("sql", False), text_input("params", True)], private=True),
    ]
    return functions


def main() -> int:
    code = build_code()
    functions = build_functions()
    payload = {
        "name": "pattern4ce",
        "description": "Consolidated Pattern 4 Code Engine package: Genie proxy + Databricks action writeback. proxyId for the Pattern 4 Agent Portal.",
        "code": code,
        "environment": "LAMBDA",
        "language": "JAVASCRIPT",
        "manifest": {
            "functions": functions,
            "configuration": {"accountsMapping": [], "mlModel": [], "externalPackageMapping": {}},
        },
    }

    c = client()
    for path in ("/codeengine/v2/packages", "/api/codeengine/v2/packages"):
        try:
            resp = c.request("POST", path, json_body=payload)
            print(f"CREATED via {path}")
            # avoid printing code/token back
            slim = {k: v for k, v in (resp or {}).items() if k != "code"}
            print(json.dumps(slim, indent=2)[:2000])
            return 0
        except DomoApiError as err:
            print(f"  {err.status_code} POST {path}: {json.dumps(err.payload)[:300]}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
