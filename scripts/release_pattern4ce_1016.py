#!/usr/bin/env python3
"""Create + release pattern4ce v1.0.16.

Adds `askRetentionAgent` (Domo AI agent tile -> Databricks Agent Bricks
Supervisor Agent / MAS) on top of v1.0.14. Built from the FULL consolidated
functions.js + the single-source function manifest in create_pattern4ce.py
(never partially overwrite the shared package). User explicitly approved release.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
VENV_SITE = Path.home() / ".local/pipx/venvs/community-domo-cli/lib/python3.14/site-packages"
sys.path.insert(0, str(VENV_SITE))
sys.path.insert(0, str(REPO / "scripts"))

import create_pattern4ce as cp  # noqa: E402
from community_domo_cli.http import DomoApiError  # noqa: E402

PKG = "36a18258-0fb7-407a-b268-4a326c5b73c3"
VERSION = "1.0.16"
DESCRIPTION = (
    "Consolidated Pattern 4 CE package. v1.0.16: bound askRetentionAgent (cap the "
    "Genie-backed MAS ~48s with a fast Unity AI Gateway-guardrailed fallback so the "
    "Domo AI agent tile never hangs) + listApprovalTasks/completeApprovalTask for in-app "
    "workflow task approval. All prior functions unchanged."
)


def version_released(c, version: str):
    d = c.request("GET", f"/codeengine/v2/packages/{PKG}")
    for v in d.get("versions", []):
        if v.get("version") == version:
            return v.get("released")
    return "MISSING"


def main() -> int:
    functions = cp.build_functions()
    names = sorted(f["name"] for f in functions)
    print(f"function count: {len(functions)} | askRetentionAgent present: {'askRetentionAgent' in names}")

    payload = {
        "id": PKG,
        "version": VERSION,
        "name": "pattern4ce",
        "description": DESCRIPTION,
        "code": cp.build_code(),
        "environment": "LAMBDA",
        "language": "JAVASCRIPT",
        "manifest": {
            "functions": functions,
            "configuration": {"accountsMapping": [], "mlModel": [], "externalPackageMapping": {}},
        },
    }

    c = cp.client()

    created = False
    for path in ("/codeengine/v2/packages", "/api/codeengine/v2/packages"):
        try:
            resp = c.request("POST", path, json_body=payload)
            slim = {k: v for k, v in (resp or {}).items() if k != "code"}
            print(f"CREATED {VERSION} via {path}: {json.dumps(slim)[:300]}")
            created = True
            break
        except DomoApiError as err:
            print(f"  create {err.status_code} POST {path}: {json.dumps(err.payload)[:300]}")
    if not created:
        return 1

    try:
        r = c.request("POST", f"/codeengine/v2/packages/{PKG}/versions/{VERSION}/release")
        print(f"RELEASE ok: {json.dumps(r)[:200] if r else '(empty)'}")
    except DomoApiError as err:
        print(f"  release {err.status_code}: {json.dumps(err.payload)[:200]}")
        return 1

    print("released-after:", version_released(c, VERSION))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
