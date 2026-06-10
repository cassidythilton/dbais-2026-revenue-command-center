-- Sprint 7 seasonal refresh for Pattern 4.
-- Runs inside databricks_raptor.pattern4_agent_automation.
-- Keeps existing table/view names stable for Domo Cloud Amplifier and Genie.

CREATE OR REPLACE TABLE fact_revenue_daily
USING DELTA
AS
WITH dates AS (
  SELECT explode(sequence(date_sub(current_date(), 729), current_date(), interval 1 day)) AS date
),
base AS (
  SELECT
    d.date,
    year(d.date) AS fiscal_year,
    concat('Q', quarter(d.date)) AS quarter,
    date_format(d.date, 'yyyy-MM') AS fiscal_period,
    a.tenant_id,
    a.account_id,
    a.region,
    a.segment,
    a.account_owner_id,
    a.annual_recurring_revenue,
    CASE
      WHEN a.region = 'West'
        AND a.segment = 'Enterprise'
        AND d.date BETWEEN date_sub(current_date(), 45) AND date_add(date_sub(current_date(), 45), 40)
      THEN 1 ELSE 0
    END AS incident_window,
    1.0
      + 0.085 * sin((2.0 * pi() * dayofyear(d.date)) / 365.25 - 0.45)
      + 0.035 * sin((2.0 * pi() * dayofyear(d.date)) / 91.31 + 0.70)
      + CASE WHEN month(d.date) IN (3, 6, 9, 12) AND dayofmonth(d.date) >= 20 THEN 0.055 ELSE 0 END
      + CASE WHEN month(d.date) IN (1, 7) AND dayofmonth(d.date) <= 12 THEN -0.045 ELSE 0 END
      + CASE
          WHEN a.region = 'West' AND a.segment = 'Enterprise'
            AND d.date BETWEEN date_sub(current_date(), 45) AND date_add(date_sub(current_date(), 45), 18)
          THEN -0.115
          WHEN a.region = 'West' AND a.segment = 'Enterprise'
            AND d.date BETWEEN date_add(date_sub(current_date(), 45), 19) AND date_add(date_sub(current_date(), 45), 52)
          THEN 0.035
          ELSE 0
        END AS seasonal_index,
    0.96 + pmod(hash(a.account_id, d.date, 'daily-operating-noise'), 12) / 100.0 AS operating_index
  FROM dates d
  CROSS JOIN dim_account a
)
SELECT
  date,
  fiscal_year,
  quarter,
  fiscal_period,
  tenant_id,
  account_id,
  region,
  segment,
  account_owner_id,
  CAST(annual_recurring_revenue / 365.0 AS DOUBLE) AS daily_arr,
  CAST((annual_recurring_revenue / 365.0) * greatest(0.72, seasonal_index) * operating_index * (0.16 + (pmod(hash(account_id, date, 'bookings'), 100) / 650.0)) AS DOUBLE) AS bookings_amount,
  CAST(CASE WHEN pmod(hash(account_id, date, 'expansion'), 100) < 8 THEN annual_recurring_revenue * 0.004 * greatest(0.82, seasonal_index) ELSE 0 END AS DOUBLE) AS expansion_arr,
  CAST(CASE WHEN incident_window = 1 THEN annual_recurring_revenue * 0.0019 WHEN pmod(hash(account_id, date, 'contraction'), 100) < 3 THEN annual_recurring_revenue * 0.001 ELSE 0 END AS DOUBLE) AS contraction_arr,
  CAST(CASE WHEN incident_window = 1 AND pmod(hash(account_id, date, 'churn'), 100) < 2 THEN annual_recurring_revenue * 0.0034 ELSE 0 END AS DOUBLE) AS churned_arr,
  CAST((annual_recurring_revenue / 365.0) * greatest(0.72, seasonal_index) * operating_index AS DOUBLE) AS net_revenue,
  CAST((annual_recurring_revenue / 365.0) * greatest(0.72, seasonal_index) * operating_index * (0.58 + pmod(hash(account_id, 'margin'), 18) / 100.0) AS DOUBLE) AS gross_margin,
  CAST(
    CASE
      WHEN incident_window = 1 THEN annual_recurring_revenue * (0.12 + pmod(hash(account_id, 'risk'), 20) / 100.0)
      WHEN region = 'West' AND segment = 'Enterprise' AND date > date_add(date_sub(current_date(), 45), 40) THEN annual_recurring_revenue * 0.042
      ELSE annual_recurring_revenue * (pmod(hash(account_id, date, 'baseline-risk'), 6) / 1000.0)
    END AS DOUBLE
  ) AS revenue_at_risk
FROM base;

