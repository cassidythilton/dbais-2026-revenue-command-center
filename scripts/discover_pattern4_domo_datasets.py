#!/usr/bin/env python3
"""Discover Pattern 4 Domo datasets after Cloud Amplifier registration."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_PATH = ROOT / "pattern4-agent-portal" / "dataset-mapping.template.json"
OUTPUT_PATH = ROOT / "pattern4-agent-portal" / "dataset-mapping.discovered.json"


def main() -> int:
    env = {
        **os.environ,
        "DOMO_INSTANCE": "databricks-demo",
        "DOMO_AUTH_MODE": "ryuu-session",
    }
    result = subprocess.run(
        ["community-domo-cli", "datasets", "list"],
        capture_output=True,
        text=True,
        check=True,
        env=env,
    )
    datasets = json.loads(result.stdout).get("dataSources", [])
    template = json.loads(TEMPLATE_PATH.read_text())

    for alias, config in template.items():
        expected_name = config["recommendedDomoName"]
        databricks_object = config["databricksObject"]
        match = next(
            (
                dataset
                for dataset in datasets
                if dataset.get("name") in {expected_name, databricks_object}
                or dataset.get("name", "").endswith(databricks_object.split(".", 2)[-1])
            ),
            None,
        )
        if match:
            config["dataSetId"] = match["id"]
            config["state"] = match.get("state")
            config["status"] = match.get("status")
            config["rowCount"] = match.get("rowCount")
            config["columnCount"] = match.get("columnCount")
            config["transportType"] = match.get("transportType")
            config["cloudId"] = match.get("cloudId")
            config["cloudName"] = match.get("cloudName")

    OUTPUT_PATH.write_text(json.dumps(template, indent=2))
    found = sum(1 for item in template.values() if item.get("dataSetId"))
    print(f"Discovered {found}/{len(template)} Pattern 4 datasets.")
    print(f"Wrote {OUTPUT_PATH}")
    return 0 if found == len(template) else 2


if __name__ == "__main__":
    raise SystemExit(main())
