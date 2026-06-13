#!/usr/bin/env python3
"""Populate Unity Catalog comments + tags on the Pattern 4 gold views.

The six gold views in databricks_raptor.pattern4_agent_automation power the
Revenue Command Center demo (forecast cockpit, Genie NL Q&A, renewal-risk ML,
agent-to-agent retention workflow, approvals, AI readiness). This script writes
business-meaningful, Genie-friendly table/column comments and a consistent
governance + semantic tag vocabulary so the metadata is fully populated for the
demo and feeds Domo AI Readiness.

Views (not tables), so:
  - view comment  -> ALTER VIEW v SET TBLPROPERTIES ('comment' = '...')
  - view tags     -> ALTER VIEW v SET TAGS (...)
  - column comment-> COMMENT ON COLUMN v.col IS '...'
  - column tags   -> ALTER TABLE v ALTER COLUMN col SET TAGS (...)

Auth uses the established `pattern4` CLI profile + Main SQL Warehouse; no tokens
are read or written. Run with --dry-run to print the generated statements.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time

CLI = "/Users/cassidy.hilton/bin/databricks"
PROFILE = "pattern4"
WAREHOUSE = "ea829ba58bcae093"
CATALOG = "databricks_raptor"
SCHEMA = "pattern4_agent_automation"

# Shared governance tags applied to every gold view.
COMMON_TABLE_TAGS = {
    "governed_source": "unity_catalog",
    "pattern4": "true",
    "domo_ai_ready": "true",
    "medallion_layer": "gold",
    "data_product": "revenue_command_center",
}

# col spec: (comment, semantic_type, unit_or_None, metric_bool, pii_bool)
VIEWS: dict = {
    "gold_executive_revenue_health": {
        "comment": (
            "Pattern 4 executive revenue health gold view. Weekly governed revenue-assurance "
            "metrics by tenant, region, and segment — net revenue, gross margin, expansion vs. "
            "churned ARR, revenue at risk, and seasonality with an incident-window flag. Powers the "
            "Revenue Command Center forecast hero and executive KPIs; the same governed numbers Genie "
            "and the forecast model read."
        ),
        "tags": {"data_domain": "revenue", "business_owner": "Revenue Operations",
                 "refresh_cadence": "weekly", "domo_alias": "executiveRevenueHealth"},
        "columns": {
            "date": ("Calendar date of the weekly revenue snapshot (week ending). Primary time grain for executive revenue trend and forecast comparison.", "date", None, False, False),
            "week_start": ("Start timestamp of the fiscal week the metrics roll up to.", "date", None, False, False),
            "fiscal_year": ("Fiscal year the period belongs to (e.g., 2026).", "dimension", None, False, False),
            "quarter": ("Fiscal quarter label (e.g., Q1, Q2) for period-over-period revenue analysis.", "dimension", None, False, False),
            "fiscal_period": ("Fiscal period label combining fiscal year and quarter for reporting.", "dimension", None, False, False),
            "tenant_id": ("Customer tenant identifier; aligns to Unity Catalog row filters and Domo PDP scope.", "identifier", None, False, False),
            "region": ("Sales region (West, East, South, Central). Key dimension for the West incident narrative.", "dimension", None, False, False),
            "segment": ("Customer segment (Enterprise, Mid-Market, SMB).", "dimension", None, False, False),
            "net_revenue": ("Net recognized revenue for the week in USD, after discounts and credits. Headline metric for the forecast hero.", "measure", "usd", True, False),
            "gross_margin": ("Gross margin ratio for the week (0-1).", "measure", "ratio", False, False),
            "expansion_arr": ("Annual recurring revenue gained from upsell/expansion in the period, USD.", "measure", "usd", False, False),
            "churned_arr": ("Annual recurring revenue lost to churn in the period, USD.", "measure", "usd", False, False),
            "revenue_at_risk": ("Renewal revenue exposed to elevated churn risk in the period, USD. Drives the Revenue at Risk KPI.", "measure", "usd", True, False),
            "seasonal_revenue_index": ("Seasonality multiplier applied to baseline revenue (1.0 = neutral); captures annual and quarterly demand cycles.", "measure", "index", False, False),
            "incident_window_flag": ("Flag (1.0/0.0) marking weeks within an active reliability-incident window; explains forecast dips.", "flag", None, False, False),
        },
    },
    "gold_customer_renewal_risk": {
        "comment": (
            "Pattern 4 customer renewal risk gold view. Account-level renewal exposure scored from "
            "usage, support, and sentiment signals — risk tier, top driver, predicted churn probability, "
            "revenue at risk, and the recommended retention play. Source of truth for the renewal-risk ML "
            "model, Genie account questions, and the agent-to-agent retention workflow."
        ),
        "tags": {"data_domain": "customer_success", "business_owner": "Customer Success",
                 "refresh_cadence": "daily", "domo_alias": "customerRenewalRisk"},
        "columns": {
            "account_id": ("Unique account identifier. Join key across renewal, action, and revenue views.", "identifier", None, False, False),
            "account_name": ("Customer account display name.", "identifier", None, False, True),
            "tenant_id": ("Customer tenant identifier; aligns to Unity Catalog row filters and Domo PDP.", "identifier", None, False, False),
            "region": ("Sales region of the account.", "dimension", None, False, False),
            "segment": ("Customer segment (Enterprise, Mid-Market, SMB).", "dimension", None, False, False),
            "industry": ("Account industry vertical.", "dimension", None, False, False),
            "account_owner_id": ("Identifier of the owning account executive / CSM.", "identifier", None, False, True),
            "account_owner_name": ("Name of the owning account executive / CSM.", "identifier", None, False, True),
            "annual_recurring_revenue": ("Account annual recurring revenue (ARR) in USD.", "measure", "usd", True, False),
            "renewal_date": ("Contract renewal date for the account.", "date", None, False, False),
            "days_to_renewal": ("Days remaining until the renewal date as of the snapshot.", "measure", "days", False, False),
            "renewal_risk_score": ("Composite renewal-risk score (0-100); higher means greater churn risk.", "measure", "score", True, False),
            "risk_tier": ("Categorical risk tier (Low, Medium, High, Critical) derived from the risk score.", "dimension", None, False, False),
            "top_risk_driver": ("Primary contributing factor to renewal risk (e.g., usage decline, SLA breaches, negative sentiment).", "dimension", None, False, False),
            "predicted_churn_probability": ("Model-predicted probability of non-renewal / churn (0-1) from the renewal-risk regressor served on Databricks Model Serving.", "measure", "probability", True, False),
            "revenue_at_risk": ("ARR exposed if the account churns, USD (ARR weighted by churn probability).", "measure", "usd", True, False),
            "recommended_action": ("Recommended retention play for the account; seeds the agent recommendation and approval workflow.", "text", None, False, False),
            "cases_90d": ("Count of support cases opened in the trailing 90 days.", "measure", "count", False, False),
            "sla_breaches_90d": ("Count of SLA breaches in the trailing 90 days.", "measure", "count", False, False),
            "negative_cases_90d": ("Count of support cases with negative sentiment in the trailing 90 days.", "measure", "count", False, False),
            "avg_usage_score_90d": ("Average product usage / health score over the trailing 90 days.", "measure", "score", False, False),
            "usage_drop_days_90d": ("Number of days in the trailing 90 with a material usage decline.", "measure", "days", False, False),
        },
    },
    "gold_incident_revenue_impact": {
        "comment": (
            "Pattern 4 incident revenue impact gold view. Reliability-incident root cause with affected "
            "accounts, support cases, SLA breaches, sentiment impact, and renewal revenue at risk. Source "
            "of truth for the West SEV-1 incident narrative that explains the forecast dip."
        ),
        "tags": {"data_domain": "reliability", "business_owner": "Reliability Engineering",
                 "refresh_cadence": "event_driven", "domo_alias": "incidentRevenueImpact"},
        "columns": {
            "incident_id": ("Unique incident identifier (e.g., INC-0001).", "identifier", None, False, False),
            "incident_date": ("Date the incident occurred.", "date", None, False, False),
            "product_id": ("Identifier of the affected product / service.", "identifier", None, False, False),
            "region": ("Region most affected by the incident.", "dimension", None, False, False),
            "severity": ("Incident severity level (e.g., SEV-1, SEV-2).", "dimension", None, False, False),
            "incident_category": ("Category / type of incident (e.g., availability, performance, data).", "dimension", None, False, False),
            "root_cause": ("Diagnosed root cause of the incident.", "text", None, False, False),
            "customer_impact_level": ("Qualitative customer impact level (High, Medium, Low).", "dimension", None, False, False),
            "estimated_revenue_impact": ("Estimated direct revenue impact attributable to the incident, USD.", "measure", "usd", True, False),
            "affected_account_count": ("Number of customer accounts affected by the incident.", "measure", "count", False, False),
            "support_case_count": ("Number of support cases generated by the incident.", "measure", "count", False, False),
            "sla_breach_count": ("Number of SLA breaches caused by the incident.", "measure", "count", False, False),
            "negative_case_count": ("Number of negatively-sentimented support cases tied to the incident.", "measure", "count", False, False),
            "renewal_revenue_at_risk": ("Renewal ARR placed at risk among affected accounts, USD.", "measure", "usd", True, False),
        },
    },
    "gold_agent_action_queue": {
        "comment": (
            "Pattern 4 agent action queue gold view. Genie-grounded Domo agent retention recommendations "
            "with approval and execution state, governing workflow, cycle time, and expected vs. actual "
            "protected revenue. Source of truth for the insight to approval to action loop and the "
            "agent-to-agent retention workflow."
        ),
        "tags": {"data_domain": "automation", "business_owner": "Revenue Operations",
                 "refresh_cadence": "continuous", "domo_alias": "agentActionQueue"},
        "columns": {
            "action_id": ("Unique identifier of the recommended agent action.", "identifier", None, False, False),
            "created_ts": ("Timestamp the recommendation was created.", "date", None, False, False),
            "date": ("Date of the recommendation (reporting grain).", "date", None, False, False),
            "tenant_id": ("Customer tenant identifier; aligns to Unity Catalog row filters and Domo PDP.", "identifier", None, False, False),
            "account_id": ("Account the action targets. Joins to the renewal-risk view.", "identifier", None, False, False),
            "region": ("Region of the target account.", "dimension", None, False, False),
            "segment": ("Segment of the target account.", "dimension", None, False, False),
            "account_owner_id": ("Owning account executive / CSM identifier.", "identifier", None, False, True),
            "source_agent": ("Originating agent that produced the recommendation (e.g., Databricks Retention Supervisor).", "dimension", None, False, False),
            "source_question": ("The natural-language question or trigger that prompted the recommendation.", "text", None, False, False),
            "recommendation": ("The recommended retention action presented for approval.", "text", None, False, False),
            "approval_status": ("Human approval state (Pending, Approved, Rejected).", "dimension", None, False, False),
            "execution_status": ("Execution state of the action (Waiting, Executed, Rejected).", "dimension", None, False, False),
            "workflow_name": ("Name of the governing Domo Workflow (Renewal Risk Retention).", "dimension", None, False, False),
            "approved_by": ("Identity of the approver who signed off.", "identifier", None, False, True),
            "completed_ts": ("Timestamp the action reached a terminal state.", "date", None, False, False),
            "expected_revenue_protected": ("Projected ARR protected if the action is approved and executed, USD.", "measure", "usd", True, False),
            "actual_revenue_protected": ("Realized ARR protected after execution, USD.", "measure", "usd", True, False),
            "workflow_cycle_days": ("Elapsed days from recommendation to completion.", "measure", "days", False, False),
        },
    },
    "gold_portal_user_scope": {
        "comment": (
            "Pattern 4 portal user scope gold view. Demo persona entitlement mapping by tenant, region, "
            "account owner, and access level. Source of truth for aligning Unity Catalog row filters with "
            "Domo Personalized Data Permissions (PDP)."
        ),
        "tags": {"data_domain": "identity_governance", "business_owner": "Governance",
                 "refresh_cadence": "on_change", "domo_alias": "portalUserScope"},
        "columns": {
            "user_key": ("Stable key identifying the portal user / persona.", "identifier", None, False, False),
            "display_name": ("Human-readable persona / user name shown in the portal.", "identifier", None, False, True),
            "persona": ("Demo persona role (Executive Sponsor, Regional Manager, Account Owner).", "dimension", None, False, False),
            "tenant_id": ("Tenant the user is entitled to.", "identifier", None, False, False),
            "region": ("Region the user is scoped to (drives row-level filtering).", "dimension", None, False, False),
            "account_owner_id": ("Account-owner identifier the user maps to, when scoped to owned accounts.", "identifier", None, False, True),
            "access_level": ("Entitlement level (all-tenants, region, owned-accounts) mirrored by UC row filters and Domo PDP.", "dimension", None, False, False),
        },
    },
    "gold_revenue_forecast_time_series": {
        "comment": (
            "Pattern 4 revenue forecast time series gold view. Weekly actual vs. forecast net revenue with "
            "model prediction, confidence band, seasonality, and revenue at risk. Powers the Revenue "
            "Command Center Actual-vs-Forecast hero chart; the forecast and model lines are governed and "
            "reconcilable to executive revenue health."
        ),
        "tags": {"data_domain": "forecasting", "business_owner": "Revenue Operations",
                 "refresh_cadence": "weekly", "domo_federated": "false"},
        "columns": {
            "week_start": ("Start date of the forecast week (weekly time grain).", "date", None, False, False),
            "actual_net_revenue": ("Observed net revenue for the week, USD (null for future weeks).", "measure", "usd", True, False),
            "forecast_net_revenue": ("Baseline statistical forecast of net revenue for the week, USD.", "measure", "usd", True, False),
            "model_prediction_net_revenue": ("ML model prediction of net revenue for the week, USD.", "measure", "usd", False, False),
            "forecast_lower": ("Lower bound of the forecast confidence band, USD.", "measure", "usd", False, False),
            "forecast_upper": ("Upper bound of the forecast confidence band, USD.", "measure", "usd", False, False),
            "is_forecast": ("True for forecasted (future) weeks, false for actual weeks.", "flag", None, False, False),
            "seasonal_index": ("Seasonality multiplier applied to the week (1.0 = neutral).", "measure", "index", False, False),
            "revenue_at_risk": ("Revenue at risk attributed to the week, USD.", "measure", "usd", True, False),
        },
    },
}

# Test artifacts created during syntax probing — remove them.
CLEANUP = [
    "ALTER VIEW gold_revenue_forecast_time_series UNSET TAGS ('__test_tag__')",
    "ALTER TABLE gold_revenue_forecast_time_series ALTER COLUMN seasonal_index UNSET TAGS ('__ct2__')",
]


def q(text: str) -> str:
    """Escape single quotes for SQL string literals."""
    return text.replace("'", "''")


def build_statements() -> list[str]:
    stmts: list[str] = list(CLEANUP)
    for view, spec in VIEWS.items():
        # view comment
        stmts.append(f"ALTER VIEW {view} SET TBLPROPERTIES ('comment' = '{q(spec['comment'])}')")
        # view tags (common + per-view)
        tags = {**COMMON_TABLE_TAGS, **spec["tags"]}
        tag_sql = ", ".join(f"'{k}' = '{q(v)}'" for k, v in tags.items())
        stmts.append(f"ALTER VIEW {view} SET TAGS ({tag_sql})")
        # columns
        for col, (comment, sem, unit, metric, pii) in spec["columns"].items():
            stmts.append(f"COMMENT ON COLUMN {view}.{col} IS '{q(comment)}'")
            ctags = {"semantic_type": sem}
            if unit:
                ctags["unit"] = unit
            if metric:
                ctags["metric"] = "true"
            if pii:
                ctags["classification"] = "pii"
            ctag_sql = ", ".join(f"'{k}' = '{q(v)}'" for k, v in ctags.items())
            stmts.append(f"ALTER TABLE {view} ALTER COLUMN {col} SET TAGS ({ctag_sql})")
    return stmts


def run_statement(sql: str) -> None:
    payload = {
        "warehouse_id": WAREHOUSE, "catalog": CATALOG, "schema": SCHEMA,
        "statement": sql, "wait_timeout": "50s", "on_wait_timeout": "CONTINUE",
    }
    r = subprocess.run(
        [CLI, "api", "post", "/api/2.0/sql/statements", "--profile", PROFILE, "--json", json.dumps(payload)],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        raise RuntimeError(r.stderr or r.stdout)
    resp = json.loads(r.stdout)
    sid = resp.get("statement_id")
    state = resp.get("status", {}).get("state")
    while state in {"PENDING", "RUNNING"}:
        time.sleep(2)
        r = subprocess.run(
            [CLI, "api", "get", f"/api/2.0/sql/statements/{sid}", "--profile", PROFILE],
            capture_output=True, text=True,
        )
        resp = json.loads(r.stdout)
        state = resp.get("status", {}).get("state")
    if state != "SUCCEEDED":
        raise RuntimeError(json.dumps(resp.get("status", {})))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="Print statements without executing")
    ap.add_argument("--allow-fail", action="store_true", help="Continue past per-statement errors")
    args = ap.parse_args()

    stmts = build_statements()
    print(f"Generated {len(stmts)} statements.")
    if args.dry_run:
        for s in stmts:
            print(s)
        return 0

    failures = 0
    for i, s in enumerate(stmts, 1):
        label = s[:90].replace("\n", " ")
        try:
            run_statement(s)
            print(f"[{i}/{len(stmts)}] OK  {label}")
        except Exception as e:  # noqa: BLE001
            failures += 1
            print(f"[{i}/{len(stmts)}] FAIL {label}\n      -> {e}")
            if not args.allow_fail:
                return 1
    print(f"Done. {len(stmts) - failures}/{len(stmts)} succeeded.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
