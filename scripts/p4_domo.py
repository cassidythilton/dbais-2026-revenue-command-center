#!/usr/bin/env python3
"""Shared Domo REST client for Pattern 4 workflow authoring.

Uses the community-domo-cli ryuu-session login (no secrets in this file).
"""
from __future__ import annotations

import json
import random
import string
import sys
from pathlib import Path

VENV_SITE = Path.home() / ".local/pipx/venvs/community-domo-cli/lib/python3.14/site-packages"
sys.path.insert(0, str(VENV_SITE))

from community_domo_cli.config import resolve_config  # noqa: E402
from community_domo_cli.http import DomoApiError, DomoClient  # noqa: E402

INSTANCE = "databricks-demo"


def client() -> DomoClient:
    cfg = resolve_config(None, INSTANCE)
    return DomoClient(
        instance=cfg.instance,
        auth_mode=cfg.auth_mode,
        developer_token=cfg.developer_token,
        refresh_token=cfg.refresh_token,
    )


def rid(n: int = 15) -> str:
    """Random alphanumeric id. Workflow/schema ids must START WITH A LETTER
    (the SchemaParameter validator rejects ids beginning with a digit)."""
    alphabet = string.ascii_letters + string.digits
    first = random.choice(string.ascii_letters)
    return first + "".join(random.choice(alphabet) for _ in range(n - 1))


def pretty(obj) -> str:
    return json.dumps(obj, indent=2, default=str)


__all__ = ["client", "rid", "pretty", "DomoApiError", "DomoClient"]
