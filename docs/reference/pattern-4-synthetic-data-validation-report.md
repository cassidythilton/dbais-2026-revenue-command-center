# Sprint 1 Synthetic Data Validation Report

Catalog: `databricks_raptor`  
Schema: `pattern4_agent_automation`  
Warehouse: `ea829ba58bcae093`

## Row Counts

| object_name | row_count |
| --- | --- |
| dim_account | 4000 |
| dim_product | 10 |
| dim_tenant | 6 |
| dim_user_entitlement | 10 |
| fact_agent_actions | 12000 |
| fact_incidents | 120 |
| fact_product_usage_daily | 1460345 |
| fact_renewal_risk | 96000 |
| fact_revenue_daily | 2920000 |
| fact_support_cases | 150000 |
| gold_agent_action_queue | 12000 |
| gold_customer_renewal_risk | 4000 |
| gold_executive_revenue_health | 52560 |
| gold_incident_revenue_impact | 120 |
| gold_portal_user_scope | 10 |

## Incident Story

| incident_id | region | severity | estimated_revenue_impact | support_cases | sla_breaches | affected_accounts | current_revenue_at_risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INC-0001 | West | SEV-1 | 2400000.0 | 30000 | 30000 | 226 | 5.530165696E7 |

## Risk Comparison

| region | segment | account_month_rows | avg_risk_score | revenue_at_risk |
| --- | --- | --- | --- | --- |
| West | Enterprise | 226 | 82.64 | 5.530165696E7 |
| East | Enterprise | 173 | 40.29 | 6425306.79 |
| South | Enterprise | 130 | 39.28 | 4464374.61 |
| Central | Enterprise | 156 | 39.03 | 5046695.31 |

## Persona Scope

| persona | scoped_accounts |
| --- | --- |
| West Regional Manager | 1394 |
| East Regional Manager | 1015 |
| West Account Owner | 112 |
| Executive Sponsor | 4000 |

## Action Status

| approval_status | execution_status | action_count | expected_revenue_protected | actual_revenue_protected |
| --- | --- | --- | --- | --- |
| Approved | Executed | 6922 | 5.945394674E7 | 4.415298643E7 |
| Pending | Waiting | 2418 | 2.042840061E7 | 0.0 |
| Rejected | Cancelled | 1448 | 1.281356478E7 | 0.0 |
| Not Required | Executed | 1212 | 9967324.6 | 0.0 |