CREATE OR REPLACE TABLE fact_renewal_risk
USING DELTA
AS
WITH months AS (
  SELECT explode(sequence(add_months(date_trunc('MONTH', current_date()), -23), date_trunc('MONTH', current_date()), interval 1 month)) AS risk_month
),
base AS (
  SELECT
    m.risk_month,
    year(m.risk_month) AS fiscal_year,
    concat('Q', quarter(m.risk_month)) AS quarter,
    a.tenant_id,
    a.account_id,
    a.region,
    a.segment,
    a.account_owner_id,
    a.renewal_date,
    a.annual_recurring_revenue,
    datediff(a.renewal_date, current_date()) AS days_to_renewal,
    1.0 + 0.12 * sin((2.0 * pi() * month(m.risk_month)) / 12.0 - 0.35)
      + CASE WHEN month(m.risk_month) IN (3, 6, 9, 12) THEN 0.08 ELSE 0 END AS risk_seasonality,
    CASE WHEN a.region = 'West' AND a.segment = 'Enterprise' AND m.risk_month >= date_trunc('MONTH', date_sub(current_date(), 45)) THEN 1 ELSE 0 END AS incident_period
  FROM months m
  CROSS JOIN dim_account a
),
scored AS (
  SELECT
    *,
    CASE
      WHEN days_to_renewal <= 45 THEN 12
      WHEN days_to_renewal <= 90 THEN 8
      WHEN days_to_renewal <= 180 THEN 4
      ELSE 0
    END AS renewal_pressure,
    CASE segment WHEN 'Enterprise' THEN 6 WHEN 'Mid-Market' THEN 3 ELSE 0 END AS segment_pressure
  FROM base
)
SELECT
  risk_month,
  fiscal_year,
  quarter,
  tenant_id,
  account_id,
  region,
  segment,
  account_owner_id,
  renewal_date,
  CAST(least(96.0, greatest(8.0,
    (CASE WHEN incident_period = 1 THEN 68 ELSE 18 + pmod(hash(account_id, risk_month, 'risk'), 38) END)
    + renewal_pressure
    + segment_pressure
    + (risk_seasonality - 1.0) * 42.0
  )) AS DOUBLE) AS renewal_risk_score,
  CASE
    WHEN incident_period = 1 OR renewal_pressure >= 8 THEN 'High'
    WHEN pmod(hash(account_id, risk_month, 'risk-tier'), 100) < 35 THEN 'Medium'
    ELSE 'Low'
  END AS risk_tier,
  CASE WHEN incident_period = 1 THEN element_at(array('SLA Breach Spike', 'Product Usage Drop', 'Negative Support Sentiment'), pmod(hash(account_id, risk_month, 'driver'), 3) + 1)
    WHEN renewal_pressure >= 8 THEN 'Renewal Window Compression'
    ELSE element_at(array('Low Adoption', 'Budget Pressure', 'Champion Change', 'Expansion Delay'), pmod(hash(account_id, risk_month, 'driver'), 4) + 1)
  END AS top_risk_driver,
  CAST(least(0.94, greatest(0.03,
    (CASE WHEN incident_period = 1 THEN 0.46 ELSE 0.06 + pmod(hash(account_id, risk_month, 'churn-prob'), 22) / 100.0 END)
    + renewal_pressure / 160.0
    + segment_pressure / 220.0
    + greatest(-0.04, (risk_seasonality - 1.0) * 0.30)
  )) AS DOUBLE) AS predicted_churn_probability,
  CAST(annual_recurring_revenue * least(0.54, greatest(0.02,
    (CASE WHEN incident_period = 1 THEN 0.34 ELSE pmod(hash(account_id, risk_month, 'risk-rev'), 9) / 100.0 END)
    + renewal_pressure / 260.0
    + greatest(-0.02, (risk_seasonality - 1.0) * 0.14)
  )) AS DOUBLE) AS revenue_at_risk,
  CASE WHEN incident_period = 1 THEN element_at(array('Executive outreach', 'Reliability credit review', 'Technical success plan', 'Renewal save play'), pmod(hash(account_id, risk_month, 'action'), 4) + 1)
    WHEN renewal_pressure >= 8 THEN 'Renewal save play'
    ELSE element_at(array('Usage enablement', 'QBR follow-up', 'Champion mapping', 'No action'), pmod(hash(account_id, risk_month, 'action'), 4) + 1)
  END AS recommended_action
FROM scored;

