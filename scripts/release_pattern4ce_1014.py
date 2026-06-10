#!/usr/bin/env python3
"""Create + release pattern4ce v1.0.14.

Same payload as 1.0.13 except `listScenarios` and `listPredictionFeedback` gain a
required-for-routing optional `limit` parameter. Domo does not register a Code Engine
proxy route for zero-parameter functions (they 404 from the app proxy), so the two
no-arg readers need at least one declared parameter. User explicitly approved release.
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
import release_pattern4ce_1013 as r13  # noqa: E402  reuse build_code/build_functions
from community_domo_cli.http import DomoApiError  # noqa: E402

PKG = "36a18258-0fb7-407a-b268-4a326c5b73c3"
VERSION = "1.0.14"


def build_functions() -> list:
    fns = r13.build_functions()
    for f in fns:
        if f["name"] in ("listScenarios", "listPredictionFeedback"):
            f["inputs"] = [cp.number_input("limit", True)]
    return fns


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
        "description": "Consolidated Pattern 4 CE package. v1.0.14: listScenarios/listPredictionFeedback gain an optional `limit` param so Domo registers their app-proxy route (zero-param functions 404).",
        "code": r13.build_code(),
        "environment": "LAMBDA",
        "language": "JAVASCRIPT",
        "manifest": {
            "functions": build_functions(),
            "configuration": {"accountsMapping": [], "mlModel": [], "externalPackageMapping": {}},
        },
    }

    c = cp.client()

    created = False
    for path in ("/codeengine/v2/packages", "/api/codeengine/v2/packages"):
        try:
            resp = c.request("POST", path, json_body=payload)
            slim = {k: v for k, v in (resp or {}).items() if k != "code"}
            print(f"CREATED {VERSION} via {path}: {json.dumps(slim)[:400]}")
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

    print("released-after:", version_released(c, VERSION))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
