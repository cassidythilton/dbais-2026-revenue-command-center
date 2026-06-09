CREATE OR REPLACE VIEW gold_incident_revenue_impact AS
WITH support_rollup AS (
  SELECT
    incident_id,
    count(*) AS support_case_count,
    sum(CASE WHEN sla_breached_flag THEN 1 ELSE 0 END) AS sla_breach_count,
    sum(CASE WHEN customer_sentiment = 'Negative' THEN 1 ELSE 0 END) AS negative_case_count,
    count(DISTINCT account_id) AS affected_account_count
  FROM fact_support_cases
  WHERE incident_id IS NOT NULL
  GROUP BY incident_id
),
affected_accounts AS (
  SELECT DISTINCT incident_id, account_id
  FROM fact_support_cases
  WHERE incident_id IS NOT NULL
),
risk_rollup AS (
  SELECT
    a.incident_id,
    sum(r.revenue_at_risk) AS renewal_revenue_at_risk
  FROM affected_accounts a
  JOIN fact_renewal_risk r
    ON a.account_id = r.account_id
    AND r.risk_month = date_trunc('MONTH', current_date())
  GROUP BY a.incident_id
)
SELECT
  i.incident_id,
  i.incident_date,
  i.product_id,
  i.region,
  i.severity,
  i.incident_category,
  i.root_cause,
  i.customer_impact_level,
  i.estimated_revenue_impact,
  coalesce(s.affected_account_count, 0) AS affected_account_count,
  coalesce(s.support_case_count, 0) AS support_case_count,
  coalesce(s.sla_breach_count, 0) AS sla_breach_count,
  coalesce(s.negative_case_count, 0) AS negative_case_count,
  coalesce(r.renewal_revenue_at_risk, 0) AS renewal_revenue_at_risk
FROM fact_incidents i
LEFT JOIN support_rollup s ON i.incident_id = s.incident_id
LEFT JOIN risk_rollup r ON i.incident_id = r.incident_id;