#!/usr/bin/env python3
"""Create + release pattern4ce v1.0.20.

STAGED — do NOT run without the user's explicit "release" approval.

v1.0.20: getUcReadinessState now returns, per column, both the TRUE business
synonyms (parsed from the domo_ai_synonyms / domo_ai_synonym tag, for the inspector
edit round-trip) and a new `domoSynonyms` list — a 1:1, Domo-friendly copy of the
column's Unity Catalog tags (true synonyms as bare terms + every substantive
governance tag as "key: value", with housekeeping tags domo_ai_ready /
domo_ai_updated_by excluded). The app forwards domoSynonyms as the Domo AI Readiness
synonyms on Sync, so UC tags replicate into Domo. No signature change → no manifest /
alias change → no App Studio card re-instantiation. Built from the FULL consolidated
functions.js via the single-source build in create_pattern4ce.py.
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
VERSION = "1.0.20"
DESCRIPTION = (
    "Consolidated Pattern 4 CE package. v1.0.20: getUcReadinessState returns true synonyms "
    "(inspector round-trip) plus domoSynonyms — a 1:1 Domo-friendly copy of each column's UC tags "
    "(governance tags as 'key: value', housekeeping excluded) that the app syncs into Domo AI "
    "Readiness synonyms. No signature changes."
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
    print(f"function count: {len(functions)} | getUcReadinessState present: {'getUcReadinessState' in names}")

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