CREATE OR REPLACE TABLE fact_agent_actions
USING DELTA
AS
WITH high_risk AS (
  SELECT
    row_number() OVER (ORDER BY revenue_at_risk DESC, account_id) AS rn,
    count(*) OVER () AS total_rows,
    *
  FROM fact_renewal_risk
  WHERE risk_tier = 'High'
),
seed AS (
  SELECT CAST(id AS INT) AS action_idx FROM range(12000)
),
assigned AS (
  SELECT
    s.action_idx,
    h.*
  FROM seed s
  JOIN high_risk h
    ON h.rn = pmod(s.action_idx, h.total_rows) + 1
)
SELECT
  concat('ACT-', lpad(CAST(action_idx AS STRING), 7, '0')) AS action_id,
  CAST(date_add(risk_month, pmod(hash(action_idx, 'created'), 24)) AS TIMESTAMP) AS created_ts,
  date_add(risk_month, pmod(hash(action_idx, 'created'), 24)) AS date,
  tenant_id,
  account_id,
  region,
  segment,
  account_owner_id,
  CASE WHEN pmod(hash(action_idx, 'source'), 100) < 70 THEN 'Domo Agent Catalyst' ELSE 'Genie-assisted triage' END AS source_agent,
  'Why did renewal risk increase and which action should we take?' AS source_question,
  recommended_action AS recommendation,
  CASE
    WHEN pmod(hash(action_idx, 'approval'), 100) < 58 THEN 'Approved'
    WHEN pmod(hash(action_idx, 'approval'), 100) < 78 THEN 'Pending'
    WHEN pmod(hash(action_idx, 'approval'), 100) < 90 THEN 'Rejected'
    ELSE 'Not Required'
  END AS approval_status,
  CASE
    WHEN pmod(hash(action_idx, 'approval'), 100) < 58 THEN 'Executed'
    WHEN pmod(hash(action_idx, 'approval'), 100) < 78 THEN 'Waiting'
    WHEN pmod(hash(action_idx, 'approval'), 100) < 90 THEN 'Cancelled'
    ELSE 'Executed'
  END AS execution_status,
  CASE recommended_action
    WHEN 'Executive outreach' THEN 'Executive Retention Outreach'
    WHEN 'Reliability credit review' THEN 'Credit Approval Workflow'
    WHEN 'Technical success plan' THEN 'Technical Success Plan'
    WHEN 'Renewal save play' THEN 'Renewal Save Play'
    ELSE 'Customer Health Follow-up'
  END AS workflow_name,
  CASE WHEN pmod(hash(action_idx, 'approval'), 100) < 58 THEN 'vp.success@demo.local' ELSE null END AS approved_by,
  CASE WHEN pmod(hash(action_idx, 'approval'), 100) < 58 THEN CAST(date_add(risk_month, 3 + pmod(hash(action_idx, 'done'), 18)) AS TIMESTAMP) ELSE null END AS completed_ts,
  CAST(revenue_at_risk * (0.28 + pmod(hash(action_idx, 'expected'), 22) / 100.0) AS DOUBLE) AS expected_revenue_protected,
  CAST(CASE WHEN pmod(hash(action_idx, 'approval'), 100) < 58 THEN revenue_at_risk * (0.16 + pmod(hash(action_idx, 'actual'), 26) / 100.0) ELSE 0 END AS DOUBLE) AS actual_revenue_protected
FROM assigned;

CREATE OR REPLACE VIEW gold_executive_revenue_health AS
SELECT
  date,
  date_trunc('WEEK', date) AS week_start,
  fiscal_year,
  quarter,
  fiscal_period,
  tenant_id,
  region,
  segment,
  sum(net_revenue) AS net_revenue,
  sum(gross_margin) AS gross_margin,
  sum(expansion_arr) AS expansion_arr,
  sum(churned_arr) AS churned_arr,
  sum(revenue_at_risk) AS revenue_at_risk,
  CAST(sum(net_revenue) / nullif(sum(daily_arr), 0) AS DOUBLE) AS seasonal_revenue_index,
  CAST(avg(CASE WHEN date BETWEEN date_sub(current_date(), 45) AND date_add(date_sub(current_date(), 45), 40) THEN 1 ELSE 0 END) AS DOUBLE) AS incident_window_flag
FROM fact_revenue_daily
GROUP BY date, date_trunc('WEEK', date), fiscal_year, quarter, fiscal_period, tenant_id, region, segment;

