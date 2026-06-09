#!/usr/bin/env python3
"""Inventory Domo federated / Cloud Amplifier integration metadata."""

from __future__ import annotations

import json
import sys
from pathlib import Path

VENV_SITE = Path.home() / ".local/pipx/venvs/community-domo-cli/lib/python3.14/site-packages"
sys.path.insert(0, str(VENV_SITE))

from community_domo_cli.config import resolve_config  # noqa: E402
from community_domo_cli.http import DomoApiError, DomoClient  # noqa: E402


def get_client() -> DomoClient:
    cfg = resolve_config(None, "databricks-demo")
    return DomoClient(
        instance=cfg.instance,
        auth_mode=cfg.auth_mode,
        developer_token=cfg.developer_token,
        refresh_token=cfg.refresh_token,
    )


def safe_get(client: DomoClient, path: str):
    try:
        return client.request("GET", path)
    except DomoApiError as err:
        return {"error": str(err), "status": err.status_code, "payload": err.payload}


def main() -> int:
    client = get_client()
    result: dict[str, object] = {}

    fed_types = safe_get(client, "/query/migration/federated/v1/to/v2/types")
    result["federated_types"] = fed_types
    if isinstance(fed_types, list):
        result["federated_accounts"] = {
            integration_type: safe_get(client, f"/query/migration/federated/v1/to/v2/accounts/{integration_type}")
            for integration_type in fed_types
        }

    for path in [
        "/query/migration/integration-types",
        "/query/migration/integrations/databricks",
        "/query/migration/integrations/DATABRICKS",
        "/query/migration/integrations/snowflake",
    ]:
        result[path] = safe_get(client, path)

    Path("domo-federated-cloud-inventory.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2)[:12000])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
