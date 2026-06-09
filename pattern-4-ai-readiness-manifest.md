# Pattern 4 AI Readiness Manifest

Unity Catalog is the source of truth. Domo AI Readiness should mirror these dataset contexts, synonyms, and enabled columns for the five gold datasets.

## executiveRevenueHealth

Domo DataSet: `1b0f9391-a9e3-4aa8-8d12-65cbb1c6b313`  
Unity Catalog: `databricks_raptor.pattern4_agent_automation.gold_executive_revenue_health`

Executive revenue health dataset for Pattern 4. Use for questions about net revenue, gross margin, expansion ARR, churned ARR, revenue at risk, fiscal periods, region, segment, and tenant.

**Dataset synonyms:** revenue health, executive KPIs, ARR, risk exposure, margin, regional revenue

| Column | AI Enabled | Type | Synonyms |
|---|---:|---|---|
| `date` | yes | DATE |  |
| `fiscal_year` | yes | INT |  |
| `quarter` | yes | STRING |  |
| `fiscal_period` | yes | STRING |  |
| `tenant_id` | yes | STRING |  |
| `region` | yes | STRING | geo, territory |
| `segment` | yes | STRING |  |
| `net_revenue` | yes | DOUBLE | revenue, sales, net sales |
| `gross_margin` | yes | DOUBLE | margin, profit margin |
| `expansion_arr` | yes | DOUBLE |  |
| `churned_arr` | yes | DOUBLE |  |
| `revenue_at_risk` | yes | DOUBLE | risk exposure, ARR at risk, renewal exposure |

## customerRenewalRisk

Domo DataSet: `8982cede-5feb-4401-89eb-83937ef8a971`  
Unity Catalog: `databricks_raptor.pattern4_agent_automation.gold_customer_renewal_risk`

Customer renewal risk dataset for Pattern 4. Use for account triage, risk tiers, renewal risk scores, top risk drivers, support pressure, usage drops, and recommended retention actions.

**Dataset synonyms:** renewal risk, churn risk, account health, risk driver, customer health, retention action

| Column | AI Enabled | Type | Synonyms |
|---|---:|---|---|
| `account_id` | yes | STRING |  |
| `account_name` | yes | STRING | customer, account |
| `tenant_id` | yes | STRING |  |
| `region` | yes | STRING |  |
| `segment` | yes | STRING |  |
| `account_owner_id` | yes | STRING |  |
| `renewal_risk_score` | yes | DOUBLE | risk score, renewal risk, churn risk |
| `risk_tier` | yes | STRING |  |
| `top_risk_driver` | yes | STRING | risk reason, driver, cause |
| `predicted_churn_probability` | yes | DOUBLE |  |
| `revenue_at_risk` | yes | DOUBLE |  |
| `recommended_action` | yes | STRING | next best action, recommendation, retention play |
| `cases_90d` | yes | LONG |  |
| `sla_breaches_90d` | yes | LONG |  |
| `usage_drop_days_90d` | yes | LONG |  |

## incidentRevenueImpact

Domo DataSet: `98abca9c-59dc-4e4c-9e51-c242ba2ce17f`  
Unity Catalog: `databricks_raptor.pattern4_agent_automation.gold_incident_revenue_impact`

Incident revenue impact dataset for Pattern 4. Use for root-cause analysis of incidents, affected accounts, SLA breaches, support case spikes, customer impact, and renewal revenue at risk.

**Dataset synonyms:** incident impact, root cause, SLA breach, support spike, reliability incident, SEV-1

| Column | AI Enabled | Type | Synonyms |
|---|---:|---|---|
| `incident_id` | yes | STRING |  |
| `incident_date` | yes | DATE |  |
| `product_id` | yes | STRING |  |
| `region` | yes | STRING |  |
| `severity` | yes | STRING |  |
| `incident_category` | yes | STRING |  |
| `root_cause` | yes | STRING | why, cause, reason |
| `customer_impact_level` | yes | STRING |  |
| `estimated_revenue_impact` | yes | DOUBLE |  |
| `affected_account_count` | yes | LONG |  |
| `support_case_count` | yes | LONG | tickets, cases, support volume |
| `sla_breach_count` | yes | LONG | SLA breaches, breaches, missed SLA |
| `renewal_revenue_at_risk` | yes | DOUBLE | incident risk, risk from incident |

## agentActionQueue

Domo DataSet: `91de18fe-e88a-4ffd-90b6-acc4038a6882`  
Unity Catalog: `databricks_raptor.pattern4_agent_automation.gold_agent_action_queue`

Agent action queue dataset for Pattern 4. Use for questions about recommended actions, approvals, execution status, workflows, protected revenue, and agent-to-agent business execution.

**Dataset synonyms:** agent actions, workflow queue, approval status, execution status, protected revenue, human approval

| Column | AI Enabled | Type | Synonyms |
|---|---:|---|---|
| `action_id` | yes | STRING |  |
| `created_ts` | yes | TIMESTAMP |  |
| `date` | yes | DATE |  |
| `tenant_id` | yes | STRING |  |
| `account_id` | yes | STRING |  |
| `region` | yes | STRING |  |
| `segment` | yes | STRING |  |
| `account_owner_id` | yes | STRING |  |
| `source_agent` | yes | STRING |  |
| `source_question` | yes | STRING |  |
| `recommendation` | yes | STRING | action, next step, play |
| `approval_status` | yes | STRING | approval, human signoff, review status |
| `execution_status` | yes | STRING | workflow status, execution, run status |
| `workflow_name` | yes | STRING |  |
| `approved_by` | yes | STRING |  |
| `expected_revenue_protected` | yes | DOUBLE |  |
| `actual_revenue_protected` | yes | DOUBLE | protected revenue, saved revenue |
| `workflow_cycle_days` | yes | INT |  |

## portalUserScope

Domo DataSet: `363d087d-02f3-4856-aedd-15c79f07c0c4`  
Unity Catalog: `databricks_raptor.pattern4_agent_automation.gold_portal_user_scope`

Portal user scope dataset for Pattern 4. Use for persona scoping, tenant access, region access, account-owner access, and alignment between Unity Catalog row filters and Domo PDP.

**Dataset synonyms:** persona, entitlement, user scope, PDP, row filter, access level

| Column | AI Enabled | Type | Synonyms |
|---|---:|---|---|
| `user_key` | yes | STRING | email, user |
| `display_name` | yes | STRING |  |
| `persona` | yes | STRING | role, user type, viewer |
| `tenant_id` | yes | STRING |  |
| `region` | yes | STRING |  |
| `account_owner_id` | yes | STRING |  |
| `access_level` | yes | STRING | scope, entitlement, permission |