CREATE OR REPLACE VIEW gold_customer_renewal_risk AS
WITH latest_risk AS (
  SELECT *
  FROM fact_renewal_risk
  WHERE risk_month = date_trunc('MONTH', current_date())
),
support_90 AS (
  SELECT
    account_id,
    count(*) AS cases_90d,
    sum(CASE WHEN sla_breached_flag THEN 1 ELSE 0 END) AS sla_breaches_90d,
    sum(CASE WHEN customer_sentiment = 'Negative' THEN 1 ELSE 0 END) AS negative_cases_90d
  FROM fact_support_cases
  WHERE date >= date_sub(current_date(), 90)
  GROUP BY account_id
),
usage_90 AS (
  SELECT
    account_id,
    avg(usage_score) AS avg_usage_score_90d,
    sum(CASE WHEN usage_drop_flag THEN 1 ELSE 0 END) AS usage_drop_days_90d
  FROM fact_product_usage_daily
  WHERE date >= date_sub(current_date(), 90)
  GROUP BY account_id
)
SELECT
  a.account_id,
  a.account_name,
  a.tenant_id,
  a.region,
  a.segment,
  a.industry,
  a.account_owner_id,
  a.account_owner_name,
  a.annual_recurring_revenue,
  r.renewal_date,
  datediff(r.renewal_date, current_date()) AS days_to_renewal,
  r.renewal_risk_score,
  r.risk_tier,
  r.top_risk_driver,
  r.predicted_churn_probability,
  r.revenue_at_risk,
  r.recommended_action,
  coalesce(s.cases_90d, 0) AS cases_90d,
  coalesce(s.sla_breaches_90d, 0) AS sla_breaches_90d,
  coalesce(s.negative_cases_90d, 0) AS negative_cases_90d,
  coalesce(u.avg_usage_score_90d, 0) AS avg_usage_score_90d,
  coalesce(u.usage_drop_days_90d, 0) AS usage_drop_days_90d
FROM latest_risk r
JOIN dim_account a ON r.account_id = a.account_id
LEFT JOIN support_90 s ON r.account_id = s.account_id
LEFT JOIN usage_90 u ON r.account_id = u.account_id;

CREATE OR REPLACE VIEW gold_revenue_forecast_time_series AS
WITH dates AS (
  SELECT explode(sequence(date_sub(current_date(), 365), date_add(current_date(), 112), interval 7 days)) AS week_start
),
actuals AS (
  SELECT
    date_trunc('WEEK', date) AS week_start,
    sum(net_revenue) AS actual_net_revenue,
    sum(revenue_at_risk) AS actual_revenue_at_risk
  FROM fact_revenue_daily
  WHERE date >= date_sub(current_date(), 365)
  GROUP BY date_trunc('WEEK', date)
),
baseline AS (
  SELECT
    d.week_start,
    1.0
      + 0.085 * sin((2.0 * pi() * dayofyear(d.week_start)) / 365.25 - 0.45)
      + 0.035 * sin((2.0 * pi() * dayofyear(d.week_start)) / 91.31 + 0.70)
      + CASE WHEN month(d.week_start) IN (3, 6, 9, 12) AND dayofmonth(d.week_start) >= 20 THEN 0.055 ELSE 0 END AS seasonal_index,
    datediff(d.week_start, current_date()) AS days_from_today
  FROM dates d
),
anchors AS (
  SELECT
    avg(actual_net_revenue) AS trailing_weekly_revenue,
    avg(actual_revenue_at_risk) AS trailing_weekly_risk
  FROM actuals
  WHERE week_start >= date_sub(current_date(), 84)
)
SELECT
  b.week_start,
  CASE WHEN b.week_start <= current_date() THEN a.actual_net_revenue ELSE null END AS actual_net_revenue,
  CAST((coalesce(a.actual_net_revenue, anchors.trailing_weekly_revenue) * b.seasonal_index * (1.0 + greatest(0, b.days_from_today) / 900.0)) AS DOUBLE) AS forecast_net_revenue,
  CAST((coalesce(a.actual_net_revenue, anchors.trailing_weekly_revenue) * b.seasonal_index * (1.015 + greatest(0, b.days_from_today) / 780.0)) AS DOUBLE) AS model_prediction_net_revenue,
  CAST((coalesce(a.actual_net_revenue, anchors.trailing_weekly_revenue) * b.seasonal_index * (1.0 + greatest(0, b.days_from_today) / 900.0) * (0.93 - least(0.04, greatest(0, b.days_from_today) / 2800.0))) AS DOUBLE) AS forecast_lower,
  CAST((coalesce(a.actual_net_revenue, anchors.trailing_weekly_revenue) * b.seasonal_index * (1.0 + greatest(0, b.days_from_today) / 900.0) * (1.07 + least(0.04, greatest(0, b.days_from_today) / 2800.0))) AS DOUBLE) AS forecast_upper,
  CASE WHEN b.week_start > current_date() THEN true ELSE false END AS is_forecast,
  b.seasonal_index,
  coalesce(a.actual_revenue_at_risk, anchors.trailing_weekly_risk) AS revenue_at_risk
FROM baseline b
CROSS JOIN anchors
LEFT JOIN actuals a ON b.week_start = a.week_start;
