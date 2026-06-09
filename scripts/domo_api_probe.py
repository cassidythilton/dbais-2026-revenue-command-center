#!/usr/bin/env python3
"""Small read-only Domo API probe using community-domo-cli auth helpers."""

from __future__ import annotations

import json
import sys
from pathlib import Path

VENV_SITE = Path.home() / ".local/pipx/venvs/community-domo-cli/lib/python3.14/site-packages"
sys.path.insert(0, str(VENV_SITE))

from community_domo_cli.config import resolve_config  # noqa: E402
from community_domo_cli.http import DomoApiError, DomoClient  # noqa: E402


def client() -> DomoClient:
    cfg = resolve_config(None, "databricks-demo")
    return DomoClient(
        instance=cfg.instance,
        auth_mode=cfg.auth_mode,
        developer_token=cfg.developer_token,
        refresh_token=cfg.refresh_token,
    )


def main() -> int:
    c = client()
    probes = [
        ("GET", "/data/v3/datasources", {"cloudId": "a83b5bbc-fc3f-43c0-8ea5-f15117de997d", "limit": 20}),
        ("GET", "/data/v3/datasources", {"cloudId": "9880e0a1-be2e-4ca5-9fcd-04f4141a4a5c", "limit": 20}),
        ("POST", "/data/ui/v3/datasources/search", None),
        ("GET", "/data/v1/clouds", None),
        ("GET", "/data/v2/clouds", None),
        ("GET", "/data/v3/clouds", None),
    ]
    search_body = {
        "filters": [
            {
                "field": "name",
                "operator": "CONTAINS",
                "value": "gold_",
            }
        ],
        "count": 50,
        "offset": 0,
    }

    for method, path, params in probes:
        print(f"\n## {method} {path}")
        try:
            body = search_body if method == "POST" else None
            data = c.request(method, path, params=params, json_body=body)
            print(json.dumps(data, indent=2)[:6000])
        except DomoApiError as err:
            print(json.dumps({"error": str(err), "status": err.status_code, "payload": err.payload}, indent=2)[:3000])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
