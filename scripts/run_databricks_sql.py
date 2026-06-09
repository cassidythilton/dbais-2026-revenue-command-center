#!/usr/bin/env python3
"""Run semicolon-delimited Databricks SQL statements via the SQL Statement API."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path


def split_sql(sql: str) -> list[str]:
    statements: list[str] = []
    current: list[str] = []
    in_single = False
    in_double = False
    line_comment = False

    for idx, char in enumerate(sql):
        nxt = sql[idx + 1] if idx + 1 < len(sql) else ""
        if line_comment:
            current.append(char)
            if char == "\n":
                line_comment = False
            continue
        if not in_single and not in_double and char == "-" and nxt == "-":
            line_comment = True
            current.append(char)
            continue
        if char == "'" and not in_double:
            in_single = not in_single
        elif char == '"' and not in_single:
            in_double = not in_double
        if char == ";" and not in_single and not in_double:
            statement = "".join(current).strip()
            if statement:
                statements.append(statement)
            current = []
        else:
            current.append(char)

    tail = "".join(current).strip()
    if tail:
        statements.append(tail)
    return statements


def databricks_cli(args: list[str]) -> dict:
    result = subprocess.run(args, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    if not result.stdout.strip():
        return {}
    return json.loads(result.stdout)


def run_statement(cli: str, profile: str, warehouse_id: str, catalog: str, schema: str, statement: str) -> dict:
    payload = {
        "warehouse_id": warehouse_id,
        "catalog": catalog,
        "schema": schema,
        "statement": statement,
        "wait_timeout": "50s",
        "on_wait_timeout": "CONTINUE",
    }
    response = databricks_cli(
        [
            cli,
            "api",
            "post",
            "/api/2.0/sql/statements",
            "--profile",
            profile,
            "--json",
            json.dumps(payload),
        ]
    )

    statement_id = response.get("statement_id")
    state = response.get("status", {}).get("state")
    while state in {"PENDING", "RUNNING"}:
        time.sleep(5)
        response = databricks_cli(
            [
                cli,
                "api",
                "get",
                f"/api/2.0/sql/statements/{statement_id}",
                "--profile",
                profile,
            ]
        )
        state = response.get("status", {}).get("state")

    if state != "SUCCEEDED":
        error = response.get("status", {}).get("error", {})
        raise RuntimeError(f"Statement failed with state={state}: {error}")
    return response


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("sql_file", type=Path)
    parser.add_argument("--cli", default=str(Path.home() / "bin" / "databricks"))
    parser.add_argument("--profile", default="pattern4")
    parser.add_argument("--warehouse-id", default="ea829ba58bcae093")
    parser.add_argument("--catalog", default="databricks_raptor")
    parser.add_argument("--schema", default="pattern4_agent_automation")
    args = parser.parse_args()

    statements = split_sql(args.sql_file.read_text())
    print(f"Running {len(statements)} SQL statements from {args.sql_file}")
    for index, statement in enumerate(statements, start=1):
        first_line = next((line.strip() for line in statement.splitlines() if line.strip()), "")
        print(f"[{index}/{len(statements)}] {first_line[:110]}")
        run_statement(args.cli, args.profile, args.warehouse_id, args.catalog, args.schema, statement)
    print("All statements completed successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
