#!/usr/bin/env python3
"""Inspect + (optionally) execute released Code Engine functions via product API."""

from __future__ import annotations

import json
import sys
from pathlib import Path

VENV_SITE = Path.home() / ".local/pipx/venvs/community-domo-cli/lib/python3.14/site-packages"
sys.path.insert(0, str(VENV_SITE))

from community_domo_cli.config import resolve_config  # noqa: E402
from community_domo_cli.http import DomoApiError, DomoClient  # noqa: E402

PROXY = "45a89bf2-150e-42a0-83a9-3d911c928712"
WRITEBACK = "888c73e7-7959-4169-a266-0e4ab72a6ff4"


def client() -> DomoClient:
    cfg = resolve_config(None, "databricks-demo")
    return DomoClient(
        instance=cfg.instance,
        auth_mode=cfg.auth_mode,
        developer_token=cfg.developer_token,
        refresh_token=cfg.refresh_token,
    )


def show(c: DomoClient, pkg_id: str) -> dict:
    print(f"\n## GET package {pkg_id}")
    for path in (
        f"/api/codeengine/v2/packages/{pkg_id}",
        f"/codeengine/v2/packages/{pkg_id}",
    ):
        try:
            data = c.request("GET", path)
            print(f"(via {path})")
            print(json.dumps(data, indent=2)[:5000])
            return data
        except DomoApiError as err:
            print(f"  {path} -> {err.status_code}: {str(err)[:200]}")
    return {}


def version_detail(c: DomoClient, pkg_id: str, version: str) -> None:
    print(f"\n## version detail {pkg_id} v{version}")
    for path in (
        f"/codeengine/v2/packages/{pkg_id}/versions/{version}",
        f"/codeengine/v2/packages/{pkg_id}/versions/{version}/functions",
    ):
        try:
            data = c.request("GET", path)
            print(f"(via {path})")
            print(json.dumps(data, indent=2)[:4000])
        except DomoApiError as err:
            print(f"  {path} -> {err.status_code}: {str(err)[:200]}")


def list_packages(c: DomoClient) -> None:
    print("\n## list packages (control)")
    for path in (
        "/codeengine/v2/packages",
        "/codeengine/v2/packages?limit=50",
    ):
        try:
            data = c.request("GET", path)
            items = data if isinstance(data, list) else data.get("packages", data)
            print(f"(via {path}) count={len(items) if hasattr(items,'__len__') else 'n/a'}")
            if isinstance(items, list):
                for p in items[:30]:
                    print("  -", p.get("id"), "|", p.get("name"), "| src:", p.get("packageSource"))
            return
        except DomoApiError as err:
            print(f"  {path} -> {err.status_code}: {str(err)[:200]}")


def main() -> int:
    c = client()
    show(c, PROXY)
    show(c, WRITEBACK)
    version_detail(c, PROXY, "1.0.0")
    version_detail(c, WRITEBACK, "1.0.0")
    list_packages(c)
    # control: known-good packages
    for ctrl in ("fbd267b4-fbb0-4981-bbf4-c0e96c6cacf8", "ee31e7f6-0e6f-4258-8553-b6c03c1e0ff2"):
        d = show(c, ctrl)
        for v in d.get("versions", []):
            version_detail(c, ctrl, v.get("version"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
