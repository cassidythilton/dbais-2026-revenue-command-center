#!/usr/bin/env python3
"""Add an app icon + description to the Pattern 4 App Studio app.

Generates a co-branded 256x256 icon (Domo-blue tile + the real Databricks
lakehouse mark on a white panel), uploads it to the Domo Data File Service,
then sets title/description/iconDataFileId/navIconDataFileId on the app.
"""

from __future__ import annotations

import io
import json
import struct
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VENV_SITE = Path.home() / ".local/pipx/venvs/community-domo-cli/lib/python3.14/site-packages"
sys.path.insert(0, str(VENV_SITE))

import httpx  # noqa: E402
from community_domo_cli.config import resolve_config  # noqa: E402
from community_domo_cli.http import DomoClient  # noqa: E402

APP_ID = "105910661"
ICON_PATH = ROOT / "pattern4-agent-portal" / "public" / "app-icon.png"
DBX_LOGO = ROOT / "pattern4-agent-portal" / "public" / "databricks-logo.png"

DESCRIPTION = (
    "Pattern 4 agent-to-agent automation — a governed Databricks + Domo revenue "
    "command center. Domo dashboards and Databricks Genie read live from Unity "
    "Catalog gold views via the Cloud Amplifier (no copies); Agent Catalyst executes "
    "approved retention actions with human sign-off. Includes a built-in How It Works "
    "architecture and user guide."
)


def build_icon() -> bytes:
    """Return PNG bytes for a 256x256 co-branded app icon. Prefer Pillow; fall back to pure PNG."""
    size = 256
    try:
        from PIL import Image, ImageDraw  # type: ignore

        tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(tile)
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=56, fill=(153, 204, 238, 255))  # Domo blue
        pad = 30
        d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=38, fill=(255, 255, 255, 255))
        if DBX_LOGO.exists():
            logo = Image.open(DBX_LOGO).convert("RGBA").resize((128, 128), Image.LANCZOS)
            tile.alpha_composite(logo, ((size - 128) // 2, (size - 128) // 2 - 8))
        # Domo accents: blue underline + orange dot
        d.rounded_rectangle([size // 2 - 34, size - 64, size // 2 + 22, size - 58], radius=3, fill=(74, 144, 194, 255))
        d.ellipse([size // 2 + 28, size - 66, size // 2 + 40, size - 54], fill=(255, 153, 34, 255))
        buf = io.BytesIO()
        tile.save(buf, format="PNG")
        return buf.getvalue()
    except Exception:
        return _pure_icon(size)


def _pure_icon(size: int) -> bytes:
    domo = (153, 204, 238, 255)
    white = (255, 255, 255, 255)
    red = (255, 54, 33, 255)
    blue = (74, 144, 194, 255)
    orange = (255, 153, 34, 255)
    clear = (0, 0, 0, 0)
    radius = 56
    inner = 30

    def rounded(x, y, x0, y0, x1, y1, r):
        if x < x0 or x > x1 or y < y0 or y > y1:
            return False
        cs = [(x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)]
        for (cxr, cyr) in cs:
            inx = x < x0 + r if cxr == x0 + r else x > x1 - r
            iny = y < y0 + r if cyr == y0 + r else y > y1 - r
            if inx and iny and (x - cxr) ** 2 + (y - cyr) ** 2 > r * r:
                return False
        return True

    def chevron(x, y):
        # three stacked red chevrons centered ~128,118
        for k, oy in enumerate((-34, 0, 34)):
            cy = 118 + oy
            dx = abs(x - 128)
            if dx < 64 and 0 <= (y - cy) - dx * 0.0 < 0:
                pass
        return False

    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            px = clear
            if rounded(x, y, 0, 0, size - 1, size - 1, radius):
                px = domo
                if rounded(x, y, inner, inner, size - inner, size - inner, 38):
                    px = white
                    # red stacked chevrons
                    for oy in (-36, 0, 36):
                        cy = 112 + oy
                        dx = abs(x - 128)
                        top = cy - 20 + dx * 0.5
                        if dx < 60 and 0 <= (y - top) < 12:
                            px = red
                    if size // 2 - 34 <= x <= size // 2 + 22 and size - 64 <= y <= size - 58:
                        px = blue
                    if (x - (size // 2 + 34)) ** 2 + (y - (size - 60)) ** 2 <= 36:
                        px = orange
            raw += bytes(px)

    def chunk(k, d):
        return struct.pack(">I", len(d)) + k + d + struct.pack(">I", zlib.crc32(k + d) & 0xFFFFFFFF)

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def main() -> int:
    cfg = resolve_config(None, "databricks-demo")
    client = DomoClient(
        instance=cfg.instance,
        auth_mode=cfg.auth_mode,
        developer_token=cfg.developer_token,
        refresh_token=cfg.refresh_token,
    )

    icon = build_icon()
    ICON_PATH.write_bytes(icon)
    print(f"icon bytes: {len(icon)} → {ICON_PATH}")

    # Prime auth + fetch the app
    app = client.request("GET", f"/content/v1/dataapps/{APP_ID}")

    # Resolve auth header for the raw upload
    if client.developer_token:
        auth_header = {"X-DOMO-Developer-Token": client.developer_token}
    else:
        auth_header = {"X-Domo-Authentication": client._sid_cache}

    upload_url = f"{client.base_url}/data/v1/data-files"
    params = {"name": "pattern4-agent-portal-icon.png", "description": "Pattern 4 Agent Portal icon", "public": "true"}
    headers = {**auth_header, "Content-Type": "image/png", "Accept": "application/json"}
    with httpx.Client(timeout=60) as hc:
        resp = hc.post(upload_url, params=params, headers=headers, content=icon)
    if resp.status_code >= 400:
        print("UPLOAD FAILED", resp.status_code, resp.text[:500])
        return 2
    data_file_id = resp.json().get("dataFileId") or resp.json().get("id")
    print("dataFileId:", data_file_id)

    app["description"] = DESCRIPTION
    app["iconDataFileId"] = data_file_id
    app["navIconDataFileId"] = data_file_id

    result = client.request(
        "PUT",
        f"/content/v1/dataapps/{APP_ID}",
        params={"includeHiddenViews": "true"},
        json_body=app,
    )
    out = {
        "dataAppId": result.get("dataAppId"),
        "title": result.get("title"),
        "description": result.get("description"),
        "iconDataFileId": result.get("iconDataFileId"),
        "navIconDataFileId": result.get("navIconDataFileId"),
    }
    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
