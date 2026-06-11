/* Pattern 4 Agent Portal — controller
   Renders a Domo-branded, Databricks-governed revenue command center.
   Runs on live Domo dataset aliases when embedded; falls back to mock data
   for local preview and offline demos. */

const DATASETS = [
  {
    alias: "executiveRevenueHealth",
    name: "Executive Revenue Health",
    object: "databricks_raptor.pattern4_agent_automation.gold_executive_revenue_health",
    dataSetId: "1b0f9391-a9e3-4aa8-8d12-65cbb1c6b313",
  },
  {
    alias: "customerRenewalRisk",
    name: "Customer Renewal Risk",
    object: "databricks_raptor.pattern4_agent_automation.gold_customer_renewal_risk",
    dataSetId: "8982cede-5feb-4401-89eb-83937ef8a971",
  },
  {
    alias: "incidentRevenueImpact",
    name: "Incident Revenue Impact",
    object: "databricks_raptor.pattern4_agent_automation.gold_incident_revenue_impact",
    dataSetId: "98abca9c-59dc-4e4c-9e51-c242ba2ce17f",
  },
  {
    alias: "agentActionQueue",
    name: "Agent Action Queue",
    object: "databricks_raptor.pattern4_agent_automation.gold_agent_action_queue",
    dataSetId: "91de18fe-e88a-4ffd-90b6-acc4038a6882",
  },
  {
    alias: "portalUserScope",
    name: "Portal User Scope",
    object: "databricks_raptor.pattern4_agent_automation.gold_portal_user_scope",
    dataSetId: "363d087d-02f3-4856-aedd-15c79f07c0c4",
  },
];

const MOCK = {
  regions: [
    { region: "West", risk: 82.6, netRevenue: 48_200_000, revenueAtRisk: 55_301_657, protectedRevenue: 38_600_000, slaBreaches: 30_000, hot: true },
    { region: "East", risk: 40.3, netRevenue: 39_500_000, revenueAtRisk: 6_425_307, protectedRevenue: 2_600_000, slaBreaches: 1_180 },
    { region: "Central", risk: 39.0, netRevenue: 31_000_000, revenueAtRisk: 5_046_695, protectedRevenue: 1_780_000, slaBreaches: 940 },
    { region: "South", risk: 39.3, netRevenue: 28_100_000, revenueAtRisk: 4_464_375, protectedRevenue: 1_170_000, slaBreaches: 820 },
  ],
  // Trailing 12 periods of total net revenue (millions), dip aligns with the incident.
  revenueTrend: [11.2, 11.5, 11.8, 12.0, 12.3, 12.6, 12.4, 12.7, 11.9, 11.4, 12.2, 12.6],
  incident: {
    incident: "INC-0001",
    severity: "SEV-1",
    region: "West",
    rootCause: "Workflow queue saturation after a regional failover degraded Raptor Workflow Engine for West enterprise tenants.",
    affectedAccounts: 226,
    supportCases: 30_000,
    slaBreaches: 30_000,
    revenueAtRisk: 55_301_657,
  },
  actions: [
    { actionId: "ACT-DEMO-001", account: "Asteria Retail Group", region: "West", recommendation: "Executive outreach", approval: "Approved", execution: "Executed", protected: 12_450_000 },
    { actionId: "ACT-DEMO-002", account: "Northstar Financial", region: "West", recommendation: "Reliability credit review", approval: "Approved", execution: "Executed", protected: 9_180_000 },
    { actionId: "ACT-DEMO-003", account: "Helio Manufacturing", region: "West", recommendation: "Technical success plan", approval: "Pending", execution: "Waiting", protected: 6_730_000 },
    { actionId: "ACT-DEMO-004", account: "Summit Health Network", region: "East", recommendation: "Renewal save play", approval: "Approved", execution: "Executed", protected: 3_240_000 },
    { actionId: "ACT-DEMO-005", account: "Bluebird Logistics", region: "Central", recommendation: "Usage enablement", approval: "Rejected", execution: "Cancelled", protected: 0 },
  ],
};

// 78 weeks of total net revenue (USD). The weekly cadence gives the hero chart
// visible seasonal oscillation, a disruption dip, and a forecast recovery arc.
const FORECAST_BASE = {
  cadence: "week",
  todayIdx: 61, // 62 weeks of actuals, 16 weeks of forecast horizon
  weekly: Array.from({ length: 78 }, (_, i) => {
    const trend = 10.6 + i * 0.034;
    const annualSeason = 0.46 * Math.sin((2 * Math.PI * i) / 52 - 0.4);
    const quarterPulse = 0.22 * Math.sin((2 * Math.PI * i) / 13 + 0.7);
    const operatingNoise = 0.16 * Math.sin((2 * Math.PI * i) / 5);
    const incidentDip = i >= 50 && i <= 55 ? -0.95 + Math.abs(i - 53) * 0.13 : 0;
    const recovery = i > 55 ? Math.min((i - 55) * 0.055, 0.72) : 0;
    const forecastLift = i > 61 ? (i - 61) * 0.06 : 0;
    return (trend + annualSeason + quarterPulse + operatingNoise + incidentDip + recovery + forecastLift) * 1_000_000;
  }),
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ML_MODEL = {
  name: "pattern4_renewal_risk",
  registry: "databricks_raptor.pattern4_agent_automation.pattern4_renewal_risk",
  endpoint: "pattern4-renewal-risk",
  version: "6",
  flavor: "MLflow pyfunc · sklearn HGB regressor",
  target: "predicted_churn_probability",
  features: [
    { key: "segment", label: "Segment", type: "select", options: ["Enterprise", "Mid-Market", "SMB"], value: "Enterprise" },
    { key: "region", label: "Region", type: "select", options: ["West", "East", "Central", "South"], value: "West" },
    { key: "industry", label: "Industry", type: "select", options: ["Retail", "Financial Services", "Manufacturing", "Healthcare", "Transportation", "Technology"], value: "Manufacturing" },
    { key: "annual_recurring_revenue", label: "ARR (USD)", type: "number", value: 1_330_000 },
    { key: "cases_90d", label: "Support cases (90d)", type: "number", value: 41 },
    { key: "sla_breaches_90d", label: "SLA breaches (90d)", type: "number", value: 12 },
    { key: "negative_cases_90d", label: "Negative cases (90d)", type: "number", value: 9 },
    { key: "avg_usage_score_90d", label: "Avg usage score (90d)", type: "number", value: 58 },
    { key: "usage_drop_days_90d", label: "Usage-drop days (90d)", type: "number", value: 22 },
    { key: "days_to_renewal", label: "Days to renewal", type: "number", value: 47 },
  ],
};

// Mock Lakebase operational state (replaced by live cobra-v1 reads once CE functions are wired).
const LAKEBASE_MOCK = {
  scenarios: [
    { id: 1, name: "West save play — aggressive", status: "complete", created_by: "exec.sponsor@domo.com", delta: 7_400_000, assumptions: { region: "West", intervention: "executive outreach + reliability credit", source_table: "gold_agent_action_queue" }, results: { forecast_delta: 7400000, protected_revenue: 38600000 } },
    { id: 2, name: "Baseline forecast Q3", status: "complete", created_by: "exec.sponsor@domo.com", delta: 0, assumptions: { region: "All", intervention: "baseline", source_table: "gold_executive_revenue_health" }, results: { forecast_delta: 0 } },
    { id: 3, name: "Reliability credits only", status: "running", created_by: "west.manager@domo.com", delta: 3_100_000, assumptions: { region: "West", intervention: "reliability credits" }, results: { forecast_delta: 3100000 } },
    { id: 4, name: "No-intervention downside", status: "archived", created_by: "west.manager@domo.com", delta: -9_800_000, assumptions: { region: "West", intervention: "none" }, results: { forecast_delta: -9800000 } },
  ],
  feedback: [
    { id: 1, entity_id: "Asteria Retail Group", feedback: "accept", note: "Matches CSM read on the account.", by: "west.owner@domo.com", predicted_value: 0.86 },
    { id: 2, entity_id: "Northstar Financial", feedback: "adjust", note: "Risk slightly high; renewal already verbally committed.", by: "west.owner@domo.com", predicted_value: 0.71 },
    { id: 3, entity_id: "Helio Manufacturing", feedback: "accept", note: "Workflow load confirms the signal.", by: "west.manager@domo.com", predicted_value: 0.63 },
  ],
};

const GENIE_CANNED = [
  {
    match: ["west", "why", "risk", "increase"],
    answer:
      "Renewal risk in the <strong>West</strong> spiked after incident <strong>INC-0001</strong> (SEV-1). Workflow queue saturation drove a 4&ndash;6x support-case spike, SLA breaches, and product usage drops for 226 enterprise accounts &mdash; pushing the West average risk score to <strong>82.6</strong> vs. ~40 elsewhere.",
    sql: "SELECT region, ROUND(AVG(renewal_risk_score),1) AS risk\nFROM databricks_raptor.pattern4_agent_automation.gold_customer_renewal_risk\nWHERE risk_month = date_trunc('MONTH', current_date())\nGROUP BY region\nORDER BY risk DESC;",
    latencyMs: 1840,
    rows: 4,
    columns: [
      { name: "region", type_name: "STRING" },
      { name: "risk", type_name: "DOUBLE" },
    ],
    dataRows: [["West", "82.6"], ["East", "40.3"], ["South", "39.3"], ["Central", "39.0"]],
  },
  {
    match: ["affected", "accounts", "who"],
    answer:
      "<strong>226</strong> West enterprise accounts are impacted &mdash; led by Asteria Retail Group and Northstar Financial. Together they represent <strong>$55.3M</strong> of renewal exposure concentrated in the next two renewal cohorts.",
    sql: "SELECT account_name, ROUND(revenue_at_risk) AS revenue_at_risk\nFROM databricks_raptor.pattern4_agent_automation.gold_customer_renewal_risk\nWHERE region = 'West' AND segment = 'Enterprise'\nORDER BY revenue_at_risk DESC\nLIMIT 10;",
    latencyMs: 2120,
    rows: 226,
    columns: [
      { name: "account_name", type_name: "STRING" },
      { name: "revenue_at_risk", type_name: "DECIMAL" },
    ],
    dataRows: [["Asteria Retail Group", "12450000"], ["Northstar Financial", "9180000"], ["Helio Manufacturing", "6730000"], ["Summit Health Network", "3240000"], ["Bluebird Logistics", "1180000"]],
  },
  {
    match: ["action", "do", "recommend", "next"],
    answer:
      "Recommended next best actions: <strong>executive outreach</strong> and <strong>reliability credit review</strong> for the top-ARR accounts, then a <strong>technical success plan</strong> for workflow-heavy tenants. Approved actions have already protected <strong>$44.2M</strong>; one plan is pending your approval.",
    sql: "SELECT recommendation, COUNT(*) AS n, ROUND(SUM(expected_revenue_protected)) AS protected\nFROM databricks_raptor.pattern4_agent_automation.gold_agent_action_queue\nGROUP BY recommendation\nORDER BY protected DESC;",
    latencyMs: 1610,
    rows: 5,
    columns: [
      { name: "recommendation", type_name: "STRING" },
      { name: "n", type_name: "BIGINT" },
      { name: "protected", type_name: "DECIMAL" },
    ],
    dataRows: [["Executive outreach", "8", "21630000"], ["Reliability credit review", "6", "14780000"], ["Technical success plan", "5", "6730000"], ["Usage enablement", "4", "1090000"]],
  },
  {
    match: ["sla", "breach", "risk", "much"],
    answer:
      "SLA breaches tied to <strong>INC-0001</strong> sit against <strong>$55.3M</strong> of renewal exposure &mdash; concentrated in West enterprise accounts where breach volume spiked 4&ndash;6x. Every additional breach day raises the modeled churn probability for the affected cohort.",
    sql: "SELECT region, SUM(sla_breach_count) AS breaches, ROUND(SUM(renewal_revenue_at_risk)) AS at_risk\nFROM databricks_raptor.pattern4_agent_automation.gold_incident_revenue_impact\nGROUP BY region\nORDER BY at_risk DESC;",
    latencyMs: 1720,
    rows: 4,
    columns: [
      { name: "region", type_name: "STRING" },
      { name: "breaches", type_name: "BIGINT" },
      { name: "at_risk", type_name: "DECIMAL" },
    ],
    dataRows: [["West", "30000", "55301657"], ["East", "1180", "6425307"], ["Central", "940", "5046695"], ["South", "820", "4464375"]],
  },
  {
    match: ["protect", "saved", "revenue", "reduce", "approved", "after"],
    answer:
      "Yes &mdash; approved agent actions have protected <strong>$44.2M</strong> of at-risk ARR since the incident, cutting West exposure materially. The remaining <strong>$11.1M</strong> is tied to pending or rejected actions awaiting review.",
    sql: "SELECT approval_status, ROUND(SUM(actual_revenue_protected)) AS protected\nFROM databricks_raptor.pattern4_agent_automation.gold_agent_action_queue\nGROUP BY approval_status\nORDER BY protected DESC;",
    latencyMs: 1490,
    rows: 4,
    columns: [
      { name: "approval_status", type_name: "STRING" },
      { name: "protected", type_name: "DECIMAL" },
    ],
    dataRows: [["Approved", "44200000"], ["Pending", "11100000"], ["Rejected", "0"]],
  },
];

// Verbatim Databricks Genie Space seeded sample questions (space 01f1642295b61d6b8849e106f52fc781).
// These MUST match the Genie Space exactly (sourced from /api/2.0/data-rooms/{space}/curated-questions).
const GENIE_CHIPS = [
  "Why did renewal risk increase for West enterprise accounts?",
  "Did approved agent actions reduce revenue at risk after the incident?",
  "Which recommended actions should the regional manager approve first?",
  "Which accounts were most affected by incident INC-0001?",
  "How much revenue is at risk because of SLA breaches?",
];

const PERSONAS = {
  "Executive Sponsor": { regions: null, scale: 1, scope: "All tenants and regions" },
  "West Regional Manager": { regions: ["West"], scale: 1, scope: "West region" },
  "East Regional Manager": { regions: ["East"], scale: 1, scope: "East region" },
  "West Account Owner": { regions: ["West"], scale: 0.18, scope: "Assigned West accounts (OWN-WEST-01)" },
};

const state = {
  persona: "Executive Sponsor",
  mode: "mock",
  data: MOCK,
  readiness: [],
  readinessSynced: false,
  readinessSelected: "executiveRevenueHealth",
  readinessColumnSync: {},
  mlServing: false, // flips true after a successful live Model Serving response
  mlInferenceBridge: true, // CE bridge is staged; mock fallback remains active until endpoint/release are live
  mlCodeTab: "curl", // active tab in the inference payload code panel
  executedActionIds: {}, // actionId -> protected amount, for optimistic approve→execute UI
  protectedBump: 0, // running protected-revenue added by approvals this session
  workflowRuns: {}, // actionId -> { instanceId, status: PENDING|APPROVED|REJECTED, checking, error, local }
  rejectedActionIds: {}, // actionId -> true once a workflow approval was rejected
  actionRationale: null, // { actionId, account, loading|content|error, usage } from the AI Gateway reasoning endpoint
  approvals: { tasks: [], loading: false, live: false, busyId: null, error: "" }, // in-app workflow task approvals
  lakebaseLive: false, // flip true once cobra-v1 tables + CE Lakebase functions are wired
  lakebase: {
    scenarios: LAKEBASE_MOCK.scenarios.slice(),
    feedback: LAKEBASE_MOCK.feedback.slice(),
    selectedScenarioId: 1,
    activeTable: "scenarios", // explorer sub-table: "scenarios" | "feedback"
    editingRow: null,         // row being edited in the explorer form (null = add)
    formOpen: false,
    banner: null,             // { type: "success"|"error", msg }
    saving: false,
    error: "",
  },
};

/* ---------- formatting ---------- */

function fmtCurrency(value) {
  const v = Number(value) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(v) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(v);
}

function fmtNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ---------- data shaping ---------- */

function personaView() {
  const persona = PERSONAS[state.persona] || PERSONAS["Executive Sponsor"];
  const all = state.data.regions;
  const regions = persona.regions
    ? all.filter((r) => persona.regions.includes(r.region))
    : all.slice();

  const scale = persona.scale;
  const totalNet = state.data.regions.reduce((t, r) => t + r.netRevenue, 0);
  const viewNet = regions.reduce((t, r) => t + r.netRevenue, 0) * scale;

  const kpis = {
    netRevenue: viewNet,
    revenueAtRisk: regions.reduce((t, r) => t + r.revenueAtRisk, 0) * scale,
    protectedRevenue: regions.reduce((t, r) => t + r.protectedRevenue, 0) * scale,
    slaBreaches: Math.round(regions.reduce((t, r) => t + r.slaBreaches, 0) * scale),
  };

  // Scale the trend to the persona's share of total net revenue.
  const shareFactor = totalNet ? viewNet / (totalNet) : 1;
  const trend = state.data.revenueTrend.map((v) => v * (shareFactor || 1));

  const showIncident = !persona.regions || persona.regions.includes(state.data.incident.region);
  const actions = persona.regions
    ? state.data.actions.filter((a) => persona.regions.includes(a.region))
    : state.data.actions;

  return {
    scope: persona.scope,
    regions: regions.sort((a, b) => b.risk - a.risk),
    kpis,
    trend,
    scale: shareFactor || 1,
    incident: showIncident ? state.data.incident : null,
    actions,
  };
}

/* ---------- forecast model ---------- */

const forecastState = { range: 52, confidence: true, hoverIdx: null };

// Build the actual/forecast/confidence series for the hero chart, scaled per persona.
function buildForecast(scale) {
  const s = scale || 1;
  const today = new Date();
  const base = FORECAST_BASE.weekly || FORECAST_BASE.monthly;
  const todayIdx = FORECAST_BASE.todayIdx;
  const n = base.length;

  const points = base.map((raw, i) => {
    const value = raw * s;
    const isFuture = i > todayIdx;
    const periodsOut = Math.max(0, i - todayIdx);
    // Model forecast line: smoothed fit over actuals, projection over the horizon.
    const forecast = value * (isFuture ? 1 : 0.986 + 0.006 * Math.sin(i / 2));
    // Confidence band widens into the future; tight (recent fit) near today.
    const bandPct = isFuture ? 0.025 + 0.006 * periodsOut : i >= todayIdx - 4 ? 0.01 : 0;
    const d = new Date(today);
    if (FORECAST_BASE.cadence === "week") {
      d.setDate(today.getDate() - (todayIdx - i) * 7);
    } else {
      d.setMonth(today.getMonth() - (todayIdx - i), 1);
    }
    return {
      idx: i,
      label: FORECAST_BASE.cadence === "week" ? `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}` : MONTH_NAMES[d.getMonth()],
      year: d.getFullYear(),
      monthLabel: FORECAST_BASE.cadence === "week" ? `Week of ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      actual: isFuture ? null : value,
      forecast: forecast,
      lower: bandPct ? forecast * (1 - bandPct) : null,
      upper: bandPct ? forecast * (1 + bandPct) : null,
      isFuture,
    };
  });

  const start = Math.max(0, n - forecastState.range);
  return { points: points.slice(start), todayIdx: todayIdx - start, fullLen: n };
}

function pctDelta(trend) {
  if (!trend || trend.length < 2) return 0;
  const last = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  if (!prev) return 0;
  return ((last - prev) / prev) * 100;
}

/* ---------- rendering ---------- */

function render() {
  const view = personaView();

  const pill = document.getElementById("modePill");
  pill.textContent = state.mode === "live" ? "Live · Databricks" : "Preview · Mock data";
  pill.classList.toggle("live", state.mode === "live");

  renderKpis(view);
  renderForecast(view);
  renderInsightRail(view);
  renderRiskChart(view.regions);
  renderIncident(view.incident);
  renderActions(view.actions);
  renderDatasets();
}

function renderKpis(view) {
  document.getElementById("kpiNetRevenue").textContent = fmtCurrency(view.kpis.netRevenue);
  document.getElementById("kpiRisk").textContent = fmtCurrency(view.kpis.revenueAtRisk);
  const protectedEl = document.getElementById("kpiProtected");
  protectedEl.textContent = fmtCurrency(view.kpis.protectedRevenue + (state.protectedBump || 0));
  document.getElementById("kpiBreaches").textContent = fmtNumber(view.kpis.slaBreaches);

  const netDelta = pctDelta(view.trend);
  const netEl = document.getElementById("kpiNetDelta");
  netEl.textContent = `${netDelta >= 0 ? "▲" : "▼"} ${Math.abs(netDelta).toFixed(1)}%`;
  netEl.className = `kpi-delta ${netDelta >= 0 ? "up" : "down"}`;

  document.getElementById("kpiRiskDelta").textContent = "▲ exposure";
  const protDelta = document.getElementById("kpiProtectedDelta");
  protDelta.textContent = state.protectedBump > 0 ? `▲ +${fmtCurrency(state.protectedBump)} approved` : "▲ recovered";
  document.getElementById("kpiBreachDelta").textContent = "▼ resolving";

  renderSpark(view.trend);
}

function renderSpark(values) {
  const svg = document.getElementById("kpiSpark");
  if (!values || !values.length) {
    svg.innerHTML = "";
    return;
  }
  const w = 240;
  const h = 34;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = (w - pad * 2) / (values.length - 1);
  const points = values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (h - pad * 2) * (1 - (v - min) / span);
    return [x, y];
  });
  const line = points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
  const last = points[points.length - 1];
  svg.innerHTML = `
    <defs>
      <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#99ccee" stop-opacity="0.45" />
        <stop offset="1" stop-color="#99ccee" stop-opacity="0" />
      </linearGradient>
    </defs>
    <polygon points="${area}" fill="url(#sparkFill)" />
    <polyline points="${line}" fill="none" stroke="#4a90c2" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.6" fill="#1f5d86" />
  `;
}

/* ---------- forecast hero chart (SVG) ---------- */

let forecastGeo = null;

function fmtAxis(v) {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `$${(v / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

function renderForecast(view) {
  const host = document.getElementById("forecastChart");
  if (!host) return;
  const data = buildForecast(view.scale);
  const pts = data.points;
  const W = Math.max(host.clientWidth || 920, 320);
  const H = 340;
  const m = { top: 16, right: 18, bottom: 34, left: 60 };
  const plotW = W - m.left - m.right;
  const plotH = H - m.top - m.bottom;

  const vals = [];
  pts.forEach((p) => {
    [p.actual, p.forecast, p.lower, p.upper].forEach((v) => { if (v != null) vals.push(v); });
  });
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  const pad = (max - min) * 0.12 || max * 0.1;
  min = Math.max(0, min - pad);
  max = max + pad;

  const x = (i) => m.left + (pts.length <= 1 ? 0 : (i / (pts.length - 1)) * plotW);
  const y = (v) => m.top + plotH * (1 - (v - min) / (max - min || 1));

  // plot index used by x()
  pts.forEach((p, i) => (p.idx2 = i));

  // gridlines + y labels
  const ticks = 4;
  let grid = "";
  for (let t = 0; t <= ticks; t++) {
    const v = min + ((max - min) * t) / ticks;
    const gy = y(v);
    grid += `<line x1="${m.left}" y1="${gy.toFixed(1)}" x2="${W - m.right}" y2="${gy.toFixed(1)}" class="fc-grid"/>`;
    grid += `<text x="${m.left - 10}" y="${(gy + 3.5).toFixed(1)}" class="fc-ylab">${fmtAxis(v)}</text>`;
  }

  // confidence band (only where lower/upper exist)
  const bandPts = pts.filter((p) => p.lower != null && p.upper != null);
  let band = "";
  if (forecastState.confidence && bandPts.length > 1) {
    const top = bandPts.map((p) => `${x(p.idx2).toFixed(1)},${y(p.upper).toFixed(1)}`);
    const bot = bandPts.slice().reverse().map((p) => `${x(p.idx2).toFixed(1)},${y(p.lower).toFixed(1)}`);
    band = `<polygon points="${top.concat(bot).join(" ")}" fill="url(#fcBand)" stroke="none"/>`;
  }

  const actualLine = pts.filter((p) => p.actual != null).map((p) => `${x(p.idx2).toFixed(1)},${y(p.actual).toFixed(1)}`).join(" ");
  const forecastLine = pts.filter((p) => p.forecast != null).map((p) => `${x(p.idx2).toFixed(1)},${y(p.forecast).toFixed(1)}`).join(" ");

  // x labels (thin out to ~8)
  const step = Math.ceil(pts.length / 8);
  let xlabs = "";
  pts.forEach((p, i) => {
    if (i % step === 0 || i === pts.length - 1) {
      xlabs += `<text x="${x(i).toFixed(1)}" y="${H - 12}" class="fc-xlab">${p.label}</text>`;
    }
  });

  // today marker
  const tIdx = data.todayIdx;
  let today = "";
  if (tIdx >= 0 && tIdx < pts.length) {
    const tx = x(tIdx);
    today = `
      <line x1="${tx.toFixed(1)}" y1="${m.top}" x2="${tx.toFixed(1)}" y2="${m.top + plotH}" class="fc-today"/>
      <text x="${tx.toFixed(1)}" y="${m.top - 4}" class="fc-today-lab">Today</text>`;
  }

  host.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="xMinYMin meet" id="forecastSvg">
      <defs>
        <linearGradient id="fcBand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#99ccee" stop-opacity="0.42"/>
          <stop offset="100%" stop-color="#cae1f0" stop-opacity="0.12"/>
        </linearGradient>
      </defs>
      ${grid}
      ${band}
      ${today}
      <polyline points="${forecastLine}" class="fc-forecast"/>
      <polyline points="${actualLine}" class="fc-actual"/>
      ${xlabs}
      <line class="fc-hoverline" id="fcHoverLine" x1="0" y1="${m.top}" x2="0" y2="${m.top + plotH}" style="display:none"/>
      <circle class="fc-dot fc-dot-actual" id="fcDotA" r="4" style="display:none"/>
      <circle class="fc-dot fc-dot-forecast" id="fcDotF" r="4" style="display:none"/>
      <rect x="${m.left}" y="${m.top}" width="${plotW}" height="${plotH}" fill="transparent" id="fcOverlay"/>
    </svg>`;

  forecastGeo = { pts, x, y, m, plotW, plotH, W, H, view };
  wireForecastHover();
  renderForecastChips(view, data);
}

function wireForecastHover() {
  const overlay = document.getElementById("fcOverlay");
  const tip = document.getElementById("forecastTooltip");
  if (!overlay || !forecastGeo) return;
  const { pts, x, y, m, plotW } = forecastGeo;
  const line = document.getElementById("fcHoverLine");
  const dotA = document.getElementById("fcDotA");
  const dotF = document.getElementById("fcDotF");
  const svg = document.getElementById("forecastSvg");

  function hide() {
    tip.hidden = true;
    [line, dotA, dotF].forEach((el) => el && (el.style.display = "none"));
  }

  overlay.addEventListener("mousemove", (e) => {
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / forecastGeo.W;
    const localX = (e.clientX - rect.left) / scale;
    let nearest = 0;
    let best = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(x(i) - localX);
      if (d < best) { best = d; nearest = i; }
    });
    const p = pts[nearest];
    const px = x(nearest);
    line.setAttribute("x1", px);
    line.setAttribute("x2", px);
    line.style.display = "block";
    if (p.actual != null) {
      dotA.setAttribute("cx", px); dotA.setAttribute("cy", y(p.actual)); dotA.style.display = "block";
    } else dotA.style.display = "none";
    dotF.setAttribute("cx", px); dotF.setAttribute("cy", y(p.forecast)); dotF.style.display = "block";

    const rows = [];
    if (p.actual != null) rows.push(`<div class="ft-row"><span class="ft-k"><i class="ft-sw solid"></i>Actual</span><span class="ft-v">${fmtCurrency(p.actual)}</span></div>`);
    rows.push(`<div class="ft-row"><span class="ft-k"><i class="ft-sw dashed"></i>${p.isFuture ? "Forecast" : "Model fit"}</span><span class="ft-v">${fmtCurrency(p.forecast)}</span></div>`);
    if (forecastState.confidence && p.lower != null) rows.push(`<div class="ft-row"><span class="ft-k"><i class="ft-sw band"></i>Band</span><span class="ft-v">${fmtCurrency(p.lower)} – ${fmtCurrency(p.upper)}</span></div>`);
    tip.innerHTML = `<div class="ft-date">${p.monthLabel}${p.isFuture ? " · forecast" : ""}</div>${rows.join("")}`;
    tip.hidden = false;
    const wrap = tip.parentElement.getBoundingClientRect();
    let left = rect.left - wrap.left + px * scale + 14;
    if (left + 180 > wrap.width) left = rect.left - wrap.left + px * scale - 194;
    tip.style.left = `${Math.max(4, left)}px`;
    tip.style.top = `${m.top + 6}px`;
  });
  overlay.addEventListener("mouseleave", hide);
}

function renderForecastChips(view, data) {
  const host = document.getElementById("forecastChips");
  if (!host) return;
  const pts = data.points;
  const lastActual = [...pts].reverse().find((p) => p.actual != null);
  const lastForecast = pts[pts.length - 1];
  const horizon = lastForecast.forecast - (lastActual ? lastActual.actual : lastForecast.forecast);
  const horizonPct = lastActual ? (horizon / lastActual.actual) * 100 : 0;
  const sub = document.getElementById("forecastSub");
  if (sub) sub.textContent = `${pts[0].monthLabel} – ${pts[pts.length - 1].monthLabel} · ${view.scope}`;

  const chips = [
    { label: "Current run-rate", value: lastActual ? fmtCurrency(lastActual.actual) : "—", tone: "" },
    { label: "Forecast (6mo)", value: fmtCurrency(lastForecast.forecast), tone: horizon >= 0 ? "up" : "down", delta: `${horizon >= 0 ? "▲" : "▼"} ${Math.abs(horizonPct).toFixed(1)}%` },
    { label: "Revenue at risk", value: fmtCurrency(view.kpis.revenueAtRisk), tone: "warn" },
    { label: "Protected", value: fmtCurrency(view.kpis.protectedRevenue), tone: "up" },
  ];
  host.innerHTML = chips
    .map((c) => `
      <div class="fc-chip">
        <span class="fc-chip-label">${c.label}</span>
        <span class="fc-chip-value">${c.value}</span>
        ${c.delta ? `<span class="fc-chip-delta ${c.tone}">${c.delta}</span>` : ""}
      </div>`)
    .join("");
}

function renderInsightRail(view) {
  const host = document.getElementById("insightRail");
  if (!host) return;
  const top = view.regions[0];
  const inc = view.incident;
  const items = [
    {
      tone: "warn",
      title: "Forecast headwind isolated to West",
      body: inc
        ? `Model attributes the dip to ${inc.incident} (${inc.severity}). West renewal-risk is ${top ? top.risk.toFixed(1) : "—"} vs ~40 elsewhere; ${fmtCurrency(view.kpis.revenueAtRisk)} of renewals sit in the exposed cohort.`
        : `No active incident in scope — forecast trends to plan with renewal risk near baseline.`,
      cta: { label: "Ask Genie why", view: "genie", q: "Why did renewal risk increase for West enterprise accounts?" },
    },
    {
      tone: "info",
      title: "Model recovery is conditional on actions",
      body: `The forecast recovery assumes approved retention plays land. ${fmtCurrency(view.kpis.protectedRevenue)} is already protected; pending plays carry the remaining upside.`,
      cta: { label: "Score an account", view: "ml" },
    },
    {
      tone: "good",
      title: "Operational state is captured",
      body: `Scenario runs and prediction feedback persist in Lakebase next to the lakehouse, so what-ifs and human overrides survive across sessions.`,
      cta: { label: "Open Lakebase Ops", view: "lakebase" },
    },
  ];
  host.innerHTML = items
    .map((it) => `
      <div class="insight ${it.tone}">
        <div class="insight-dot" aria-hidden="true"></div>
        <div class="insight-body">
          <h3>${it.title}</h3>
          <p>${it.body}</p>
          <button class="insight-cta" type="button" data-go-view="${it.cta.view}"${it.cta.q ? ` data-go-q="${escapeHtml(it.cta.q)}"` : ""}>${it.cta.label} →</button>
        </div>
      </div>`)
    .join("");
  host.querySelectorAll(".insight-cta").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.getAttribute("data-go-view");
      const q = btn.getAttribute("data-go-q");
      activateView(v);
      if (v === "genie" && q) setTimeout(() => askGenie(q), 60);
    });
  });
}

function renderRiskChart(regions) {
  const max = Math.max(...regions.map((r) => r.risk), 1);
  document.getElementById("riskChart").innerHTML = regions
    .map((r) => {
      const width = Math.max((r.risk / max) * 100, 6);
      return `
        <div class="bar-row">
          <span class="bar-region">${r.region}</span>
          <div class="bar-track">
            <div class="bar-fill ${r.hot ? "hot" : ""}" style="width:${width}%"></div>
          </div>
          <span class="bar-value">
            ${r.risk.toFixed(1)}
            ${r.hot ? '<span class="bar-flag">Hotspot</span>' : ""}
          </span>
        </div>
      `;
    })
    .join("");
}

function renderIncident(incident) {
  const sev = document.getElementById("incidentSev");
  const id = document.getElementById("incidentId");
  const root = document.getElementById("incidentRoot");
  const metrics = document.getElementById("incidentMetrics");

  if (!incident) {
    sev.textContent = "None";
    sev.style.color = "var(--status-good)";
    sev.style.background = "var(--status-good-bg)";
    id.textContent = "No active incident in scope";
    root.textContent = "This region has no active reliability incident driving renewal risk.";
    metrics.innerHTML = "";
    return;
  }

  sev.textContent = incident.severity;
  sev.style.color = "";
  sev.style.background = "";
  id.textContent = `${incident.incident} · ${incident.region}`;
  root.textContent = incident.rootCause;

  const items = [
    ["Affected accounts", fmtNumber(incident.affectedAccounts)],
    ["Support cases", fmtNumber(incident.supportCases)],
    ["SLA breaches", fmtNumber(incident.slaBreaches)],
    ["Revenue at risk", fmtCurrency(incident.revenueAtRisk)],
  ];
  metrics.innerHTML = items
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join("");
}

function effectiveAction(a) {
  const run = state.workflowRuns[a.actionId];
  // Approved (via live workflow approval or optimistic/local approve→execute).
  if (Object.prototype.hasOwnProperty.call(state.executedActionIds, a.actionId)) {
    return Object.assign({}, a, { approval: "Approved", execution: "Executed", justActioned: true, run });
  }
  // Rejected via a live workflow approval decision.
  if (state.rejectedActionIds[a.actionId]) {
    return Object.assign({}, a, { approval: "Rejected", execution: "Cancelled", run });
  }
  // Workflow started, awaiting human approval in Domo Tasks.
  if (run && run.status === "PENDING") {
    return Object.assign({}, a, { approval: "Pending", execution: "In workflow", run });
  }
  return Object.assign({}, a, { run });
}

function renderActions(actions) {
  const body = document.getElementById("actionRows");
  if (!actions.length) {
    body.innerHTML = `<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:22px;">No agent actions in scope.</td></tr>`;
    return;
  }
  body.innerHTML = actions
    .map(effectiveAction)
    .map(
      (a) => {
        const run = a.run;
        const pending = !run && (a.execution === "Waiting" || a.approval === "Pending");
        const shortId = run && run.instanceId ? String(run.instanceId).slice(0, 8) : "";
        let actionCell = "";
        if (pending) {
          actionCell = `<button class="action-btn" type="button"
            data-action-id="${escapeHtml(a.actionId)}"
            data-protected="${Number(a.protected) || 0}"
            data-account="${escapeHtml(a.account || "")}"
            data-recommendation="${escapeHtml(a.recommendation || "")}">Approve &amp; execute</button>
            <button class="link-btn" type="button"
            data-explain="${escapeHtml(a.actionId)}"
            data-account="${escapeHtml(a.account || "")}"
            data-recommendation="${escapeHtml(a.recommendation || "")}">AI rationale ↗</button>`;
        } else if (run && run.status === "PENDING") {
          actionCell = `
            <div class="wf-mini">
              <span class="wf-run">▶ ${run.local ? "local" : escapeHtml(shortId)} · awaiting approval</span>
              <span class="wf-mini-links">
                <button class="link-btn" type="button" data-wf-check="${escapeHtml(a.actionId)}" ${run.checking ? "disabled" : ""}>${run.checking ? "Checking…" : "Refresh"}</button>
                <a class="link-btn" href="#" data-wf-task="${escapeHtml(run.instanceId || "")}">Open task ↗</a>
                ${run.error ? `<span class="wf-err" title="${escapeHtml(run.error)}">fallback</span>` : ""}
              </span>
            </div>`;
        } else if (a.justActioned) {
          actionCell = `<div class="exec-actions">
              <span class="action-writeback" title="Status written back to agent_action_writeback (Databricks)">✓ writeback${run && run.local ? " (local)" : ""}</span>
              ${run && run.local ? "" : `<a class="link-btn" href="#" data-writeback-src="1" title="View agent_action_writeback in Databricks">View in Databricks ↗</a>`}
              ${run && run.local ? "" : `<a class="link-btn" href="#" data-agent-traces="1" title="The Databricks agent's reasoning trace in MLflow">Agent activity ↗</a>`}
            </div>`;
        }
        return `
        <tr class="${a.justActioned ? "row-actioned" : ""}">
          <td><strong>${escapeHtml(a.account)}</strong></td>
          <td>${escapeHtml(a.recommendation)}</td>
          <td><span class="status ${a.approval.toLowerCase()}">${a.approval}</span></td>
          <td>
            <div class="exec-cell">
              <span class="status ${a.execution.toLowerCase().replace(/\s+/g, "-")}">${a.execution}</span>
              ${actionCell ? `<div class="exec-actions">${actionCell}</div>` : ""}
            </div>
          </td>
          <td class="num">${fmtCurrency(a.protected)}</td>
        </tr>
      `;
      }
    )
    .join("");
  document.querySelectorAll(".action-btn[data-action-id]").forEach((button) => {
    button.addEventListener("click", () => executeAction(button));
  });
  document.querySelectorAll("[data-wf-check]").forEach((button) => {
    button.addEventListener("click", () => checkWorkflow(button.getAttribute("data-wf-check")));
  });
  document.querySelectorAll("[data-wf-task]").forEach((link) => {
    link.addEventListener("click", (e) => { e.preventDefault(); openExternal(workflowInstanceUrl(link.getAttribute("data-wf-task"))); });
  });
  document.querySelectorAll("[data-writeback-src]").forEach((link) => {
    link.addEventListener("click", (e) => { e.preventDefault(); openExternal(WRITEBACK_TABLE_URL); });
  });
  wireAgentLinks();
  document.querySelectorAll("[data-explain]").forEach((button) => {
    button.addEventListener("click", () => explainAction(
      button.getAttribute("data-explain"),
      button.getAttribute("data-account") || "",
      button.getAttribute("data-recommendation") || ""
    ));
  });
  renderActionRationale();
}

// "Go to source" → the Databricks agent + its MLflow activity log. Static + dynamic
// links across the action queue / approvals; guarded so we wire each element once.
function wireAgentLinks() {
  document.querySelectorAll("[data-agent-build]:not([data-wired])").forEach((el) => {
    el.dataset.wired = "1";
    el.addEventListener("click", (e) => { e.preventDefault(); openExternal(AGENT_BUILD_URL); });
  });
  document.querySelectorAll("[data-agent-traces]:not([data-wired])").forEach((el) => {
    el.dataset.wired = "1";
    el.addEventListener("click", (e) => { e.preventDefault(); openExternal(AGENT_TRACES_URL); });
  });
}

function renderActionRationale() {
  const el = document.getElementById("actionRationale");
  if (!el) return;
  const r = state.actionRationale;
  if (!r) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  const badge = `<span class="gw-badge" title="Governed by Unity AI Gateway: usage tracking, rate limits, guardrails (input safety + PII block · output safety + PII mask), inference-table audit">⛨ Unity AI Gateway · guardrails on</span>`;
  if (r.loading) {
    el.innerHTML = `<div class="rationale-head"><strong>AI triage rationale</strong> ${badge}</div><div class="rationale-body muted">Scoring through the governed reasoning endpoint…</div>`;
    return;
  }
  if (r.error) {
    el.innerHTML = `<div class="rationale-head"><strong>AI triage rationale</strong> ${badge}</div><div class="rationale-body err">Governed reasoning unavailable in this context (${escapeHtml(String(r.error)).slice(0, 160)}).</div>`;
    return;
  }
  el.innerHTML = `<div class="rationale-head"><strong>AI triage rationale — ${escapeHtml(r.account)}</strong> ${badge}</div>
    <div class="rationale-body">${escapeHtml(r.content)}</div>
    <div class="rationale-foot">via <code>pattern4ce.askReasoningModel</code> → serving endpoint <code>pattern4-reasoning-gateway</code>${r.usage ? ` · ${r.usage.total_tokens || "?"} tokens` : ""}</div>`;
}

async function explainAction(actionId, account, recommendation) {
  state.actionRationale = { actionId, account, loading: true };
  renderActionRationale();
  const prompt = `Account "${account}" has elevated renewal risk tied to incident INC-0001 (West enterprise; SLA breaches up, usage down). The recommended retention action is "${recommendation}". In 2-3 sentences, explain why this action fits and what to watch after executing it.`;
  let result = null;
  try {
    result = await askReasoningModel(prompt, state.persona);
  } catch (error) {
    result = { status: "FAILED", error: String(error) };
  }
  if (result && result.status === "SUCCEEDED") {
    state.actionRationale = { actionId, account, content: result.content || "", usage: result.usage || null };
  } else {
    state.actionRationale = { actionId, account, error: (result && result.error) || "unavailable" };
  }
  renderActionRationale();
}

async function askReasoningModel(prompt, persona) {
  if (!window.domo || typeof window.domo.post !== "function") {
    return { status: "FAILED", error: "Domo runtime unavailable" };
  }
  const response = await window.domo.post("/domo/codeengine/v2/packages/askReasoningModel", {
    prompt,
    persona: persona || "",
  });
  return unwrapCodeEngineResponse(response);
}

async function executeAction(button) {
  const actionId = button.getAttribute("data-action-id");
  const protectedAmt = Number(button.getAttribute("data-protected")) || 0;
  const account = button.getAttribute("data-account") || "";
  const recommendation = button.getAttribute("data-recommendation") || "";
  button.textContent = "Starting workflow…";
  button.disabled = true;

  // Primary path (Shape A): start the live, governed Domo Workflow server-side.
  try {
    const result = await startRetentionWorkflow(actionId, {
      account,
      recommendation,
      protectedRevenue: protectedAmt,
      sourceQuestion: "Why did renewal risk increase for West enterprise accounts this month?",
    });
    if (result?.status === "SUCCEEDED" && result.instanceId) {
      state.workflowRuns[actionId] = { instanceId: result.instanceId, status: "PENDING", protectedAmt };
      render();
      return;
    }
    throw new Error(result?.error ? JSON.stringify(result.error) : "workflow start unavailable");
  } catch (error) {
    console.warn("Workflow trigger unavailable in this context; using local approve→execute fallback", error);
  }

  // Fallback path: optimistic approve→execute via the released writeActionStatus writeback.
  let live = false;
  try {
    const wb = await writeActionStatus(actionId);
    live = wb?.status === "SUCCEEDED";
  } catch (error) {
    console.warn("Fallback writeback also unavailable; reflecting approved state locally", error);
  }
  state.executedActionIds[actionId] = protectedAmt;
  state.workflowRuns[actionId] = { instanceId: null, status: "APPROVED", local: !live };
  state.protectedBump = (state.protectedBump || 0) + protectedAmt;
  render();
  flashKpiProtected();
}

async function checkWorkflow(actionId) {
  const run = state.workflowRuns[actionId];
  if (!run) return;
  run.checking = true;
  render();
  let result = null;
  try {
    result = await getRetentionWorkflowResult(run.instanceId, actionId);
  } catch (error) {
    run.error = String(error);
  }
  run.checking = false;
  if (result && result.status === "SUCCEEDED" && result.decided) {
    const decision = String(result.decision || "").toLowerCase();
    if (decision === "approved") {
      const amt = Number(run.protectedAmt) || 0;
      state.executedActionIds[actionId] = amt;
      state.protectedBump = (state.protectedBump || 0) + amt;
      delete state.workflowRuns[actionId];
      render();
      flashKpiProtected();
      return;
    }
    if (decision === "rejected") {
      state.rejectedActionIds[actionId] = true;
      delete state.workflowRuns[actionId];
      render();
      return;
    }
  }
  // Still in progress (or no decision yet) — keep the pending chip.
  render();
}

async function startRetentionWorkflow(actionId, ctx) {
  if (!window.domo || typeof window.domo.post !== "function") {
    return { status: "FAILED", error: "Domo runtime unavailable" };
  }
  const response = await window.domo.post("/domo/codeengine/v2/packages/startRetentionWorkflow", {
    actionId,
    account: ctx.account || "",
    recommendation: ctx.recommendation || "",
    persona: state.persona,
    predicted: null,
    protectedRevenue: Number(ctx.protectedRevenue) || 0,
    sourceQuestion: ctx.sourceQuestion || "",
  });
  return unwrapCodeEngineResponse(response);
}

async function getRetentionWorkflowResult(instanceId, actionId) {
  if (!window.domo || typeof window.domo.post !== "function") {
    return { status: "FAILED", error: "Domo runtime unavailable" };
  }
  const response = await window.domo.post("/domo/codeengine/v2/packages/getRetentionWorkflowResult", {
    instanceId: instanceId || "",
    actionId,
  });
  return unwrapCodeEngineResponse(response);
}

function flashKpiProtected() {
  const card = document.getElementById("kpiProtected");
  const kpi = card ? card.closest(".kpi") : null;
  if (!kpi) return;
  kpi.classList.remove("kpi-flash");
  // Force reflow so the animation can retrigger.
  void kpi.offsetWidth;
  kpi.classList.add("kpi-flash");
}

async function writeActionStatus(actionId) {
  if (!window.domo || typeof window.domo.post !== "function") {
    return { status: "FAILED", error: "Domo runtime unavailable" };
  }
  const response = await window.domo.post("/domo/codeengine/v2/packages/writeActionStatus", {
    actionId: actionId,
    decision: "Approved",
    executionStatus: "Executed",
    approvedBy: "demo.user@domo.com",
    note: "Approved from Pattern 4 Agent Portal",
    persona: state.persona,
  });
  return unwrapCodeEngineResponse(response);
}

function renderDatasets() {
  const tick = `<img class="dbx-mark" src="./public/databricks-logo.png" alt="" aria-hidden="true" />`;
  document.getElementById("datasetGrid").innerHTML = DATASETS.map(
    (d) => `
      <div class="dataset-card" data-dataset-alias="${escapeHtml(d.alias)}">
        <div class="alias">${tick}${d.name}</div>
        <div class="object">${d.object}</div>
        <div class="dataset-links">
          <button type="button" data-domo-dataset="${escapeHtml(d.dataSetId)}">Open Domo dataset</button>
          <button type="button" data-dbx-table="${escapeHtml(d.object)}">Open Databricks table</button>
        </div>
      </div>
    `
  ).join("");
  document.querySelectorAll("[data-domo-dataset]").forEach((btn) => {
    btn.addEventListener("click", () => openExternal(`https://databricks-demo.domo.com/datasources/${btn.getAttribute("data-domo-dataset")}/details/overview`));
  });
  document.querySelectorAll("[data-dbx-table]").forEach((btn) => {
    btn.addEventListener("click", () => openExternal(databricksObjectUrl(btn.getAttribute("data-dbx-table"))));
  });
}

function databricksObjectUrl(objectName) {
  const parts = String(objectName || "").split(".").map(encodeURIComponent);
  return `${WORKSPACE_HOST}/explore/data/${parts.join("/")}`;
}

/* ---------- ML Predictions ---------- */

function mlInvocationsUrl() {
  return `${WORKSPACE_HOST}/serving-endpoints/${ML_MODEL.endpoint}/invocations`;
}

function mlEndpointUrl() {
  return `${WORKSPACE_HOST}/ml/endpoints/${ML_MODEL.endpoint}`;
}

function mlRegisteredModelUrl() {
  const parts = ML_MODEL.registry.split(".").map(encodeURIComponent);
  return `${WORKSPACE_HOST}/explore/data/models/${parts.join("/")}`;
}

function renderMlStatus() {
  const stateEl = document.getElementById("mlModelState");
  if (stateEl) {
    stateEl.textContent = state.mlServing ? `Serving · live v${ML_MODEL.version}` : "Bridge staged · fallback";
    stateEl.classList.toggle("live", !!state.mlServing);
  }
  const line = document.getElementById("mlModelLine");
  if (line) {
    const facts = [
      ML_MODEL.flavor,
      `UC <b>v${escapeHtml(ML_MODEL.version)}</b>`,
      `endpoint <code>${escapeHtml(ML_MODEL.endpoint)}</code>`,
      `target <code>${escapeHtml(ML_MODEL.target)}</code>`,
      "governed by Unity Catalog + Domo AI Services",
    ];
    line.innerHTML = facts.join('<span class="dot-sep">·</span>');
  }
  const links = document.getElementById("mlModelLinks");
  if (links) {
    links.innerHTML = `
      <button type="button" class="link-pill dbx" data-open-url="${escapeHtml(mlRegisteredModelUrl())}">Registered model &rarr;</button>
      <button type="button" class="link-pill dbx" data-open-url="${escapeHtml(mlEndpointUrl())}">Serving endpoint &rarr;</button>`;
    links.querySelectorAll("[data-open-url]").forEach((b) =>
      b.addEventListener("click", () => openExternal(b.getAttribute("data-open-url"))));
  }
}

/* ---------- Inference payload code panel (cURL / Python / SQL) ---------- */

function mlRecordJson(indent) {
  const f = collectMlFeatures();
  const pad = indent || "";
  const lines = ML_MODEL.features.map((feat) => {
    const v = f[feat.key];
    const val = (feat.type === "select") ? `"${String(v)}"` : Number(v);
    return `${pad}  "${feat.key}": ${val}`;
  });
  return `{\n${lines.join(",\n")}\n${pad}}`;
}

function mlCurlSnippet() {
  return [
    `curl -X POST \\`,
    `  '${mlInvocationsUrl()}' \\`,
    `  -H "Authorization: Bearer $DATABRICKS_TOKEN" \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d '{"dataframe_records": [${mlRecordJson("")}]}'`,
  ].join("\n");
}

function mlPythonSnippet() {
  return [
    `import os, requests`,
    ``,
    `url = "${mlInvocationsUrl()}"`,
    `headers = {`,
    `    "Authorization": f"Bearer {os.environ['DATABRICKS_TOKEN']}",`,
    `    "Content-Type": "application/json",`,
    `}`,
    `payload = {"dataframe_records": [${mlRecordJson("")}]}`,
    ``,
    `resp = requests.post(url, headers=headers, json=payload)`,
    `resp.raise_for_status()`,
    `print(resp.json())   # {"predictions": [<churn_probability>]}`,
  ].join("\n");
}

function mlSqlSnippet() {
  const f = collectMlFeatures();
  const args = ML_MODEL.features.map((feat) => {
    const v = f[feat.key];
    const val = (feat.type === "select") ? `'${String(v)}'` : Number(v);
    return `    '${feat.key}', ${val}`;
  }).join(",\n");
  return [
    `-- Score in-warehouse with Databricks ai_query()`,
    `SELECT ai_query(`,
    `  '${ML_MODEL.endpoint}',`,
    `  named_struct(`,
    `${args}`,
    `  )`,
    `) AS ${ML_MODEL.target};`,
  ].join("\n");
}

function renderMlPayload() {
  const inv = document.getElementById("mlInvUrl");
  if (inv) inv.textContent = mlInvocationsUrl();
  const block = document.getElementById("mlCodeBlock");
  if (!block) return;
  const tab = state.mlCodeTab || "curl";
  const snippet = tab === "python" ? mlPythonSnippet() : tab === "sql" ? mlSqlSnippet() : mlCurlSnippet();
  block.textContent = snippet;
}

function renderMlForm() {
  const form = document.getElementById("mlForm");
  if (!form) return;
  form.innerHTML = ML_MODEL.features
    .map((f) => {
      if (f.type === "select") {
        const opts = f.options.map((o) => `<option value="${escapeHtml(o)}"${o === f.value ? " selected" : ""}>${escapeHtml(o)}</option>`).join("");
        return `<label class="ml-field"><span>${escapeHtml(f.label)}</span><select data-key="${f.key}">${opts}</select></label>`;
      }
      return `<label class="ml-field"><span>${escapeHtml(f.label)}</span><input type="number" data-key="${f.key}" value="${escapeHtml(String(f.value))}"/></label>`;
    })
    .join("");
}

function collectMlFeatures() {
  const out = {};
  document.querySelectorAll("#mlForm [data-key]").forEach((el) => {
    const key = el.getAttribute("data-key");
    out[key] = el.tagName === "SELECT" ? el.value : Number(el.value);
  });
  return out;
}

// Tiers calibrated to the regressor's churn-probability range (~0.10–0.60).
function riskTier(prob) {
  if (prob >= 0.45) return { tier: "High", action: "Executive outreach + reliability credit review" };
  if (prob >= 0.27) return { tier: "Medium", action: "Technical success plan + usage recovery" };
  return { tier: "Low", action: "Monitor — standard renewal motion" };
}

// Heuristic factor attribution for the result panel (illustrative, not SHAP).
function riskDrivers(f) {
  return [
    { k: "SLA breaches (90d)", v: (f.sla_breaches_90d || 0) * 0.12 },
    { k: "Usage-drop days", v: (f.usage_drop_days_90d || 0) * 0.04 },
    { k: "Support cases (90d)", v: (f.cases_90d || 0) * 0.012 },
    { k: "Low usage score", v: Math.max(0, 75 - (f.avg_usage_score_90d || 75)) * 0.02 },
    { k: "Renewal proximity", v: Math.max(0, 90 - (f.days_to_renewal || 90)) * 0.012 },
    { k: "Region = West", v: f.region === "West" ? 0.5 : 0 },
  ].filter((d) => d.v > 0).sort((a, b) => b.v - a.v).slice(0, 4);
}

// Heuristic stand-in for the served model when Code Engine / Model Serving is unavailable.
function mockPredict(f) {
  let z = -2.4;
  z += (f.sla_breaches_90d || 0) * 0.12;
  z += (f.cases_90d || 0) * 0.012;
  z += (f.usage_drop_days_90d || 0) * 0.04;
  z += (60 - (f.avg_usage_score_90d || 60)) * 0.03;
  z += Math.max(0, 90 - (f.days_to_renewal || 90)) * 0.012;
  if (f.segment === "Enterprise") z += 0.25;
  if (f.region === "West") z += 0.6;
  // Squash into the model's observed 0.10–0.60 range so preview matches live scale.
  const prob = 0.1 + 0.5 / (1 + Math.exp(-z));
  const arr = Number(f.annual_recurring_revenue || 0);
  const t = riskTier(prob);
  return {
    probability: prob,
    revenueAtRisk: arr * prob,
    tier: t.tier,
    drivers: riskDrivers(f),
    action: t.action,
  };
}

function startRunLog(log, steps) {
  if (!log) return { finish: function () {}, note: function () {} };
  log.hidden = false;
  log.classList.add("running");
  log.innerHTML = `<div class="run-log-rows">${steps
    .map((s, i) => `<div class="run-step" data-i="${i}"><span class="run-dot"></span><span class="run-text">${escapeHtml(s)}</span></div>`)
    .join("")}</div>`;
  const rows = Array.from(log.querySelectorAll(".run-step"));
  let active = 0;
  const setActive = (n) => rows.forEach((row, i) => {
    row.classList.toggle("active", i === n);
    row.classList.toggle("done", i < n);
  });
  setActive(0);
  const holdAt = Math.max(0, steps.length - 2);
  const timer = setInterval(() => { if (active < holdAt) { active++; setActive(active); } }, 850);
  return {
    note(msg) {
      const rowsHost = log.querySelector(".run-log-rows");
      if (!rowsHost) return;
      const row = document.createElement("div");
      row.className = "run-step active";
      row.innerHTML = `<span class="run-dot"></span><span class="run-text">${escapeHtml(msg)}</span>`;
      rowsHost.appendChild(row);
    },
    finish(msg, ok) {
      clearInterval(timer);
      rows.forEach((row) => { row.classList.remove("active"); row.classList.add("done"); });
      log.classList.remove("running");
      const done = document.createElement("div");
      done.className = "run-step done final " + (ok ? "ok" : "warn");
      done.innerHTML = `<span class="run-dot"></span><span class="run-text">${escapeHtml(msg)}</span>`;
      const rowsHost = log.querySelector(".run-log-rows");
      if (rowsHost) rowsHost.appendChild(done);
    },
  };
}

async function runInference() {
  const f = collectMlFeatures();
  const tag = document.getElementById("mlResultTag");
  const host = document.getElementById("mlResult");
  const btn = document.getElementById("mlRunBtn");
  const log = document.getElementById("mlRunLog");
  if (btn) { btn.disabled = true; btn.textContent = "Scoring…"; }
  if (tag) tag.textContent = "scoring…";
  const t0 = (window.performance && performance.now) ? performance.now() : Date.now();
  const anim = startRunLog(log, [
    "Building dataframe_records payload",
    "POST → pattern4ce.runModelInference (Code Engine proxy)",
    `Databricks Model Serving · ${ML_MODEL.endpoint}`,
    "Awaiting predictions — scale-to-zero cold start can take ~20–30s",
    "Parsing predictions[]",
  ]);
  // Live path (when serving + CE function exist): pattern4ce.runModelInference.
  // The endpoint is scale-to-zero, so the first call may cold-start (~20-30s) and
  // return no prediction; retry once (the replica is warming) before falling back.
  let r = null;
  if (window.domo && typeof window.domo.post === "function" && state.mlInferenceBridge) {
    try {
      r = await liveInfer(f);
      if (!r) {
        anim.note("Endpoint warming (scale-to-zero) — retrying…");
        await sleep(2000);
        r = await liveInfer(f);
      }
      state.mlServing = !!r;
    } catch (e) {
      console.warn("runModelInference failed; retrying once before fallback", e);
      try { await sleep(2000); r = await liveInfer(f); state.mlServing = !!r; }
      catch (e2) { console.warn("runModelInference retry failed; using local model", e2); state.mlServing = false; }
    }
  }
  if (!r) r = mockPredict(f);
  const elapsed = Math.round(((window.performance && performance.now) ? performance.now() : Date.now()) - t0);
  anim.finish(
    r.live ? `Scored in ${elapsed} ms · live · Model Serving v${ML_MODEL.version}` : `Scored in ${elapsed} ms · preview fallback (Model Serving unavailable)`,
    !!r.live
  );
  if (btn) { btn.disabled = false; btn.textContent = "Run prediction"; }
  if (tag) tag.textContent = r.live ? `live · Model Serving v${ML_MODEL.version}` : "modeled · preview";
  renderMlStatus();

  const pct = (r.probability * 100).toFixed(1);
  const ring = Math.round(r.probability * 100);
  host.innerHTML = `
    <div class="pred-top">
      <div class="pred-gauge" style="--p:${ring}">
        <div class="pred-gauge-val">${pct}<span>%</span></div>
        <div class="pred-gauge-cap">churn prob.</div>
      </div>
      <div class="pred-summary">
        <div class="pred-tier tier-${r.tier.toLowerCase()}">${r.tier} risk</div>
        <div class="pred-risk">${fmtCurrency(r.revenueAtRisk)} <span>revenue at risk</span></div>
        <div class="pred-action"><span>Recommended</span> ${escapeHtml(r.action)}</div>
      </div>
    </div>
    ${r.drivers && r.drivers.length ? `<div class="pred-drivers"><div class="pred-drivers-h">Top drivers</div>${r.drivers.map((d) => {
      const w = Math.min(100, Math.round((d.v / (r.drivers[0].v || 1)) * 100));
      return `<div class="driver"><span class="driver-k">${escapeHtml(d.k)}</span><span class="driver-bar"><span style="width:${w}%"></span></span></div>`;
    }).join("")}</div>` : ""}
    <div class="pred-feedback">
      <span>Was this right?</span>
      <button class="fb-btn" type="button" data-fb="accept">Accept</button>
      <button class="fb-btn" type="button" data-fb="adjust">Adjust</button>
      <button class="fb-btn" type="button" data-fb="reject">Reject</button>
      <span class="fb-note" id="mlFbNote"></span>
    </div>`;
  host.querySelectorAll(".fb-btn").forEach((b) =>
    b.addEventListener("click", async () => {
      const decision = b.getAttribute("data-fb");
      const note = document.getElementById("mlFbNote");
      host.querySelectorAll(".fb-btn").forEach((x) => x.classList.toggle("chosen", x === b));
      if (note) note.textContent = "Writing to Lakebase…";
      const entityId = `${f.region || "Unknown"} ${f.segment || "Account"}`;
      try {
        // 1) record the feedback row, and 2) seed a reviewable scenario from the inputs.
        await savePredictionFeedback({
          predictionId: `pred-${Date.now()}`,
          entityType: "account",
          entityId: entityId,
          feedback: decision,
          predictedValue: r.probability,
          correctedValue: null,
          comment: `Prediction ${decision} from ML Predictions (${Math.round(r.probability * 100)}% churn)`,
          createdBy: "demo.user@domo.com",
        });
        const seededId = await seedScenarioFromPrediction(f, r, decision);
        if (note) {
          note.innerHTML = "";
          const label = document.createElement("span");
          label.textContent = (state.lakebaseLive ? "Saved to Lakebase" : "Captured") + " — ";
          const link = document.createElement("button");
          link.type = "button";
          link.className = "fb-review-link";
          link.textContent = "Review scenario →";
          link.addEventListener("click", () => gotoLakebaseScenario(seededId));
          note.appendChild(label);
          note.appendChild(link);
        }
      } catch (error) {
        if (note) note.textContent = "Save failed — see console.";
        console.warn("Prediction feedback save failed", error);
      }
    })
  );
}

function renderMl() {
  renderMlStatus();
  renderMlForm();
  renderMlPayload();
  const note = document.getElementById("mlFormNote");
  if (note) note.textContent = state.mlServing
    ? "Calls pattern4ce.runModelInference → Databricks Model Serving."
    : "Live inference bridge is staged; if Code Engine or Model Serving is unavailable, this uses the preview fallback.";
  const btn = document.getElementById("mlRunBtn");
  if (btn && !btn.dataset.wired) { btn.addEventListener("click", runInference); btn.dataset.wired = "1"; }
  const form = document.getElementById("mlForm");
  if (form && !form.dataset.wired) {
    form.addEventListener("input", renderMlPayload);
    form.addEventListener("change", renderMlPayload);
    form.dataset.wired = "1";
  }
  const tabs = document.getElementById("mlCodeTabs");
  if (tabs && !tabs.dataset.wired) {
    tabs.addEventListener("click", (e) => {
      const b = e.target.closest("[data-codetab]");
      if (!b) return;
      state.mlCodeTab = b.getAttribute("data-codetab");
      tabs.querySelectorAll(".code-tab").forEach((x) => x.classList.toggle("active", x === b));
      renderMlPayload();
    });
    tabs.dataset.wired = "1";
  }
  const copy = document.getElementById("mlCodeCopy");
  if (copy && !copy.dataset.wired) {
    copy.addEventListener("click", () => {
      const block = document.getElementById("mlCodeBlock");
      copyTextToClipboard(block ? block.textContent : "");
      copy.textContent = "Copied";
      setTimeout(() => { copy.textContent = "Copy"; }, 1400);
    });
    copy.dataset.wired = "1";
  }
  const elink = document.getElementById("mlEndpointLink");
  if (elink && !elink.dataset.wired) {
    elink.addEventListener("click", () => openExternal(mlEndpointUrl()));
    elink.dataset.wired = "1";
  }
}

/* ---------- Lakebase Ops ---------- */

async function callPattern4ce(fnName, payload) {
  if (!window.domo || typeof window.domo.post !== "function") {
    throw new Error("Domo runtime unavailable");
  }
  // Domo's Code Engine proxy rejects an empty request body ("Required request body is
  // missing") for no-parameter functions (e.g. listScenarios / listPredictionFeedback),
  // which surfaces as a bare 400. Always send a non-empty body; undeclared keys are
  // ignored by the proxy's parameter mapping, so this is safe for every function.
  const body = payload && Object.keys(payload).length ? payload : { _ping: 1 };
  const response = await window.domo.post(`/domo/codeengine/v2/packages/${fnName}`, body);
  const output = unwrapCodeEngineResponse(response);
  if (output?.status === "FAILED" || output?.error) {
    throw new Error(typeof output.error === "string" ? output.error : JSON.stringify(output.error || output));
  }
  return output;
}

function normalizeScenario(row) {
  const results = typeof row.results === "string" ? safeJson(row.results, {}) : (row.results || {});
  const assumptions = typeof row.assumptions === "string" ? safeJson(row.assumptions, {}) : (row.assumptions || {});
  return {
    ...row,
    id: Number(row.id),
    status: row.status || "draft",
    assumptions,
    results,
    delta: Number(row.delta ?? results.forecast_delta ?? results.delta_forecast ?? 0),
  };
}

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

async function loadLakebaseLive() {
  try {
    const [scenarioResult, feedbackResult] = await Promise.all([
      callPattern4ce("listScenarios", { limit: 50 }),
      callPattern4ce("listPredictionFeedback", { limit: 50 }),
    ]);
    state.lakebase.scenarios = (scenarioResult.rows || []).map(normalizeScenario);
    state.lakebase.feedback = feedbackResult.rows || [];
    state.lakebaseLive = true;
    state.lakebase.error = "";
  } catch (error) {
    console.warn("Lakebase live load failed; using preview data", error);
    state.lakebaseLive = false;
    state.lakebase.error = error.message || "Lakebase live load failed";
    state.lakebase.scenarios = LAKEBASE_MOCK.scenarios.slice();
    state.lakebase.feedback = LAKEBASE_MOCK.feedback.slice();
  }
  if (!state.lakebase.selectedScenarioId && state.lakebase.scenarios[0]) {
    state.lakebase.selectedScenarioId = state.lakebase.scenarios[0].id;
  }
  renderLakebase();
}

/* ---------- Lakebase explorer (table CRUD, à la lakebase explorer) ---------- */

const LAKEBASE_TABLES = [
  {
    key: "scenarios",
    label: "Scenario Runs",
    table: "public.p4_scenario_runs",
    desc: "What-if forecast scenarios. Saved automatically when you accept a model prediction on the ML Predictions tab — or add one here. Full read / write.",
    canEdit: true,
    canDelete: true,
    fields: [
      { key: "name", label: "Scenario name", required: true },
      { key: "status", label: "Status", type: "select", options: ["draft", "running", "complete", "archived"] },
      { key: "created_by", label: "Created by", value: "demo.user@domo.com" },
      { key: "delta", label: "Forecast delta (USD)", type: "number" },
      { key: "assumptions", label: "Assumptions (JSON)", type: "json", full: true },
    ],
  },
  {
    key: "feedback",
    label: "Prediction Feedback",
    table: "public.p4_prediction_feedback",
    desc: "Human accept / adjust / reject on model predictions. Written from the ML Predictions tab; you can also add a row here.",
    canEdit: false,
    canDelete: false,
    editNote: "Editing & deleting feedback rows needs a pattern4ce CE function — staged, enable on release.",
    fields: [
      { key: "entity_id", label: "Account / entity", required: true, value: "West Enterprise" },
      { key: "entity_type", label: "Entity type", value: "account" },
      { key: "feedback", label: "Feedback", type: "select", options: ["accept", "adjust", "reject"] },
      { key: "predicted_value", label: "Predicted churn (0–1)", type: "number" },
      { key: "corrected_value", label: "Corrected churn (0–1)", type: "number" },
      { key: "comment", label: "Comment", full: true },
      { key: "created_by", label: "Created by", value: "demo.user@domo.com" },
    ],
  },
];

function activeLakebaseTable() {
  return LAKEBASE_TABLES.find((t) => t.key === state.lakebase.activeTable) || LAKEBASE_TABLES[0];
}

function lakebaseRowsFor(cfg) {
  return cfg.key === "scenarios" ? state.lakebase.scenarios : state.lakebase.feedback;
}

function lakebaseBanner(type, msg) {
  state.lakebase.banner = { type: type, msg: msg };
  renderLakebaseBanner();
  if (type === "success") {
    clearTimeout(lakebaseBanner._t);
    lakebaseBanner._t = setTimeout(() => { state.lakebase.banner = null; renderLakebaseBanner(); }, 3500);
  }
}

function renderLakebaseBanner() {
  const host = document.getElementById("lakebaseBanner");
  if (!host) return;
  const b = state.lakebase.banner;
  host.innerHTML = b
    ? `<div class="lb-banner ${b.type}"><span>${escapeHtml(b.msg)}</span><button type="button" aria-label="Dismiss">×</button></div>`
    : "";
  host.querySelector("button")?.addEventListener("click", () => { state.lakebase.banner = null; renderLakebaseBanner(); });
}

function renderLakebase() {
  const stateEl = document.getElementById("lakebaseState");
  if (stateEl) {
    // Only surface the live badge; never show a "planned/mock" placeholder.
    stateEl.textContent = state.lakebaseLive ? "Live · cobra-v1" : "";
    stateEl.classList.toggle("live", !!state.lakebaseLive);
    stateEl.style.display = state.lakebaseLive ? "" : "none";
  }
  const grid = document.getElementById("lakebaseMetaGrid");
  if (grid) {
    const meta = [
      ["Project", "projects/cobra-v1"],
      ["Database", "databricks_postgres"],
      ["Tables", "p4_scenario_runs · p4_prediction_feedback"],
      ["Access", "pattern4ce → node-postgres (SP M2M)"],
      ["Mode", state.lakebaseLive ? "Live read/write" : "Preview fallback — re-add card to go live"],
    ];
    grid.innerHTML = meta.map(([k, v]) => `<div class="ml-meta"><span class="ml-meta-k">${escapeHtml(k)}</span><span class="ml-meta-v">${escapeHtml(v)}</span></div>`).join("");
  }

  const nav = document.getElementById("lakebaseTableNav");
  if (nav) {
    nav.innerHTML = LAKEBASE_TABLES.map((t) => `
      <button class="lb-tab ${t.key === state.lakebase.activeTable ? "active" : ""}" type="button" data-lb-table="${t.key}">
        ${escapeHtml(t.label)}<span class="lb-tab-count">${lakebaseRowsFor(t).length}</span>
      </button>`).join("");
    nav.querySelectorAll("[data-lb-table]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.lakebase.activeTable = btn.getAttribute("data-lb-table");
        state.lakebase.formOpen = false;
        state.lakebase.editingRow = null;
        renderLakebase();
      });
    });
  }

  renderLakebaseBanner();
  renderLakebaseTable();
  renderLakebaseForm();
  renderScenarioDetail();

  const refresh = document.getElementById("lakebaseRefreshBtn");
  if (refresh && !refresh.dataset.wired) {
    refresh.addEventListener("click", async () => {
      await loadLakebaseLive();
      if (state.lakebaseLive) {
        lakebaseBanner("success", "Refreshed live from Lakebase.");
      } else {
        lakebaseBanner("warn", "Still in preview fallback — re-instantiate the App Studio card to bind the live Code Engine context." + (state.lakebase.error ? " (" + state.lakebase.error + ")" : ""));
      }
    });
    refresh.dataset.wired = "1";
  }
  const add = document.getElementById("lakebaseAddBtn");
  if (add && !add.dataset.wired) {
    add.addEventListener("click", () => { state.lakebase.editingRow = null; state.lakebase.formOpen = true; renderLakebaseForm(); });
    add.dataset.wired = "1";
  }
  const open = document.getElementById("lakebaseOpenBtn");
  if (open && !open.dataset.wired) {
    open.addEventListener("click", () => openExternal(LAKEBASE_PROJECT_LINK));
    open.dataset.wired = "1";
  }
}

function renderLakebaseTable() {
  const cfg = activeLakebaseTable();
  const rows = lakebaseRowsFor(cfg);
  const title = document.getElementById("lakebaseTableTitle");
  if (title) title.textContent = cfg.label;
  const count = document.getElementById("lakebaseRowCount");
  if (count) count.textContent = `${rows.length} row${rows.length === 1 ? "" : "s"}`;
  const name = document.getElementById("lakebaseTableName");
  if (name) name.textContent = cfg.table;
  const desc = document.getElementById("lakebaseTableDesc");
  if (desc) desc.textContent = cfg.desc;

  const head = document.getElementById("lakebaseHead");
  const body = document.getElementById("lakebaseBody");
  if (!head || !body) return;

  if (cfg.key === "scenarios") {
    head.innerHTML = `<tr><th>Scenario</th><th>Status</th><th>Created by</th><th class="num">Δ Forecast</th><th class="lb-actions-col">Actions</th></tr>`;
    body.innerHTML = rows.length
      ? rows.map((s) => `
        <tr class="${state.lakebase.selectedScenarioId === s.id ? "selected-row" : ""}" data-row-id="${s.id}">
          <td><strong>${escapeHtml(s.name)}</strong><div class="row-sub">${escapeHtml(s.created_at ? new Date(s.created_at).toLocaleDateString() : "Lakebase scenario")}</div></td>
          <td><span class="status ${escapeHtml(s.status)}">${escapeHtml(s.status)}</span></td>
          <td>${escapeHtml(s.created_by)}</td>
          <td class="num ${s.delta >= 0 ? "pos" : "neg"}">${s.delta >= 0 ? "+" : ""}${fmtCurrency(s.delta)}</td>
          <td class="lb-actions-col">
            <button class="btn-icon" type="button" title="Edit" data-row-edit="${s.id}">✎</button>
            <button class="btn-icon btn-icon-danger" type="button" title="Delete" data-row-delete="${s.id}">✕</button>
          </td>
        </tr>`).join("")
      : `<tr><td colspan="5" class="empty-state">No scenario runs yet — accept a prediction on ML Predictions, or click "+ Add row".</td></tr>`;
  } else {
    head.innerHTML = `<tr><th>Account</th><th>Feedback</th><th class="num">Predicted</th><th>Comment</th><th>Created by</th><th class="lb-actions-col">Actions</th></tr>`;
    body.innerHTML = rows.length
      ? rows.map((f) => {
          const pred = f.predicted_value != null ? `${Math.round(Number(f.predicted_value) * 100)}%` : "—";
          return `
        <tr>
          <td><strong>${escapeHtml(f.entity_id || f.account || "Prediction")}</strong></td>
          <td><span class="fb-tag ${escapeHtml(f.feedback || "adjust")}">${escapeHtml(f.feedback || "—")}</span></td>
          <td class="num">${pred}</td>
          <td class="col-ctx">${escapeHtml(f.comment || f.note || "—")}</td>
          <td>${escapeHtml(f.created_by || f.by || "demo.user@domo.com")}</td>
          <td class="lb-actions-col">
            <button class="btn-icon" type="button" title="${escapeHtml(cfg.editNote)}" disabled>✎</button>
            <button class="btn-icon btn-icon-danger" type="button" title="${escapeHtml(cfg.editNote)}" disabled>✕</button>
          </td>
        </tr>`;
        }).join("")
      : `<tr><td colspan="6" class="empty-state">No prediction feedback yet. Open ML Predictions, run a score, then Accept / Adjust / Reject.</td></tr>`;
    if (cfg.editNote) {
      body.innerHTML += `<tr><td colspan="6" class="lb-staged-note">${escapeHtml(cfg.editNote)}</td></tr>`;
    }
  }

  body.querySelectorAll("[data-row-id]").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      state.lakebase.selectedScenarioId = Number(row.getAttribute("data-row-id"));
      renderLakebase();
    });
  });
  body.querySelectorAll("[data-row-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-row-edit"));
      state.lakebase.editingRow = state.lakebase.scenarios.find((s) => s.id === id) || null;
      state.lakebase.formOpen = true;
      renderLakebaseForm();
    });
  });
  body.querySelectorAll("[data-row-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteScenario(Number(btn.getAttribute("data-row-delete"))));
  });
}

function lakebaseFieldDefault(field, row) {
  if (row) {
    if (field.key === "delta") return row.delta != null ? row.delta : "";
    if (field.key === "assumptions") return JSON.stringify(row.assumptions || {}, null, 2);
    return row[field.key] != null ? row[field.key] : "";
  }
  if (field.key === "assumptions") return JSON.stringify({ source: "manual", region: "West" }, null, 2);
  return field.value != null ? field.value : (field.type === "select" ? field.options[0] : "");
}

function renderLakebaseForm() {
  const host = document.getElementById("lakebaseFormHost");
  if (!host) return;
  if (!state.lakebase.formOpen) {
    host.classList.add("is-hidden");
    host.innerHTML = "";
    return;
  }
  const cfg = activeLakebaseTable();
  const editing = state.lakebase.editingRow;
  const title = editing ? `Edit ${cfg.label.replace(/s$/, "")} #${editing.id}` : `Add ${cfg.label.replace(/ Runs| Feedback/, "").toLowerCase()} row`;
  const fieldHtml = cfg.fields.map((f) => {
    const val = escapeHtml(String(lakebaseFieldDefault(f, editing)));
    const cls = `lb-field ${f.full ? "full" : ""}`;
    if (f.type === "select") {
      const opts = f.options.map((o) => `<option ${o === lakebaseFieldDefault(f, editing) ? "selected" : ""}>${escapeHtml(o)}</option>`).join("");
      return `<label class="${cls}"><span>${escapeHtml(f.label)}</span><select data-field="${f.key}">${opts}</select></label>`;
    }
    if (f.type === "json") {
      return `<label class="${cls}"><span>${escapeHtml(f.label)}</span><textarea data-field="${f.key}" rows="3">${val}</textarea></label>`;
    }
    const type = f.type === "number" ? 'type="number" step="any"' : 'type="text"';
    return `<label class="${cls}"><span>${escapeHtml(f.label)}</span><input ${type} data-field="${f.key}" value="${val}" ${f.required ? "required" : ""} /></label>`;
  }).join("");
  host.classList.remove("is-hidden");
  host.innerHTML = `
    <div class="lb-form-head"><h4>${escapeHtml(title)}</h4><button type="button" class="pill-btn ghost" id="lbFormCancel">Cancel</button></div>
    <form class="lakebase-form" id="lbForm">
      ${fieldHtml}
      <div class="form-actions full"><button class="btn btn-primary" type="submit" id="lbFormSave">${editing ? "Save changes" : "Add to Lakebase"}</button></div>
    </form>`;
  host.querySelector("#lbFormCancel").addEventListener("click", () => { state.lakebase.formOpen = false; state.lakebase.editingRow = null; renderLakebaseForm(); });
  host.querySelector("#lbForm").addEventListener("submit", saveLakebaseRow);
}

function collectLbForm() {
  const out = {};
  document.querySelectorAll("#lbForm [data-field]").forEach((el) => { out[el.getAttribute("data-field")] = el.value; });
  return out;
}

async function saveLakebaseRow(event) {
  event.preventDefault();
  const cfg = activeLakebaseTable();
  const data = collectLbForm();
  const saveBtn = document.getElementById("lbFormSave");
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving…"; }
  try {
    if (cfg.key === "scenarios") {
      const editing = state.lakebase.editingRow;
      const delta = Number(data.delta || 0);
      const payload = {
        id: editing ? editing.id : undefined,
        name: data.name,
        status: data.status,
        createdBy: data.created_by,
        assumptions: safeJson(data.assumptions, {}),
        results: { forecast_delta: delta, source: "Revenue Command Center" },
      };
      if (state.lakebaseLive) {
        const result = await callPattern4ce(editing ? "updateScenario" : "createScenario", payload);
        const row = normalizeScenario((result.rows && result.rows[0]) || result.row || payload);
        if (editing) state.lakebase.scenarios = state.lakebase.scenarios.map((s) => s.id === editing.id ? row : s);
        else { state.lakebase.scenarios.unshift(row); state.lakebase.selectedScenarioId = row.id; }
      } else if (editing) {
        state.lakebase.scenarios = state.lakebase.scenarios.map((s) => s.id === editing.id ? normalizeScenario({ ...s, ...payload, delta }) : s);
      } else {
        const next = normalizeScenario({ ...payload, id: Date.now(), delta });
        state.lakebase.scenarios.unshift(next);
        state.lakebase.selectedScenarioId = next.id;
      }
      if (state.lakebaseLive) {
        lakebaseBanner("success", editing ? "Scenario updated in Lakebase." : "Scenario written to Lakebase.");
      } else {
        lakebaseBanner("warn", "Preview only — NOT written to Lakebase. The app is in preview fallback; re-instantiate the App Studio card to enable live writes.");
      }
    } else {
      const payload = {
        predictionId: `manual-${Date.now()}`,
        entityType: data.entity_type || "account",
        entityId: data.entity_id,
        feedback: data.feedback || "adjust",
        predictedValue: data.predicted_value === "" ? null : Number(data.predicted_value),
        correctedValue: data.corrected_value === "" ? null : Number(data.corrected_value),
        comment: data.comment || "",
        createdBy: data.created_by || "demo.user@domo.com",
      };
      if (state.lakebaseLive) {
        await callPattern4ce("savePredictionFeedback", payload);
        await loadLakebaseLive();
      } else {
        state.lakebase.feedback.unshift({
          entity_id: payload.entityId, feedback: payload.feedback, predicted_value: payload.predictedValue,
          comment: payload.comment, created_by: payload.createdBy,
        });
      }
      lakebaseBanner(
        state.lakebaseLive ? "success" : "warn",
        state.lakebaseLive
          ? "Prediction feedback written to Lakebase."
          : "Preview only — NOT written to Lakebase. The app is in preview fallback; re-instantiate the App Studio card to enable live writes.",
      );
    }
    state.lakebase.formOpen = false;
    state.lakebase.editingRow = null;
    renderLakebase();
  } catch (error) {
    console.warn("Lakebase save failed", error);
    lakebaseBanner("error", error.message || "Unable to write to Lakebase.");
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Add to Lakebase"; }
  }
}

function renderScenarioDetail() {
  const detail = document.getElementById("scenarioDetail");
  if (!detail) return;
  if (state.lakebase.activeTable !== "scenarios") { detail.innerHTML = ""; return; }
  const scenario = state.lakebase.scenarios.find((s) => s.id === state.lakebase.selectedScenarioId) || state.lakebase.scenarios[0];
  if (!scenario) { detail.innerHTML = ""; return; }
  const assumptionText = JSON.stringify(scenario.assumptions || {}, null, 2);
  const resultText = JSON.stringify(scenario.results || {}, null, 2);
  detail.innerHTML = `
    <div class="scenario-detail-head">
      <div><span class="panel-tag">selected run</span><h3>${escapeHtml(scenario.name)}</h3></div>
      <div class="toolbar-right">
        <button class="btn btn-secondary btn-sm" type="button" data-open-url="${escapeHtml(LAKEBASE_PROJECT_LINK)}">Open Lakebase</button>
        <button class="btn btn-secondary btn-sm" type="button" data-open-url="${escapeHtml(LAKEBASE_TABLES_LINK)}">Open source table</button>
        <button class="btn btn-secondary btn-sm" type="button" data-scenario-edit="${scenario.id}">Edit selected</button>
      </div>
    </div>
    <div class="scenario-json-grid">
      <div><b>Assumptions</b><pre>${escapeHtml(assumptionText)}</pre></div>
      <div><b>Results</b><pre>${escapeHtml(resultText)}</pre></div>
    </div>`;
  detail.querySelector("[data-scenario-edit]")?.addEventListener("click", () => {
    state.lakebase.editingRow = scenario;
    state.lakebase.formOpen = true;
    renderLakebaseForm();
  });
  detail.querySelectorAll("[data-open-url]").forEach((btn) => {
    btn.addEventListener("click", () => openExternal(btn.getAttribute("data-open-url")));
  });
}

async function deleteScenario(id) {
  if (!id) return;
  try {
    if (state.lakebaseLive) await callPattern4ce("deleteScenario", { id });
    state.lakebase.scenarios = state.lakebase.scenarios.filter((s) => s.id !== id);
    state.lakebase.selectedScenarioId = state.lakebase.scenarios[0]?.id || null;
    lakebaseBanner(
      state.lakebaseLive ? "success" : "warn",
      state.lakebaseLive ? "Scenario deleted from Lakebase." : "Preview only — change not persisted (preview fallback).",
    );
    renderLakebase();
  } catch (error) {
    console.warn("Scenario delete failed", error);
    lakebaseBanner("error", error.message || "Unable to delete scenario.");
  }
}

// Called from ML Predictions when a user accepts/adjusts/rejects — seeds a reviewable
// scenario from the scored inputs + prediction, then deep-links to it on the Lakebase tab.
async function seedScenarioFromPrediction(features, prediction, decision) {
  const pct = Math.round((Number(prediction.probability) || 0) * 100);
  const name = `${features.region || "Account"} ${features.segment || ""} — ${decision} @ ${pct}% churn`.trim();
  const payload = {
    name: name,
    status: decision === "accept" ? "complete" : decision === "reject" ? "archived" : "running",
    createdBy: "demo.user@domo.com",
    assumptions: { source: "ml_prediction", decision: decision, source_table: "gold_customer_renewal_risk", inputs: features },
    results: {
      predicted_churn_probability: Number((Number(prediction.probability) || 0).toFixed(4)),
      revenue_at_risk: Math.round(Number(prediction.revenueAtRisk) || 0),
      tier: prediction.tier,
      recommended_action: prediction.action,
    },
  };
  try {
    if (state.lakebaseLive) {
      const result = await callPattern4ce("createScenario", payload);
      const row = normalizeScenario((result.rows && result.rows[0]) || result.row || payload);
      state.lakebase.scenarios.unshift(row);
      state.lakebase.selectedScenarioId = row.id;
    } else {
      const next = normalizeScenario({ ...payload, id: Date.now(), delta: 0 });
      state.lakebase.scenarios.unshift(next);
      state.lakebase.selectedScenarioId = next.id;
    }
    renderLakebase();
    return state.lakebase.selectedScenarioId;
  } catch (error) {
    console.warn("Scenario seed failed", error);
    return null;
  }
}

function gotoLakebaseScenario(id) {
  state.lakebase.activeTable = "scenarios";
  if (id) state.lakebase.selectedScenarioId = id;
  activateView("lakebase");
  renderLakebase();
}

async function savePredictionFeedback(feedback) {
  if (state.lakebaseLive) {
    const result = await callPattern4ce("savePredictionFeedback", feedback);
    const row = (result.rows && result.rows[0]) || result.row || feedback;
    state.lakebase.feedback.unshift(row);
  } else {
    state.lakebase.feedback.unshift({
      id: Date.now(),
      entity_id: feedback.entityId,
      feedback: feedback.feedback,
      note: feedback.comment,
      by: feedback.createdBy,
      predicted_value: feedback.predictedValue,
    });
  }
  renderLakebase();
}

/* ---------- How It Works: architecture + user guide ---------- */

const ICONS = {
  data: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/></svg>',
  sync: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11a8 8 0 0 1 13.7-5.7L20 7"/><path d="M20 13a8 8 0 0 1-13.7 5.7L4 17"/><path d="M20 4v3h-3"/><path d="M4 20v-3h3"/></svg>',
  dataset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z"/><path d="m3 12 9 4.5L21 12"/><path d="m3 16.5 9 4.5 9-4.5"/></svg>',
  app: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/></svg>',
  genie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 12a8 8 0 0 1-11 7.4L4.5 20l.7-4.2A8 8 0 1 1 20.5 12Z"/><path d="m12 8 1 2.2 2.2 1-2.2 1L12 14.4l-1-2.2-2.2-1 2.2-1L12 8Z"/></svg>',
  gateway: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v5c0 4.3 3 7.5 7 9 4-1.5 7-4.7 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
  action: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3 5 13h5l-1 8 8-10h-5l1-8Z"/></svg>',
  model: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 14 3-4 3 3 4-6"/><circle cx="20" cy="7" r="1.4" fill="currentColor" stroke="none"/></svg>',
  lakebase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5.5" rx="7" ry="2.6"/><path d="M5 5.5v13c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6v-13"/><path d="M5 12c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6"/><path d="m11 15 1.6 1.6L16 13"/></svg>',
};

const FLOW_STAGES = [
  {
    id: "uc", name: "Unity Catalog Gold", sub: "Governed source of truth", plane: "dbx", icon: "data",
    lead: "The single source of truth. Six governed gold views in databricks_raptor.pattern4_agent_automation define revenue, renewal risk, incidents, the forecast time series, actions, and access.",
    bullets: ["Metric views + gold tables over medallion data", "UC comments, tags & synonyms are the AI Readiness source", "Same definitions feed Genie, the model, and Domo — no metric drift"],
    input: "Bronze / Silver Delta",
    output: "6 governed gold views",
    governed: "Unity Catalog — permissions, lineage, ABAC",
  },
  {
    id: "ca", name: "Cloud Amplifier", sub: "Live federation, no copy", plane: "both", icon: "sync",
    lead: "Domo queries the gold views live inside Databricks through the Databricks Raptor AWS integration — no data is copied into Domo storage.",
    bullets: ["Live federated read against Databricks SQL", "~15-min metadata polling drives alerts/flows", "Auto-cache for UI speed"],
    input: "Unity Catalog gold views",
    output: "Live federated Domo datasets",
    governed: "Databricks Raptor AWS · a83b5bbc…",
  },
  {
    id: "ds", name: "Domo DataSets", sub: "5 alias-mapped views", plane: "domo", icon: "dataset",
    lead: "The gold views surface in Domo as direct-federated DataSets, mapped to the pro-code app by stable aliases.",
    bullets: ["executiveRevenueHealth · customerRenewalRisk · incidentRevenueImpact", "agentActionQueue · portalUserScope", "PDP-ready for per-persona scoping"],
    input: "Cloud Amplifier connection",
    output: "5 alias-mapped DataSets",
    governed: "Domo PDP ↔ UC row filters",
  },
  {
    id: "app", name: "Pro-code Portal", sub: "Forecast-first command center", plane: "domo", icon: "app",
    lead: "This application. A persona-scoped command center across six tabs: Forecast Home, ML Predictions, Lakebase Ops, AI Readiness, Genie Workspace, and How It Works.",
    bullets: ["Reads DataSets by alias (Query API)", "Calls Databricks server-side via Code Engine (pattern4ce)", "Domo styleguide UI, Databricks-governed data + intelligence"],
    input: "Domo DataSets + Code Engine",
    output: "Executive command center",
    governed: "Domo SSO + PDP",
  },
  {
    id: "ml", name: "Model Serving", sub: "Renewal-risk regressor v6", plane: "dbx", icon: "model",
    lead: "Databricks predicts. An MLflow/UC-registered HGB regressor (pattern4_renewal_risk v6) is served at pattern4-renewal-risk and returns a smooth churn probability for any account scored from the app.",
    bullets: ["Trained on gold_customer_renewal_risk; registered in Unity Catalog", "Ad hoc scoring via pattern4ce.runModelInference (token stays server-side)", "App shows the live request as cURL / Python / SQL"],
    input: "Account features (dataframe_records)",
    output: "Churn probability + revenue at risk",
    governed: "Unity Catalog model + Model Serving",
  },
  {
    id: "genie", name: "Databricks Genie", sub: "Natural-language reasoning", plane: "dbx", icon: "genie",
    lead: "Genie explains. It answers 'why did this change?' in natural language over the exact same governed gold views, returning a cited root cause, generated SQL, and result rows the app charts.",
    bullets: ["Live Conversation API via pattern4ce.askGenie", "Genie Space instructions encode the business context", "Answers cite governed metrics + generated SQL"],
    input: "User question + UC context",
    output: "Root-cause answer + SQL + rows",
    governed: "Unity Catalog + Genie Space",
  },
  {
    id: "lakebase", name: "Lakebase", sub: "Operational state (OLTP)", plane: "dbx", icon: "lakebase",
    lead: "Lakebase remembers. App-owned operational state — saved what-if scenarios and human prediction feedback — lives in Lakebase Postgres next to the lakehouse, not in a spreadsheet.",
    bullets: ["cobra-v1 · p4_scenario_runs + p4_prediction_feedback", "CRUD via pattern4ce (node-postgres, SP M2M)", "Low-latency state, separate from governed analytic gold"],
    input: "Scenario saves + prediction feedback",
    output: "Durable operational state",
    governed: "Lakebase roles + service principal",
  },
  {
    id: "gw", name: "Unity AI Gateway", sub: "Governed model + LLM calls", plane: "both", icon: "gateway",
    lead: "The governance boundary for AI calls. Unity AI Gateway is live on the renewal-risk model endpoint (usage tracking + rate limits + inference-table audit) and on a guardrailed LLM reasoning endpoint (pattern4-reasoning-gateway) with input/output safety + PII filters. The app's AI rationale is generated through it.",
    bullets: ["Live on pattern4-renewal-risk: usage tracking, 120/min rate limit, payload inference table", "Live on pattern4-reasoning-gateway: guardrails (input safety + PII block · output safety + PII mask), usage + audit", "OBO note: calls run as a governed service principal today; per-user OBO needs Databricks U2M OAuth / token federation (the embedded Domo app carries a Domo identity, not a Databricks one)"],
    input: "Model + LLM tool calls",
    output: "Governed, audited, guardrailed responses",
    governed: "Unity AI Gateway — usage, rate limits, guardrails, inference tables",
  },
  {
    id: "act", name: "Agent ⇄ Agent + Workflow", sub: "Domo agent calls a Databricks agent", plane: "domo", icon: "action",
    lead: "Agent-to-agent. Approve & execute starts a live, governed Domo Workflow (Renewal Risk Retention). Inside it, a Domo AI Agent tile calls a Databricks Agent Bricks Supervisor Agent (which reasons over governed gold views via Genie) to produce a retention recommendation; a human approves it in Domo Tasks; then a service task writes status back to the lakehouse.",
    bullets: ["Domo AI Agent tile → pattern4ce.askRetentionAgent → Databricks Supervisor Agent (mas-…, Genie-backed)", "Approve & execute → startRetentionWorkflow starts the workflow server-side (run id captured)", "Human approval → writeActionStatus writes Approved/Executed or Rejected to agent_action_writeback (Delta); CE writeback is the fallback", "Go to source: every agent decision is traced in MLflow; open the agent + its activity log straight from the Agent Action Queue"],
    input: "Genie reasoning + model scores",
    output: "Approved action + status writeback",
    governed: "Domo RBAC + approval gates",
  },
];

const GUIDE_STEPS = [
  { title: "Choose your persona", desc: "Use the Viewing as menu. The view rescopes to your region or accounts — the same entitlement enforced by UC row filters and Domo PDP." },
  { title: "Read the Forecast Home", desc: "KPIs (Net Revenue, Revenue at Risk, Protected Revenue, SLA Breaches), the Actual-vs-Forecast hero with confidence band, and the Regional Renewal Risk hotspot give your scope at a glance." },
  { title: "Score an account (ML Predictions)", desc: "Databricks predicts: enter account features and Run prediction. The renewal-risk regressor v6 returns a churn probability live via Model Serving; the payload panel shows the exact cURL / Python / SQL." },
  { title: "Ask Genie why", desc: "Genie explains: ask the lakehouse a natural-language question. It returns a cited root cause and generated SQL over the same governed data; Inspect shows the API call." },
  { title: "Approve an action (writeback)", desc: "Domo acts: the Agent Action Queue lists Genie- and model-informed recommendations. Approve & execute writes status back to the lakehouse and Protected Revenue updates in the portal." },
  { title: "Keep operational state (Lakebase)", desc: "Save what-if scenarios and accept/adjust/reject prediction feedback. These persist in Lakebase Postgres next to the lakehouse, so context survives across sessions." },
  { title: "Govern AI Readiness", desc: "Unity Catalog is the source of truth. Sync prepared column metadata into Domo AI Readiness per column or dataset; editing UC source context is a separate, governed action in the inspector drawer." },
  { title: "Trust the governance", desc: "Lineage shows live federation via Cloud Amplifier — no copies. Unity Catalog, Unity AI Gateway, and Domo PDP enforce access end to end." },
];

const ARCH = {
  dbx: [
    { name: "Unity Catalog", sub: "Governance, lineage, ABAC · source of truth" },
    { name: "Delta gold views", sub: "Revenue, risk, incidents, forecast, actions" },
    { name: "Genie Space", sub: "NL access to governed metrics" },
    { name: "Model Serving + MLflow", sub: "Renewal-risk regressor v6" },
    { name: "Agent Bricks Supervisor", sub: "Pattern 4 Retention Supervisor · Genie-backed (live)" },
    { name: "Unity AI Gateway", sub: "Governs model + MCP calls (roadmap)" },
    { name: "Lakebase", sub: "Operational state + OLTP (cobra-v1)" },
    { name: "External lineage", sub: "gold_* → Domo command center" },
  ],
  interop: [
    { name: "Cloud Amplifier", sub: "Databricks Raptor AWS · live query" },
    { name: "Code Engine (pattern4ce)", sub: "Genie · inference · Lakebase · writeback" },
    { name: "MCP", sub: "Agent ⇄ agent tool protocol (roadmap)" },
    { name: "Shared Identity", sub: "SSO / OAuth U2M / OBO" },
    { name: "Domo PDP ↔ UC filters", sub: "One entitlement model" },
  ],
  domo: [
    { name: "Pro-code App", sub: "6-tab command center · experience + action" },
    { name: "Domo DataSets", sub: "5 alias-mapped gold views" },
    { name: "ML Predictions", sub: "Ad hoc scoring + payload panel" },
    { name: "AI Readiness", sub: "UC → Domo control plane" },
    { name: "Agent Action Queue", sub: "Recommend → approve → writeback" },
    { name: "AI Service Layer", sub: "Databricks ML connector in Domo" },
  ],
};

const REQUIREMENTS = [
  { k: "Identity", v: "SSO · OAuth U2M · OBO" },
  { k: "Governance", v: "Unity Catalog + AI Gateway + Domo PDP" },
  { k: "Prediction", v: "MLflow model v6 · Model Serving" },
  { k: "Human-in-loop", v: "Sign-off on writes & actions" },
  { k: "Observability", v: "Audit · lineage · agent eval" },
  { k: "State", v: "Lakebase scenarios + feedback" },
];

function planeLabel(plane) {
  return plane === "dbx" ? "Databricks" : plane === "domo" ? "Domo" : "Interop";
}

function renderFlow() {
  const rail = document.getElementById("flowRail");
  rail.innerHTML = FLOW_STAGES.map((s, i) => `
      <button class="flow-stage ${s.plane}" type="button" data-id="${s.id}">
        <span class="flow-step-num">${i + 1}</span>
        <span class="stage-ic">${ICONS[s.icon]}</span>
        <span class="flow-plane ${s.plane}">${planeLabel(s.plane)}</span>
        <span class="stage-name">${s.name}</span>
        <span class="stage-sub">${s.sub}</span>
      </button>`).join("");
  rail.querySelectorAll(".flow-stage").forEach((el) => {
    el.addEventListener("click", () => selectStage(el.getAttribute("data-id")));
  });
  const lineage = document.getElementById("flowLineageLink");
  if (lineage && !lineage.dataset.wired) {
    lineage.addEventListener("click", () => openExternal(LINEAGE_URL));
    lineage.dataset.wired = "1";
  }
}

function selectStage(id) {
  const s = FLOW_STAGES.find((x) => x.id === id) || FLOW_STAGES[0];
  document.querySelectorAll(".flow-stage").forEach((el) => {
    el.classList.toggle("active", el.getAttribute("data-id") === s.id);
  });
  document.getElementById("flowDetail").innerHTML = `
    <div>
      <h3>${s.name}</h3>
      <p class="lead">${s.lead}</p>
      <ul>${s.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>
    </div>
    <div class="flow-io">
      <div class="io-cell"><div class="io-k">Input</div><div class="io-v">${s.input}</div></div>
      <div class="io-cell"><div class="io-k">Output</div><div class="io-v">${s.output}</div></div>
      <div class="io-cell"><div class="io-k">Governed by</div><div class="io-v">${s.governed}</div></div>
    </div>`;
}

function renderGuideSteps() {
  document.getElementById("guideGrid").innerHTML = GUIDE_STEPS.map(
    (st, i) => `
      <div class="guide-step">
        <div class="guide-num">${i + 1}</div>
        <div>
          <h3>${st.title}</h3>
          <p>${st.desc}</p>
        </div>
      </div>`
  ).join("");
}

function renderArchitecture() {
  const comps = (list) =>
    list.map((c) => `<div class="comp"><b>${c.name}</b><span>${c.sub}</span></div>`).join("");
  document.getElementById("archGrid").innerHTML = `
    <div class="arch-col dbx">
      <div class="arch-col-head"><span class="hdot"></span>Databricks · Governed Intelligence</div>
      ${comps(ARCH.dbx)}
    </div>
    <div class="arch-col interop">
      <div class="arch-col-head"><span class="hdot"></span>Interop &amp; Governance</div>
      ${comps(ARCH.interop)}
    </div>
    <div class="arch-col domo">
      <div class="arch-col-head"><span class="hdot"></span>Domo · Activation &amp; Action</div>
      ${comps(ARCH.domo)}
    </div>`;
  document.getElementById("reqRow").innerHTML = REQUIREMENTS.map(
    (r) => `<div class="req"><b>${r.k}</b><span>${r.v}</span></div>`
  ).join("");
}

function renderGuide() {
  renderFlow();
  selectStage(FLOW_STAGES[0].id);
  renderGuideSteps();
  renderArchitecture();
}

async function loadReadiness() {
  try {
    const res = await fetch("./public/ai-readiness-detail.json", { cache: "no-store" });
    if (!res.ok) throw new Error("missing readiness summary");
    state.readiness = await res.json();
  } catch (error) {
    state.readiness = DATASETS.map((d) => ({
      alias: d.alias,
      datasetId: d.dataSetId,
      object: d.object,
      context: `${d.name} readiness context from Unity Catalog.`,
      synonymCount: 0,
      aiEnabledCount: 0,
      columnCount: 0,
      tagCount: 0,
      domoReadinessEnabled: false,
      domoSyncedColumns: [],
      columns: [],
    }));
  }
  loadReadinessLocalState();
}

function readinessStorageKey() {
  return "pattern4.aiReadiness.columnSync.v1";
}

function loadReadinessLocalState() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(readinessStorageKey()) || "{}");
    state.readinessColumnSync = stored && typeof stored === "object" ? stored : {};
  } catch (_) {
    state.readinessColumnSync = {};
  }
}

function persistReadinessLocalState() {
  try {
    window.localStorage.setItem(readinessStorageKey(), JSON.stringify(state.readinessColumnSync));
  } catch (_) {}
}

function getReadinessColumns(item) {
  return Array.isArray(item?.columns) ? item.columns : [];
}

function getUcReadyColumns(item) {
  return getReadinessColumns(item).filter((c) => c.aiEnabled).map((c) => c.name);
}

function getDomoSyncedColumns(item) {
  if (item?.domoReadinessLoaded) {
    return new Set(item.domoSyncedColumns || []);
  }
  if (window.domo && typeof window.domo.post === "function") {
    return new Set(item?.domoSyncedColumns || []);
  }
  const local = state.readinessColumnSync[item.alias];
  const source = Array.isArray(local) ? local : (item.domoSyncedColumns || []);
  return new Set(source);
}

function setDomoSyncedColumns(alias, columns) {
  state.readinessColumnSync[alias] = Array.from(new Set(columns)).sort();
  state.readinessSynced = Object.values(state.readinessColumnSync).some((cols) => Array.isArray(cols) && cols.length > 0);
  persistReadinessLocalState();
}

function applyDomoReadinessState(item, readiness) {
  if (!item || !readiness) return;
  const columns = Array.isArray(readiness.columns) ? readiness.columns : [];
  item.domoReadinessLoaded = true;
  item.domoReadinessEnabled = columns.some((col) => col.agentEnabled);
  item.domoSyncedColumns = columns.filter((col) => col.agentEnabled).map((col) => col.name);
  item.domoReadiness = readiness;
  state.readinessColumnSync[item.alias] = item.domoSyncedColumns.slice();
  persistReadinessLocalState();
}

async function refreshDomoReadinessForItem(item) {
  if (!item?.datasetId) return null;
  try {
    const result = await callPattern4ce("getDomoAiReadiness", { datasetId: item.datasetId });
    if (result?.status === "SUCCEEDED") {
      applyDomoReadinessState(item, result.readiness);
      renderReadiness();
      return result.readiness;
    }
    throw new Error(result?.error ? JSON.stringify(result.error) : "Unable to load Domo AI Readiness");
  } catch (error) {
    console.warn("Domo AI Readiness live read unavailable; using staged state", error);
    return null;
  }
}

async function refreshDomoReadinessLive() {
  if (!window.domo || typeof window.domo.post !== "function") return;
  await Promise.all(state.readiness.map((item) => refreshDomoReadinessForItem(item)));
}

function selectedColumnPayload(item, names) {
  const selected = new Set(names || []);
  return getReadinessColumns(item)
    .filter((col) => selected.has(col.name))
    .map((col) => ({
      name: col.name,
      type: col.type,
      aiEnabled: !!col.aiEnabled,
      context: col.context || "",
      synonyms: col.synonyms || [],
    }));
}

async function syncReadinessColumns(item, names) {
  const cols = selectedColumnPayload(item, names);
  try {
    const result = await callPattern4ce("syncDomoAiReadiness", {
      datasetId: item.datasetId,
      desiredState: {
        context: item.context,
        datasetContext: item.context,
        datasetSynonyms: item.datasetSynonyms || [],
        columns: cols,
      },
      columns: cols,
    });
    if (result?.status === "SUCCEEDED") {
      applyDomoReadinessState(item, result.readiness);
      setDomoSyncedColumns(item.alias, (item.domoSyncedColumns || []));
      return { live: true, result };
    }
    throw new Error(result?.error ? JSON.stringify(result.error) : "Sync failed");
  } catch (error) {
    console.warn("Live Domo AI Readiness sync failed; re-reading Domo state", error);
    const refreshed = await refreshDomoReadinessForItem(item);
    if (!refreshed && !(window.domo && typeof window.domo.post === "function")) {
      setDomoSyncedColumns(item.alias, Array.from(getDomoSyncedColumns(item)).concat(names));
    }
    return { live: !!refreshed, recovered: !!refreshed, error };
  }
}

async function wipeReadinessColumns(item, names) {
  const cols = selectedColumnPayload(item, names || []);
  try {
    const result = await callPattern4ce("wipeDomoAiReadiness", {
      datasetId: item.datasetId,
      columns: cols,
    });
    if (result?.status === "SUCCEEDED") {
      applyDomoReadinessState(item, result.readiness);
      setDomoSyncedColumns(item.alias, (item.domoSyncedColumns || []));
      return { live: true, result };
    }
    throw new Error(result?.error ? JSON.stringify(result.error) : "Wipe failed");
  } catch (error) {
    console.warn("Live Domo AI Readiness wipe failed; re-reading Domo state", error);
    const refreshed = await refreshDomoReadinessForItem(item);
    if (!refreshed && !(window.domo && typeof window.domo.post === "function")) {
      const remove = new Set(names || []);
      setDomoSyncedColumns(item.alias, Array.from(getDomoSyncedColumns(item)).filter((name) => !remove.has(name)));
    }
    return { live: !!refreshed, recovered: !!refreshed, error };
  }
}

function readinessStats(item) {
  const columns = getReadinessColumns(item);
  const ucReady = getUcReadyColumns(item);
  const domoSynced = getDomoSyncedColumns(item);
  const ucPct = columns.length ? Math.round((ucReady.length / columns.length) * 100) : 0;
  const domoPct = columns.length ? Math.round((domoSynced.size / columns.length) * 100) : 0;
  return { columns, ucReady, domoSynced, ucPct, domoPct };
}

function readinessRailState(stats) {
  if (stats.domoSynced.size === 0) return { cls: "off", label: "Domo off" };
  if (stats.domoSynced.size >= stats.ucReady.length && stats.ucReady.length > 0) {
    return { cls: "synced", label: "Synced" };
  }
  return { cls: "partial", label: "Partial" };
}

function renderReadinessPortfolio() {
  const host = document.getElementById("readinessPortfolio");
  if (!host) return;
  let totalCols = 0, totalUcReady = 0, totalSynced = 0;
  state.readiness.forEach((item) => {
    const s = readinessStats(item);
    totalCols += s.columns.length;
    totalUcReady += s.ucReady.length;
    totalSynced += s.domoSynced.size;
  });
  const ucPct = totalCols ? Math.round((totalUcReady / totalCols) * 100) : 0;
  const domoPct = totalCols ? Math.round((totalSynced / totalCols) * 100) : 0;
  host.innerHTML = `
    <div class="portfolio-meter">
      <div class="portfolio-meter-head"><span>Unity Catalog prepared</span><b>${ucPct}%</b></div>
      <div class="readiness-progress uc"><span style="width:${ucPct}%"></span></div>
      <small>${totalUcReady}/${totalCols} columns across ${state.readiness.length} datasets</small>
    </div>
    <div class="portfolio-meter domo">
      <div class="portfolio-meter-head"><span>Domo AI Readiness synced</span><b>${domoPct}%</b></div>
      <div class="readiness-progress domo"><span style="width:${domoPct}%"></span></div>
      <small>${totalSynced}/${totalCols} columns synced into Domo</small>
    </div>`;
}

function renderReadinessRail() {
  const rail = document.getElementById("readinessRail");
  if (!rail) return;
  const railCount = document.getElementById("railCount");
  if (railCount) railCount.textContent = state.readiness.length;
  const dsIcon = '<svg class="rail-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/></svg>';
  rail.innerHTML = state.readiness
    .map((item) => {
      const s = readinessStats(item);
      const rs = readinessRailState(s);
      const active = state.readinessSelected === item.alias;
      return `
        <button class="rail-item ${active ? "active" : ""}" type="button" data-readiness-alias="${escapeHtml(item.alias)}" aria-pressed="${active}">
          <div class="rail-item-top">
            <span class="rail-name">${dsIcon}${escapeHtml(item.alias)}</span>
            <span class="rail-dot ${rs.cls}" title="${rs.label}"></span>
          </div>
          <div class="rail-sub">Unity Catalog dataset</div>
          <div class="rail-meter">
            <span class="rail-meter-tag">UC</span>
            <span class="rail-bar"><span class="uc" style="width:${s.ucPct}%"></span></span>
            <span class="rail-meter-val">${s.ucPct}%</span>
          </div>
          <div class="rail-meter">
            <span class="rail-meter-tag domo">Domo</span>
            <span class="rail-bar"><span class="domo" style="width:${s.domoPct}%"></span></span>
            <span class="rail-meter-val">${s.domoPct}%</span>
          </div>
        </button>`;
    })
    .join("");
  rail.querySelectorAll("[data-readiness-alias]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.readinessSelected = btn.getAttribute("data-readiness-alias");
      renderReadiness();
    });
  });
}

function renderReadiness() {
  if (!document.getElementById("readinessRail")) return;
  renderReadinessPortfolio();
  renderReadinessRail();
  renderReadinessDetail();
}

function domoDatasetUrl(item) {
  return `https://databricks-demo.domo.com/datasources/${item.datasetId}/details/ai-readiness`;
}

function databricksTableUrl(item) {
  return databricksObjectUrl(item.object || "");
}

function openExternal(url) {
  if (!url) return;
  var target = String(url);
  // domo.navigate runs in the (non-sandboxed) parent frame, so per Domo's domo.js docs it
  // opens both Domo and external (Databricks / Lakebase) URLs directly in a new tab. The app
  // iframe itself can't window.open (no allow-popups), so this is the supported path.
  if (window.domo && typeof window.domo.navigate === "function") {
    window.domo.navigate(target, true);
    return;
  }
  // Local preview (outside the Domo runtime): a normal new tab.
  try { window.open(target, "_blank", "noopener"); } catch (_) {}
}

// execCommand copy (the async Clipboard API is blocked by the iframe permissions policy).
// Used by the ML "Copy" button on the inference payload panel. Returns bool.
function copyTextToClipboard(text) {
  try {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    var ok = document.execCommand("copy");
    ta.remove();
    return !!ok;
  } catch (_) {
    return false;
  }
}

// Context length (characters) for the selected dataset — mirrors Domo AI Readiness's
// native gauge, which counts column names + context + synonyms (+ dataset context here).
function datasetContextChars(item) {
  let n = (item.context || "").length;
  (item.datasetSynonyms || []).forEach((s) => { n += String(s || "").length; });
  getReadinessColumns(item).forEach((c) => {
    n += String(c.name || "").length;
    n += String(c.context || "").length;
    (c.synonyms || []).forEach((s) => { n += String(s || "").length; });
  });
  return n;
}

// Domo-native-style 270° arc gauge with green/amber/red zones, a marker, and a center value.
function renderContextGauge(chars, max) {
  max = max || 16000;
  const cx = 80, cy = 78, r = 58;
  const START = 225, SWEEP = 270; // gap at the bottom
  const frac = Math.max(0, Math.min(1, chars / max));
  const pt = (deg) => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  };
  const arc = (a0, a1, cls, w) => {
    const [x0, y0] = pt(a0);
    const [x1, y1] = pt(a1);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `<path class="${cls}" d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke-width="${w}" stroke-linecap="round"/>`;
  };
  const z = (f) => START + f * SWEEP;
  const markAngle = z(frac);
  const [mx, my] = pt(markAngle);
  const fmt = chars >= 1000 ? `${(chars / 1000).toFixed(1)}k` : String(chars);
  return `
    <svg class="ctx-gauge-svg" viewBox="0 0 160 120" role="img" aria-label="Context length ${chars} characters">
      ${arc(START, z(1), "ctx-track", 10)}
      ${arc(START, z(0.56), "ctx-zone-good", 10)}
      ${arc(z(0.56), z(0.81), "ctx-zone-warn", 10)}
      ${arc(z(0.81), z(1), "ctx-zone-bad", 10)}
      <circle class="ctx-marker" cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="6"/>
      <text class="ctx-gauge-num" x="${cx}" y="74" text-anchor="middle">${fmt}</text>
      <text class="ctx-gauge-unit" x="${cx}" y="90" text-anchor="middle">characters</text>
    </svg>
    <div class="ctx-gauge-ends"><span>0</span><span>${(max / 1000).toFixed(0)}k</span></div>`;
}

function renderReadinessDetail() {
  const detail = document.getElementById("readinessDetail");
  if (!detail) return;
  const item = state.readiness.find((r) => r.alias === state.readinessSelected) || state.readiness[0];
  if (!item) {
    detail.innerHTML = `<p class="readiness-empty">No readiness records loaded.</p>`;
    return;
  }
  const { columns, ucReady, domoSynced, ucPct, domoPct } = readinessStats(item);
  const allSynced = domoSynced.size >= ucReady.length && ucReady.length > 0;
  const columnRows = columns.map((col) => {
    const synced = domoSynced.has(col.name);
    const synonyms = (col.synonyms || []).length;
    return `
      <tr>
        <td class="col-name"><strong>${escapeHtml(col.name)}</strong><span>${escapeHtml(col.type || "")}</span></td>
        <td><span class="state-pill ${col.aiEnabled ? "uc" : "muted"}">${col.aiEnabled ? "Prepared" : "Not prepared"}</span></td>
        <td><span class="state-pill ${synced ? "synced" : "muted"}">${synced ? "Synced" : "Not synced"}</span></td>
        <td class="col-ctx">${escapeHtml(col.context || "No column context staged in Unity Catalog.")}${synonyms ? `<em>${synonyms} synonym${synonyms === 1 ? "" : "s"}</em>` : ""}</td>
        <td class="col-act">
          <button class="pill-btn ${synced ? "" : "go"}" type="button" data-sync-column="${escapeHtml(col.name)}" ${!col.aiEnabled || synced ? "disabled" : ""} title="${synced ? "Already synced" : col.aiEnabled ? "Sync into Domo" : "Not prepared in UC"}">Sync</button>
          <button class="pill-btn ghost" type="button" data-wipe-column="${escapeHtml(col.name)}" ${!synced ? "disabled" : ""} title="${synced ? "Remove from Domo" : "Nothing to wipe"}">Wipe</button>
          <button class="pill-btn inspect" type="button" data-inspect-column="${escapeHtml(col.name)}" title="Inspect / edit Unity Catalog source context">Inspect</button>
        </td>
      </tr>`;
  }).join("");
  detail.innerHTML = `
    <div class="readiness-panel-head">
      <div>
        <span class="panel-tag">selected dataset</span>
        <h3>${escapeHtml(item.alias)}</h3>
        <code class="readiness-object">${escapeHtml(item.object || "")}</code>
      </div>
      <div class="readiness-deeplinks">
        <button class="link-pill" type="button" data-open-url="${escapeHtml(domoDatasetUrl(item))}">Domo AI Readiness &rarr;</button>
        <button class="link-pill dbx" type="button" data-open-url="${escapeHtml(databricksTableUrl(item))}">Databricks table &rarr;</button>
      </div>
    </div>
    <div class="readiness-context-row">
      <div class="ctx-gauge-card">
        <div class="ctx-gauge-tag">Context length
          <span class="ctx-info" title="Context length includes column names, context, and synonyms. Adding context improves results — but too much can lower accuracy and slow response time.">i</span>
        </div>
        ${renderContextGauge(datasetContextChars(item))}
        <div class="ctx-gauge-foot">column names · context · synonyms</div>
      </div>
      <div class="readiness-compare">
        <div class="readiness-score">
          <div class="readiness-score-head"><span>Unity Catalog metadata prepared</span><b>${ucPct}%</b></div>
          <div class="readiness-progress uc"><span style="width:${ucPct}%"></span></div>
          <small>${ucReady.length}/${columns.length} columns · ${item.synonymCount || 0} synonyms · ${item.tagCount || 0} UC tags</small>
        </div>
        <div class="readiness-score domo">
          <div class="readiness-score-head"><span>Domo AI Readiness synced</span><b>${domoPct}%</b></div>
          <div class="readiness-progress domo"><span style="width:${domoPct}%"></span></div>
          <small>${domoSynced.size}/${columns.length} columns synced into Domo</small>
        </div>
      </div>
    </div>
    <div class="readiness-dataset-actions">
      <span class="dataset-actions-label">Dataset controls</span>
      <button class="pill-btn go solid" type="button" data-readiness-sync="${escapeHtml(item.alias)}" ${allSynced ? "disabled" : ""}>Sync all prepared</button>
      <button class="pill-btn danger" type="button" data-readiness-wipe="${escapeHtml(item.alias)}" ${domoSynced.size ? "" : "disabled"}>Wipe all from Domo</button>
    </div>
    <div class="table-wrap readiness-table-wrap">
      <table class="readiness-column-table">
        <thead><tr><th>Column</th><th>Unity Catalog</th><th>Domo AI Readiness</th><th>Source context</th><th class="th-act">Sync / Wipe / Inspect</th></tr></thead>
        <tbody>${columnRows}</tbody>
      </table>
    </div>`;
  detail.querySelectorAll("[data-open-url]").forEach((btn) => {
    btn.addEventListener("click", () => openExternal(btn.getAttribute("data-open-url")));
  });
  detail.querySelector("[data-readiness-sync]")?.addEventListener("click", () => {
    const note = document.getElementById("readinessNote");
    if (note) note.textContent = `Syncing ${ucReady.length} prepared columns from Unity Catalog into Domo AI Readiness...`;
    syncReadinessColumns(item, ucReady).then((outcome) => {
      if (note) {
        note.classList.add("done");
        note.textContent = outcome.live
          ? `${outcome.recovered ? "Re-read" : "Synced"} Domo AI Readiness state for ${item.alias}.`
          : `Live sync unavailable; no Domo readiness changes were confirmed for ${item.alias}.`;
      }
      renderReadiness();
    });
  });
  detail.querySelector("[data-readiness-wipe]")?.addEventListener("click", () => {
    const note = document.getElementById("readinessNote");
    const allNames = columns.map((col) => col.name);
    if (note) note.textContent = `Wiping Domo AI Readiness state for ${item.alias}...`;
    wipeReadinessColumns(item, allNames).then((outcome) => {
      if (note) {
        note.classList.add("done");
        note.textContent = outcome.live
          ? `Wiped Domo AI Readiness config for ${item.alias}. Unity Catalog metadata remains unchanged.`
          : `Live wipe unavailable; no Domo readiness changes were confirmed for ${item.alias}.`;
      }
      renderReadiness();
    });
  });
  detail.querySelectorAll("[data-sync-column]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-sync-column");
      syncReadinessColumns(item, [name]).then(() => renderReadiness());
    });
  });
  detail.querySelectorAll("[data-wipe-column]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-wipe-column");
      wipeReadinessColumns(item, [name]).then(() => renderReadiness());
    });
  });
  detail.querySelectorAll("[data-inspect-column]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openUcDrawer(item, btn.getAttribute("data-inspect-column"));
    });
  });
}

/* ---------- UC inspector drawer (governed source-of-truth edit) ---------- */

function openUcDrawer(item, columnName) {
  const col = getReadinessColumns(item).find((c) => c.name === columnName);
  if (!col) return;
  const drawer = document.getElementById("ucDrawer");
  const backdrop = document.getElementById("ucDrawerBackdrop");
  if (!drawer || !backdrop) return;
  const synced = getDomoSyncedColumns(item).has(col.name);
  drawer.innerHTML = `
    <div class="uc-drawer-head">
      <span class="uc-drawer-tag"><img class="dbx-mark" src="./public/databricks-logo.png" alt="" aria-hidden="true" /> Unity Catalog · governed source edit</span>
      <button class="uc-drawer-close" id="ucDrawerClose" type="button" aria-label="Close">&times;</button>
    </div>
    <code class="uc-drawer-path">${escapeHtml(item.object || "")}.${escapeHtml(col.name)}</code>
    <dl class="uc-drawer-meta">
      <div><dt>Type</dt><dd>${escapeHtml(col.type || "—")}</dd></div>
      <div><dt>UC prepared</dt><dd>${col.aiEnabled ? "Yes" : "No"}</dd></div>
      <div><dt>Domo synced</dt><dd>${synced ? "Yes" : "No"}</dd></div>
    </dl>
    <div class="uc-drawer-warn">
      Editing here updates the <strong>Unity Catalog source of truth</strong> via <code>updateUcColumnContext</code>.
      This is a governed exception to the UC&nbsp;&rarr;&nbsp;Domo sync direction &mdash; it changes Databricks metadata, not Domo.
    </div>
    <label class="uc-field">
      <span>Column context (UC comment)</span>
      <textarea id="ucEditContext" rows="4">${escapeHtml(col.context || "")}</textarea>
    </label>
    <label class="uc-field">
      <span>Synonyms (comma-separated)</span>
      <input type="text" id="ucEditSynonyms" value="${escapeHtml((col.synonyms || []).join(", "))}" />
    </label>
    <label class="uc-toggle">
      <input type="checkbox" id="ucEditEnabled" ${col.aiEnabled ? "checked" : ""} />
      <span>AI-enabled in Unity Catalog</span>
    </label>
    <div class="uc-drawer-actions">
      <button class="btn btn-primary" id="ucEditSave" type="button">Update Unity Catalog metadata</button>
      <button class="pill-btn ghost" id="ucEditCancel" type="button">Cancel</button>
      <button class="link-pill dbx" type="button" data-open-url="${escapeHtml(databricksTableUrl(item))}">Open in Databricks &rarr;</button>
    </div>
    <div class="uc-edit-note" id="ucEditNote"></div>`;
  // Move to body so absolute positioning is document-relative, and anchor near the click
  // (the iframe renders at full content height, so a fixed full-height drawer lands off-screen).
  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);
  drawer.style.top = Math.max(12, (LAST_CLICK.pageY || 120) - 16) + "px";
  backdrop.classList.remove("is-hidden");
  drawer.classList.remove("is-hidden");
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  drawer.querySelector("#ucDrawerClose")?.addEventListener("click", closeUcDrawer);
  drawer.querySelector("#ucEditCancel")?.addEventListener("click", closeUcDrawer);
  backdrop.addEventListener("click", closeUcDrawer, { once: true });
  drawer.querySelector("[data-open-url]")?.addEventListener("click", (e) => openExternal(e.currentTarget.getAttribute("data-open-url")));
  drawer.querySelector("#ucEditSave")?.addEventListener("click", () => saveUcColumnContext(item, col.name));
  document.addEventListener("keydown", ucDrawerEscHandler);
}

function ucDrawerEscHandler(e) {
  if (e.key === "Escape") closeUcDrawer();
}

function closeUcDrawer() {
  const drawer = document.getElementById("ucDrawer");
  const backdrop = document.getElementById("ucDrawerBackdrop");
  if (drawer) {
    drawer.classList.remove("open");
    drawer.classList.add("is-hidden");
    drawer.setAttribute("aria-hidden", "true");
  }
  if (backdrop) backdrop.classList.add("is-hidden");
  document.removeEventListener("keydown", ucDrawerEscHandler);
}

async function saveUcColumnContext(item, columnName) {
  const col = getReadinessColumns(item).find((c) => c.name === columnName);
  if (!col) return;
  const note = document.getElementById("ucEditNote");
  const nextContext = (document.getElementById("ucEditContext")?.value || "").trim();
  const nextSynonyms = (document.getElementById("ucEditSynonyms")?.value || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const nextEnabled = !!document.getElementById("ucEditEnabled")?.checked;
  const saveBtn = document.getElementById("ucEditSave");
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Updating Unity Catalog…"; }
  if (note) { note.className = "uc-edit-note"; note.textContent = "Writing column context to the Unity Catalog source of truth…"; }
  try {
    const result = await callPattern4ce("updateUcColumnContext", {
      tableName: item.object,
      columnName,
      context: nextContext,
      synonyms: nextSynonyms,
      aiEnabled: nextEnabled,
      updatedBy: state.persona || "Pattern 4 Revenue Command Center",
    });
    if (result?.status === "SUCCEEDED" && Array.isArray(result.columns)) {
      item.columns = result.columns;
      if (note) { note.className = "uc-edit-note done"; note.textContent = `Unity Catalog source metadata updated for ${columnName}.`; }
    } else {
      col.context = nextContext;
      col.synonyms = nextSynonyms;
      col.aiEnabled = nextEnabled;
      if (note) { note.className = "uc-edit-note warn"; note.textContent = "Live Unity Catalog write was not confirmed; staged the edit locally."; }
    }
    renderReadiness();
    setTimeout(closeUcDrawer, 900);
  } catch (error) {
    console.warn("Live UC update failed; updating local desired state only", error);
    col.context = nextContext;
    col.synonyms = nextSynonyms;
    col.aiEnabled = nextEnabled;
    if (note) { note.className = "uc-edit-note warn"; note.textContent = "Live Unity Catalog write unavailable; staged the edit locally."; }
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Update Unity Catalog metadata"; }
    renderReadiness();
  }
}

async function syncReadinessDemo() {
  state.readinessSynced = true;
  const note = document.getElementById("readinessNote");
  note.classList.add("done");
  note.textContent =
    "Syncing all prepared Unity Catalog columns into Domo AI Readiness...";
  for (const item of state.readiness) {
    await syncReadinessColumns(item, getUcReadyColumns(item));
  }
  note.textContent = "All prepared Unity Catalog columns were synced where live write access was available; otherwise staged locally.";
  renderReadiness();
}

const VIEW_IDS = {
  forecast: "viewForecast",
  ml: "viewMl",
  approvals: "viewApprovals",
  lakebase: "viewLakebase",
  readiness: "viewReadiness",
  genie: "viewGenie",
  genieEmbed: "viewGenieEmbed",
  guide: "viewGuide",
};

function activateView(view) {
  if (!VIEW_IDS[view]) view = "forecast";
  document.querySelectorAll(".view-tab").forEach((tab) => {
    const isActive = tab.getAttribute("data-view") === view;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
  Object.entries(VIEW_IDS).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("is-hidden", key !== view);
  });
  // The forecast SVG needs a measured width; (re)render when its view becomes visible.
  if (view === "forecast") renderForecast(personaView());
  if (view === "readiness") renderReadiness();
  // Warm the scale-to-zero Model Serving endpoint as soon as the user opens ML,
  // so the first real "Run prediction" doesn't hit a ~20-30s cold start.
  if (view === "ml") warmModelEndpoint();
  if (view === "approvals") loadApprovals();
}

/* ---------- Approvals · Action Center (in-app workflow task approval) ---------- */

function renderApprovalsRows() {
  const body = document.getElementById("approvalsRows");
  if (!body) return;
  const a = state.approvals;
  if (a.loading) {
    body.innerHTML = `<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:22px;">Loading approval tasks…</td></tr>`;
    return;
  }
  if (!a.tasks.length) {
    body.innerHTML = `<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:22px;">${a.live ? "No approval tasks yet. Approve &amp; execute an action to create one." : "Approval tasks load in the published app (Code Engine context required)."}</td></tr>`;
    return;
  }
  body.innerHTML = a.tasks.map((t) => {
    const open = t.status === "OPEN";
    const busy = a.busyId === t.id;
    const statusClass = open ? "pending" : (t.status === "COMPLETED" ? "executed" : "cancelled");
    let action = "";
    if (open && a.live) {
      action = busy
        ? `<span class="wf-chip">Submitting…</span>`
        : `<div class="exec-actions">
             <button class="action-btn" type="button" data-approve="${escapeHtml(t.id)}" data-version="${escapeHtml(String(t.version || "1"))}">Approve</button>
             <button class="action-btn wf-explain" type="button" data-reject="${escapeHtml(t.id)}" data-version="${escapeHtml(String(t.version || "1"))}">Reject</button>
           </div>`;
    } else if (open) {
      action = `<span class="approvals-note">approve in published app</span>`;
    } else {
      action = `<span class="action-writeback">✓ ${escapeHtml(t.status.toLowerCase())}</span>`;
    }
    return `<tr>
      <td><strong>${escapeHtml(t.title || "Approve renewal-risk retention")}</strong><div class="approvals-id">${escapeHtml(t.id)}</div></td>
      <td><span class="status ${statusClass}">${escapeHtml(t.status)}</span></td>
      <td>${t.createdOn ? escapeHtml(fmtTaskDate(t.createdOn)) : "—"}</td>
      <td>${t.completedOn ? escapeHtml(fmtTaskDate(t.completedOn)) : "—"}</td>
      <td>${action}</td>
    </tr>`;
  }).join("");
  body.querySelectorAll("[data-approve]").forEach((b) => b.addEventListener("click", () => completeApproval(b.getAttribute("data-approve"), "Approved", b.getAttribute("data-version"))));
  body.querySelectorAll("[data-reject]").forEach((b) => b.addEventListener("click", () => completeApproval(b.getAttribute("data-reject"), "Rejected", b.getAttribute("data-version"))));
  wireAgentLinks();
}

function fmtTaskDate(iso) {
  try { return new Date(iso).toLocaleString(); } catch (e) { return iso; }
}

function approvalsBanner(type, msg) {
  const el = document.getElementById("approvalsBanner");
  if (!el) return;
  if (!msg) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="lb-banner ${type === "error" ? "error" : "success"}">${escapeHtml(msg)}</div>`;
}

async function loadApprovals() {
  state.approvals.loading = true;
  renderApprovalsRows();
  let res = null;
  try {
    res = await callPattern4ce("listApprovalTasks", { limit: 50 });
  } catch (e) {
    state.approvals.error = String(e);
  }
  state.approvals.loading = false;
  if (res && res.status === "SUCCEEDED" && Array.isArray(res.tasks)) {
    state.approvals.tasks = res.tasks;
    state.approvals.live = true;
    approvalsBanner(null);
  } else {
    state.approvals.live = false;
    if (res && res.error) approvalsBanner("error", "Could not load tasks: " + (typeof res.error === "string" ? res.error : JSON.stringify(res.error)));
  }
  renderApprovalsRows();
}

async function completeApproval(taskId, decision, version) {
  state.approvals.busyId = taskId;
  renderApprovalsRows();
  let res = null;
  try {
    res = await callPattern4ce("completeApprovalTask", { taskId, decision, version: version || "1" });
  } catch (e) {
    res = { status: "FAILED", error: String(e) };
  }
  state.approvals.busyId = null;
  if (res && res.status === "SUCCEEDED") {
    approvalsBanner("ok", `Task ${decision.toLowerCase()} — workflow resumed; status writing back to the lakehouse.`);
    await loadApprovals();
  } else {
    approvalsBanner("error", `Could not ${decision.toLowerCase()} task: ` + (res && res.error ? (typeof res.error === "string" ? res.error : JSON.stringify(res.error)) : "unknown"));
    renderApprovalsRows();
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function warmModelEndpoint() {
  if (state.mlWarmStarted || !(window.domo && typeof window.domo.post === "function") || !state.mlInferenceBridge) return;
  state.mlWarmStarted = true;
  try {
    const f = collectMlFeatures();
    const out = await callPattern4ce("runModelInference", { records: [f] });
    if (out && Array.isArray(out.predictions) && out.predictions.length) state.mlServing = true;
  } catch (e) {
    // Warm-up is best-effort; the real run will retry.
    state.mlWarmStarted = false;
  }
}

async function liveInfer(f) {
  const out = await callPattern4ce("runModelInference", { records: [f] });
  if (out && Array.isArray(out.predictions) && out.predictions.length) {
    const prob = Number(out.predictions[0]);
    const arr = Number(f.annual_recurring_revenue || 0);
    const t = riskTier(prob);
    return { probability: prob, revenueAtRisk: arr * prob, tier: t.tier, drivers: riskDrivers(f), action: t.action, live: true };
  }
  return null;
}

function wireTabs() {
  document.querySelectorAll(".view-tab").forEach((tab) => {
    tab.addEventListener("click", () => activateView(tab.getAttribute("data-view")));
  });
  document.querySelectorAll("[data-goto-view]").forEach((el) => {
    el.addEventListener("click", () => activateView(el.getAttribute("data-goto-view")));
  });
  const ar = document.getElementById("approvalsRefresh");
  if (ar) ar.addEventListener("click", loadApprovals);
  const awl = document.getElementById("approvalsWritebackLink");
  if (awl) awl.addEventListener("click", (e) => { e.preventDefault(); openExternal(WRITEBACK_TABLE_URL); });
}

function wireForecastControls() {
  const range = document.getElementById("forecastRange");
  if (range) {
    range.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        range.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", b === btn));
        forecastState.range = Number(btn.getAttribute("data-range"));
        renderForecast(personaView());
      });
    });
  }
  const conf = document.getElementById("confidenceToggle");
  if (conf) {
    conf.addEventListener("click", () => {
      forecastState.confidence = !forecastState.confidence;
      conf.classList.toggle("active", forecastState.confidence);
      renderForecast(personaView());
    });
  }
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!document.getElementById("viewForecast").classList.contains("is-hidden")) {
        renderForecast(personaView());
      }
    }, 160);
  });
}

/* ---------- Genie panel (enhanced: pop-out, resize, theme, model, inspector, deep link) ---------- */

const WORKSPACE_HOST = "https://dbc-0516e56c-ba3e.cloud.databricks.com";
// Set GENIE_SPACE_ID once a dedicated Pattern 4 Genie Space exists; deep link adapts automatically.
const GENIE_SPACE_ID = "01f1642295b61d6b8849e106f52fc781";
const GENIE_DEEPLINK = GENIE_SPACE_ID ? `${WORKSPACE_HOST}/genie/rooms/${GENIE_SPACE_ID}` : `${WORKSPACE_HOST}/genie`;
const LAKEBASE_PROJECT_LINK = `${WORKSPACE_HOST}/lakebase/projects/2829411b-5a16-4d4f-931c-bf4860ed7749`;
const LAKEBASE_TABLES_LINK = `${LAKEBASE_PROJECT_LINK}/branches/br-lingering-cell-d2zmepjn/tables`;
// Unity Catalog lineage graph (Catalog Explorer → Lineage tab) for a representative gold
// table; shows the downstream Domo Pattern 4 external-lineage node.
const LINEAGE_URL = `${WORKSPACE_HOST}/explore/data/databricks_raptor/pattern4_agent_automation/gold_incident_revenue_impact?o=8127410670216233&activeTab=lineage`;
// The governed writeback record (Delta, same UC schema as the gold views).
const WRITEBACK_TABLE_URL = `${WORKSPACE_HOST}/explore/data/databricks_raptor/pattern4_agent_automation/agent_action_writeback`;
// "Go to source" for the Databricks agent the Domo workflow calls: the Agent Bricks
// build page + its MLflow trace log (every run's reasoning + Genie tool calls).
const AGENT_BUILD_URL = `${WORKSPACE_HOST}/ml/bricks/sa/build/77bd204b-0051-445c-8434-8a12b65f90e1?o=8127410670216233`;
const AGENT_TRACES_URL = `${WORKSPACE_HOST}/ml/experiments/1772952801684800/traces?o=8127410670216233`;
// Live Domo Workflow (Renewal Risk Retention). Approve & execute starts this governed
// workflow server-side via pattern4ce.startRetentionWorkflow; the human approval task
// routes to the demo user's Domo Tasks, then writeActionStatus writes status back.
const DOMO_INSTANCE_URL = "https://databricks-demo.domo.com";
const WORKFLOW_MODEL_ID = "6cbd5ecb-1036-410a-b188-60a49820d264";
const WORKFLOW_VERSION = "1.0.0";
const WORKFLOW_TASKS_URL = `${DOMO_INSTANCE_URL}/workflows/${WORKFLOW_MODEL_ID}`;

// The human-approval task is actionable from the workflow INSTANCE monitor
// (it has "View associated task"); the bare model URL is the editor (blank to approvers).
function workflowInstanceUrl(instanceId) {
  if (!instanceId) return WORKFLOW_TASKS_URL;
  return `${DOMO_INSTANCE_URL}/workflows/instances/${WORKFLOW_MODEL_ID}/${WORKFLOW_VERSION}/${instanceId}`;
}

const GENIE_MODELS = [
  { value: "genie-default", label: "Genie (default)", sub: "AI/BI" },
  { value: "dbrx-instruct", label: "DBRX Instruct", sub: "Model Serving" },
  { value: "llama-3-70b", label: "Llama 3.1 70B", sub: "Model Serving" },
  { value: "claude-sonnet", label: "Claude Sonnet", sub: "External via Gateway" },
];

const GENIE_THEMES = ["dbx", "domo", "slate"];

const genieState = {
  accent: "dbx",
  model: "genie-default",
  modelLabel: "Genie (default)",
  inspect: false,
  expanded: false,
  threadH: 220,
  lastError: "",
};

function answerFor(question) {
  const q = question.toLowerCase();
  let best = null;
  let bestScore = 0;
  GENIE_CANNED.forEach((entry) => {
    const score = entry.match.reduce((s, kw) => (q.includes(kw) ? s + 1 : s), 0);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  });
  if (best && bestScore > 0) return best;
  return {
    answer:
      "Genie would answer this live from Unity Catalog gold views. In this preview, try one of the suggested questions about West renewal risk, affected accounts, recommended actions, or protected revenue.",
    sql: "-- Genie generates governed SQL over databricks_raptor.pattern4_agent_automation.*",
    latencyMs: 1500,
    rows: 0,
  };
}

function unwrapCodeEngineResponse(value) {
  let current = value?.body ?? value?.data ?? value;
  let depth = 0;
  while (current && typeof current === "object" && "response" in current && depth < 6) {
    current = current.response;
    depth += 1;
  }
  return current?.output ?? current?.result ?? current?.value ?? current;
}

async function askGenieLive(question) {
  genieState.lastError = "";
  if (!window.domo || typeof window.domo.post !== "function") {
    genieState.lastError = "Domo runtime (domo.post) unavailable in this context.";
    return null;
  }
  try {
    const response = await window.domo.post("/domo/codeengine/v2/packages/askGenie", {
      question: question,
      conversationId: "",
      persona: state.persona,
      model: genieState.model,
    });
    const output = unwrapCodeEngineResponse(response);
    if (!output || output.status === "FAILED") {
      const detail = output && output.error ? (typeof output.error === "string" ? output.error : JSON.stringify(output.error)) : "Proxy returned no output.";
      genieState.lastError = "Genie proxy returned an error: " + detail;
      console.warn("Genie proxy failed; falling back to preview", output);
      return null;
    }
    return {
      answer: output.answer || "Genie returned no text answer.",
      sql: output.sql || "",
      latencyMs: output.latencyMs || 0,
      rows: output.rowCount || 0,
      columns: output.columns || [],
      dataRows: output.dataRows || output.rows || [],
      endpoint: output.endpoint,
      conversationId: output.conversationId,
      messageId: output.messageId,
      spaceId: output.spaceId || GENIE_SPACE_ID,
      model: output.model || genieState.model,
      suggestedQuestions: output.suggestedQuestions || [],
      governedBy: output.governedBy || "Unity Catalog + Domo Code Engine proxy",
      live: true,
    };
  } catch (error) {
    const msg = (error && (error.message || error.statusText)) ? (error.message || error.statusText) : JSON.stringify(error);
    genieState.lastError = "Code Engine call threw: " + msg + " (function askGenie via proxyId pattern4ce). Check that the package named pattern4ce is released and the card was re-instantiated after publish.";
    console.warn("Unable to call Code Engine Genie proxy; using preview", error);
    return null;
  }
}

function inspectorHTML(question, entry) {
  const space = GENIE_SPACE_ID || "<pattern4-genie-space>";
  const request = JSON.stringify(
    { space_id: entry.spaceId || space, conversation_id: entry.conversationId || "new", content: question },
    null,
    2
  );
  const endpoint = entry.endpoint || `/api/2.0/genie/spaces/${escapeHtml(space)}/messages`;
  return `
    <details class="inspect"${genieState.inspect ? " open" : ""}>
      <summary>Inspect call <span class="preview-flag">${entry.live ? "Live" : "Preview"}</span></summary>
      <div class="inspect-body">
        ${!entry.live && genieState.lastError ? `<div class="inspect-error">Live call did not run &mdash; ${escapeHtml(genieState.lastError)}</div>` : ""}
        <dl class="kv">
          <dt>Model</dt><dd>${escapeHtml(genieState.modelLabel)}</dd>
          <dt>Endpoint</dt><dd><code>POST ${escapeHtml(endpoint)}</code></dd>
          <dt>Latency</dt><dd>${entry.latencyMs || 0} ms</dd>
          <dt>Rows</dt><dd>${entry.rows}</dd>
          <dt>Governed by</dt><dd>${escapeHtml(entry.governedBy || "Unity Catalog + Domo Code Engine proxy")}</dd>
        </dl>
        <div>
          <div class="io-k" style="font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-bottom:4px;">Request</div>
          <pre>${escapeHtml(request)}</pre>
        </div>
        <div>
          <div class="io-k" style="font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin:6px 0 4px;">Generated SQL</div>
          <pre>${escapeHtml(entry.sql || "")}</pre>
        </div>
      </div>
    </details>`;
}

function formatGenieAnswer(htmlOrMarkdown) {
  const raw = String(htmlOrMarkdown || "");
  if (/<strong>|<b>|<em>|<br|<p/i.test(raw)) return raw;
  return escapeHtml(raw)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>");
}

/* ---------- Genie result visualization ---------- */

const TEMPORAL_TYPES = new Set(["DATE", "TIMESTAMP", "TIMESTAMP_NTZ"]);
const NUMERIC_TYPES = new Set(["DOUBLE", "DECIMAL", "FLOAT", "INT", "BIGINT", "LONG", "SHORT", "BYTE"]);

function normalizeGenieColumns(columns) {
  return (columns || []).map((c, i) => ({
    name: c.name || c.label || `Column ${i + 1}`,
    type: String(c.type_name || c.type || c.type_text || "").toUpperCase(),
    index: Number.isFinite(Number(c.position)) ? Number(c.position) : i,
  }));
}

function normalizeGenieRows(rows) {
  return (rows || []).map((row) => Array.isArray(row) ? row : Object.values(row || {}));
}

function columnKind(col, rows) {
  if (TEMPORAL_TYPES.has(col.type)) return "temporal";
  if (NUMERIC_TYPES.has(col.type)) return "numeric";
  const numericCount = rows.reduce((n, r) => Number.isFinite(Number(r[col.index])) ? n + 1 : n, 0);
  if (rows.length && numericCount / rows.length > 0.85) return "numeric";
  return "categorical";
}

function isCurrencyColumn(name) {
  return /revenue|arr|amount|risk|margin|price|cost|protected/i.test(name || "");
}

function isPercentColumn(name) {
  return /rate|pct|percent|score|ratio|probability/i.test(name || "");
}

function fmtGenieValue(value, col) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isFinite(n) && isCurrencyColumn(col?.name)) return fmtCurrency(n);
  if (Number.isFinite(n) && isPercentColumn(col?.name) && Math.abs(n) <= 1) return `${(n * 100).toFixed(1)}%`;
  if (Number.isFinite(n) && isPercentColumn(col?.name)) return `${n.toFixed(1)}%`;
  if (Number.isFinite(n)) return Math.abs(n) >= 1000 ? fmtNumber(n) : n.toFixed(n % 1 ? 1 : 0);
  return escapeHtml(value);
}

function chooseGenieChart(columns, rows) {
  const kinds = columns.map((c) => ({ ...c, kind: columnKind(c, rows) }));
  const nums = kinds.filter((c) => c.kind === "numeric");
  const cats = kinds.filter((c) => c.kind === "categorical");
  const times = kinds.filter((c) => c.kind === "temporal");
  if (rows.length === 1 && nums.length === 1 && columns.length === 1) return { type: "kpi", value: nums[0] };
  if (times.length === 1 && nums.length === 1 && rows.length > 1) return { type: "line", x: times[0], ys: [nums[0]] };
  if (times.length === 1 && nums.length >= 2 && rows.length > 1) return { type: "line", x: times[0], ys: nums.slice(0, 3) };
  if (cats.length === 1 && nums.length >= 1) return { type: "bar", x: cats[0], ys: nums.slice(0, Math.min(nums.length, 3)) };
  if (cats.length >= 2 && nums.length === 1) return { type: "bar", x: cats[0], series: cats[1], ys: [nums[0]] };
  if (nums.length === 2 && rows.length > 1) return { type: "scatter", x: nums[0], ys: [nums[1]] };
  if (rows.length === 1 && nums.length > 1) return { type: "kpi-row", values: nums.slice(0, 5) };
  return { type: "table" };
}

function chartTitle(chart) {
  if (chart.type === "line") return "Trend";
  if (chart.type === "bar") return "Breakdown";
  if (chart.type === "scatter") return "Relationship";
  if (chart.type === "kpi" || chart.type === "kpi-row") return "Result";
  return "Result table";
}

function renderGenieBarChart(rows, chart) {
  const xCol = chart.x;
  const yCol = chart.ys[0];
  const prepared = rows
    .map((r) => ({ label: String(r[xCol.index] ?? "Unknown"), value: Number(r[yCol.index] || 0) }))
    .filter((r) => Number.isFinite(r.value))
    .sort((a, b) => b.value - a.value);
  const top = prepared.slice(0, 12);
  const max = Math.max(...top.map((r) => Math.abs(r.value)), 1);
  return `<div class="genie-bars">${top.map((r) => {
    const width = Math.max(3, (Math.abs(r.value) / max) * 100);
    return `
      <div class="genie-bar-row">
        <span class="genie-bar-label" title="${escapeHtml(r.label)}">${escapeHtml(r.label)}</span>
        <span class="genie-bar-track"><span style="width:${width}%"></span></span>
        <span class="genie-bar-value">${fmtGenieValue(r.value, yCol)}</span>
      </div>`;
  }).join("")}</div>`;
}

function renderGenieLineChart(rows, chart) {
  const xCol = chart.x;
  const yCol = chart.ys[0];
  const pts = rows
    .map((r) => ({ label: String(r[xCol.index] ?? ""), value: Number(r[yCol.index] || 0) }))
    .filter((r) => Number.isFinite(r.value));
  if (pts.length < 2) return renderGenieTable(normalizeGenieColumns([xCol, yCol]), rows);
  const W = 520;
  const H = 190;
  const m = { top: 16, right: 16, bottom: 28, left: 54 };
  const min = Math.min(...pts.map((p) => p.value));
  const max = Math.max(...pts.map((p) => p.value));
  const pad = (max - min) * 0.12 || Math.abs(max) * 0.1 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const x = (i) => m.left + (i / Math.max(pts.length - 1, 1)) * (W - m.left - m.right);
  const y = (v) => m.top + (H - m.top - m.bottom) * (1 - (v - lo) / (hi - lo || 1));
  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const first = pts[0];
  const last = pts[pts.length - 1];
  return `
    <svg class="genie-line-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="${escapeHtml(yCol.name)} trend">
      <line class="genie-axis" x1="${m.left}" y1="${H - m.bottom}" x2="${W - m.right}" y2="${H - m.bottom}"></line>
      <line class="genie-axis" x1="${m.left}" y1="${m.top}" x2="${m.left}" y2="${H - m.bottom}"></line>
      <polyline class="genie-line" points="${line}"></polyline>
      <circle class="genie-line-dot" cx="${x(pts.length - 1).toFixed(1)}" cy="${y(last.value).toFixed(1)}" r="4"></circle>
      <text class="genie-axis-label" x="${m.left}" y="${H - 8}">${escapeHtml(first.label)}</text>
      <text class="genie-axis-label end" x="${W - m.right}" y="${H - 8}">${escapeHtml(last.label)}</text>
      <text class="genie-axis-label" x="${m.left - 6}" y="${y(hi).toFixed(1)}">${fmtGenieValue(hi, yCol)}</text>
      <text class="genie-axis-label" x="${m.left - 6}" y="${y(lo).toFixed(1)}">${fmtGenieValue(lo, yCol)}</text>
    </svg>`;
}

function renderGenieScatterChart(rows, chart) {
  const xCol = chart.x;
  const yCol = chart.ys[0];
  const pts = rows
    .map((r) => ({ x: Number(r[xCol.index] || 0), y: Number(r[yCol.index] || 0) }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (pts.length < 2) return renderGenieTable([xCol, yCol], rows);
  const W = 520;
  const H = 190;
  const m = { top: 16, right: 16, bottom: 32, left: 54 };
  const xMin = Math.min(...pts.map((p) => p.x));
  const xMax = Math.max(...pts.map((p) => p.x));
  const yMin = Math.min(...pts.map((p) => p.y));
  const yMax = Math.max(...pts.map((p) => p.y));
  const xPad = (xMax - xMin) * 0.08 || 1;
  const yPad = (yMax - yMin) * 0.08 || 1;
  const sx = (v) => m.left + ((v - (xMin - xPad)) / ((xMax + xPad) - (xMin - xPad) || 1)) * (W - m.left - m.right);
  const sy = (v) => m.top + (H - m.top - m.bottom) * (1 - (v - (yMin - yPad)) / ((yMax + yPad) - (yMin - yPad) || 1));
  return `
    <svg class="genie-line-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="${escapeHtml(xCol.name)} by ${escapeHtml(yCol.name)}">
      <line class="genie-axis" x1="${m.left}" y1="${H - m.bottom}" x2="${W - m.right}" y2="${H - m.bottom}"></line>
      <line class="genie-axis" x1="${m.left}" y1="${m.top}" x2="${m.left}" y2="${H - m.bottom}"></line>
      ${pts.slice(0, 80).map((p) => `<circle class="genie-line-dot" cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="3.4"></circle>`).join("")}
      <text class="genie-axis-label" x="${m.left}" y="${H - 8}">${escapeHtml(xCol.name)}</text>
      <text class="genie-axis-label" x="${m.left - 6}" y="${m.top + 4}">${escapeHtml(yCol.name)}</text>
    </svg>`;
}

function renderGenieKpis(rows, chart) {
  const cols = chart.type === "kpi" ? [chart.value] : chart.values;
  return `<div class="genie-kpi-row">${cols.map((c) => `
    <div class="genie-kpi">
      <span>${escapeHtml(c.name)}</span>
      <b>${fmtGenieValue(rows[0]?.[c.index], c)}</b>
    </div>`).join("")}</div>`;
}

function renderGenieTable(columns, rows) {
  const shownCols = columns.slice(0, 5);
  const shownRows = rows.slice(0, 8);
  return `
    <div class="genie-table-wrap">
      <table class="genie-table">
        <thead><tr>${shownCols.map((c) => `<th>${escapeHtml(c.name)}</th>`).join("")}</tr></thead>
        <tbody>${shownRows.map((r) => `<tr>${shownCols.map((c) => `<td>${fmtGenieValue(r[c.index], c)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>`;
}

function genieChartHTML(entry) {
  const columns = normalizeGenieColumns(entry.columns || []);
  const rows = normalizeGenieRows(entry.dataRows || []);
  if (!columns.length || !rows.length) return "";
  const chart = chooseGenieChart(columns, rows);
  let body = "";
  if (chart.type === "bar") body = renderGenieBarChart(rows, chart);
  else if (chart.type === "line") body = renderGenieLineChart(rows, chart);
  else if (chart.type === "scatter") body = renderGenieScatterChart(rows, chart);
  else if (chart.type === "kpi" || chart.type === "kpi-row") body = renderGenieKpis(rows, chart);
  else body = renderGenieTable(columns, rows);
  const fallback = renderGenieTable(columns, rows);
  return `
    <div class="genie-viz">
      <div class="genie-viz-head">
        <span>${chartTitle(chart)}</span>
        <span>${rows.length} rows · ${columns.length} cols</span>
      </div>
      ${body}
      ${chart.type !== "table" ? `<details class="genie-table-fallback"><summary>View as table</summary>${fallback}</details>` : ""}
    </div>`;
}

function appendUser(text) {
  const thread = document.getElementById("genieThread");
  const div = document.createElement("div");
  div.className = "bubble user";
  div.textContent = text;
  thread.appendChild(div);
  thread.scrollTop = thread.scrollHeight;
}

function appendBot(html, opts = {}) {
  const thread = document.getElementById("genieThread");
  const div = document.createElement("div");
  div.className = "bubble bot";
  let inner = opts.answer ? `<div class="genie-answer">${formatGenieAnswer(html)}</div>` : html;
  if (opts.chart) inner += opts.chart;
  if (opts.model) inner += `<div class="bubble-model">Answered by ${escapeHtml(opts.model)}</div>`;
  if (opts.inspector) inner += opts.inspector;
  div.innerHTML = inner;
  thread.appendChild(div);
  thread.scrollTop = thread.scrollHeight;
}

async function askGenie(question) {
  const text = (question || "").trim();
  if (!text) return;
  appendUser(text);
  document.getElementById("genieInput").value = "";
  appendBot("<em>Asking the Pattern 4 Genie Space...</em>", { model: "Databricks Genie" });
  const live = await askGenieLive(text);
  const entry = live || answerFor(text);
  appendBot(entry.answer, {
    answer: true,
    model: live ? "Databricks Genie · live" : genieState.modelLabel,
    chart: genieChartHTML(entry),
    inspector: inspectorHTML(text, entry),
  });
}

function setGenieExpanded(expanded) {
  genieState.expanded = expanded;
  document.getElementById("geniePanel").classList.toggle("is-expanded", expanded);
  const backdrop = document.getElementById("genieBackdrop");
  backdrop.hidden = !expanded;
  document.getElementById("genieExpandBtn").classList.toggle("active", expanded);
}

function setGenieInspect(on) {
  genieState.inspect = on;
  document.getElementById("genieInspectBtn").classList.toggle("active", on);
  document.querySelectorAll("#genieThread .inspect").forEach((d) => {
    d.open = on;
  });
}

function initGenie() {
  const panel = document.getElementById("geniePanel");
  panel.dataset.accent = genieState.accent;
  panel.style.setProperty("--genie-thread-h", genieState.threadH + "px");

  // Model selector (reuses the custom dropdown)
  createSelect(document.getElementById("genieModel"), GENIE_MODELS, genieState.model, (v) => {
    genieState.model = v;
    genieState.modelLabel = (GENIE_MODELS.find((m) => m.value === v) || {}).label || v;
  });

  // Deep link to Databricks Genie
  document.getElementById("genieOpenLink").setAttribute("href", GENIE_DEEPLINK);

  // Theme accent cycle
  document.getElementById("genieThemeBtn").addEventListener("click", () => {
    const next = (GENIE_THEMES.indexOf(genieState.accent) + 1) % GENIE_THEMES.length;
    genieState.accent = GENIE_THEMES[next];
    panel.dataset.accent = genieState.accent;
  });

  // API inspector toggle
  document.getElementById("genieInspectBtn").addEventListener("click", () => setGenieInspect(!genieState.inspect));

  // Pop-out / expand
  document.getElementById("genieExpandBtn").addEventListener("click", () => setGenieExpanded(!genieState.expanded));
  document.getElementById("genieBackdrop").addEventListener("click", () => setGenieExpanded(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && genieState.expanded) setGenieExpanded(false);
  });

  // Resize handle
  const handle = document.getElementById("genieResize");
  let dragging = false;
  let startY = 0;
  let startH = genieState.threadH;
  handle.addEventListener("pointerdown", (e) => {
    dragging = true;
    startY = e.clientY;
    startH = genieState.threadH;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const h = Math.max(140, Math.min(520, startH + (e.clientY - startY)));
    genieState.threadH = h;
    panel.style.setProperty("--genie-thread-h", h + "px");
  });
  handle.addEventListener("pointerup", () => {
    dragging = false;
  });

  // Greeting + chips + input
  appendBot(
    "Hi &mdash; I'm <strong>Genie</strong>, reading live from the lakehouse. Ask about renewal risk, the West incident, or recommended actions. Use <strong>Inspect</strong> to see the governed API call and generated SQL, switch the model, or <strong>pop out</strong> to the full agent in Databricks. <em>(In the published app I answer live via the Genie Conversation API; in local preview you'll see sample answers.)</em>"
  );
  const chips = document.getElementById("genieChips");
  chips.innerHTML = GENIE_CHIPS.map((c) => `<button class="chip" type="button">${c}</button>`).join("");
  chips.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => askGenie(chip.textContent));
  });
  document.getElementById("genieAsk").addEventListener("click", () => {
    askGenie(document.getElementById("genieInput").value);
  });
  document.getElementById("genieInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") askGenie(e.target.value);
  });
}

/* ---------- live Domo data ---------- */

async function fetchRows(alias, limit) {
  if (!window.domo || typeof window.domo.get !== "function") return null;
  try {
    return await window.domo.get(`/data/v1/${alias}?limit=${limit}`);
  } catch (error) {
    console.warn(`Genie portal: falling back to mock for ${alias}`, error);
    return null;
  }
}

function groupAgg(rows, key, field, mode) {
  const map = new Map();
  rows.forEach((row) => {
    const k = row[key] || "Unknown";
    const cur = map.get(k) || { total: 0, count: 0 };
    cur.total += Number(row[field] || 0);
    cur.count += 1;
    map.set(k, cur);
  });
  const out = {};
  map.forEach((v, k) => (out[k] = mode === "avg" ? v.total / Math.max(v.count, 1) : v.total));
  return out;
}

function transformLive(revenue, risk, incidentRows, actions) {
  const netByRegion = groupAgg(revenue, "region", "net_revenue", "sum");
  const riskByRegion = groupAgg(risk, "region", "renewal_risk_score", "avg");
  const exposureByRegion = groupAgg(risk, "region", "revenue_at_risk", "sum");
  const protectedByRegion = groupAgg(actions, "region", "actual_revenue_protected", "sum");
  const breachByRegion = groupAgg(incidentRows, "region", "sla_breach_count", "sum");

  const regionNames = Array.from(
    new Set([...Object.keys(netByRegion), ...Object.keys(riskByRegion)])
  );
  const regions = regionNames.map((region) => ({
    region,
    risk: riskByRegion[region] || 0,
    netRevenue: netByRegion[region] || 0,
    revenueAtRisk: exposureByRegion[region] || 0,
    protectedRevenue: protectedByRegion[region] || 0,
    slaBreaches: breachByRegion[region] || 0,
    hot: region === "West",
  }));

  const trendMap = groupAgg(revenue, "fiscal_period", "net_revenue", "sum");
  const revenueTrend = Object.keys(trendMap)
    .sort()
    .slice(-12)
    .map((k) => trendMap[k] / 1_000_000);

  const inc = incidentRows.find((r) => r.incident_id === "INC-0001") || incidentRows[0] || {};
  const incident = inc.incident_id
    ? {
        incident: inc.incident_id,
        severity: inc.severity || "SEV-1",
        region: inc.region || "West",
        rootCause: inc.root_cause || "Reliability incident impacting renewal risk.",
        affectedAccounts: Number(inc.affected_account_count || 0),
        supportCases: Number(inc.support_case_count || 0),
        slaBreaches: Number(inc.sla_breach_count || 0),
        revenueAtRisk: Number(inc.renewal_revenue_at_risk || 0),
      }
    : MOCK.incident;

  const topActions = actions
    .slice()
    .sort((a, b) => Number(b.expected_revenue_protected || 0) - Number(a.expected_revenue_protected || 0))
    .slice(0, 6)
    .map((row) => ({
      actionId: row.action_id || row.account_id || "action",
      account: row.account_id || "Account",
      region: row.region || "Unknown",
      recommendation: row.recommendation || "Review",
      approval: row.approval_status || "Pending",
      execution: row.execution_status || "Waiting",
      protected: Number(row.expected_revenue_protected || 0),
    }));

  return {
    regions,
    revenueTrend: revenueTrend.length ? revenueTrend : MOCK.revenueTrend,
    incident,
    actions: topActions.length ? topActions : MOCK.actions,
  };
}

async function loadData() {
  const [revenue, risk, incidentRows, actions] = await Promise.all([
    fetchRows("executiveRevenueHealth", 5000),
    fetchRows("customerRenewalRisk", 5000),
    fetchRows("incidentRevenueImpact", 200),
    fetchRows("agentActionQueue", 5000),
  ]);

  if (revenue && risk && incidentRows && actions) {
    state.mode = "live";
    state.data = transformLive(revenue, risk, incidentRows, actions);
  } else {
    state.mode = "mock";
    state.data = MOCK;
  }
}

/* ---------- init ---------- */

/* ---------- custom dropdown ---------- */

const PERSONA_OPTIONS = [
  { value: "Executive Sponsor", label: "Executive Sponsor", sub: "all regions" },
  { value: "West Regional Manager", label: "West Regional Manager", sub: "West" },
  { value: "East Regional Manager", label: "East Regional Manager", sub: "East" },
  { value: "West Account Owner", label: "West Account Owner", sub: "assigned accounts" },
];

function createSelect(container, options, value, onChange) {
  let open = false;
  let current = value;

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const valueEl = document.createElement("span");
  valueEl.className = "select-value";
  const caret = document.createElement("span");
  caret.className = "select-caret";
  trigger.append(valueEl, caret);

  const menu = document.createElement("div");
  menu.className = "select-menu";
  menu.setAttribute("role", "listbox");

  function syncLabel() {
    const opt = options.find((o) => o.value === current) || options[0];
    valueEl.textContent = opt.label;
  }

  function renderOptions() {
    menu.innerHTML = options
      .map(
        (o) => `
          <div class="select-option" role="option" data-value="${o.value}"
               aria-selected="${o.value === current}">
            <span>${o.label}${o.sub ? ` <span style="color:var(--muted);"> · ${o.sub}</span>` : ""}</span>
            <span class="check" aria-hidden="true"></span>
          </div>`
      )
      .join("");
    menu.querySelectorAll(".select-option").forEach((el) => {
      el.addEventListener("click", () => {
        current = el.getAttribute("data-value");
        syncLabel();
        renderOptions();
        setOpen(false);
        onChange(current);
      });
    });
  }

  function setOpen(next) {
    open = next;
    container.classList.toggle("open", open);
    trigger.setAttribute("aria-expanded", String(open));
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(!open);
  });

  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) setOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });

  container.append(trigger, menu);
  syncLabel();
  renderOptions();

  // Preview-only hook for verification screenshots; no effect in normal use.
  if (window.location.hash === "#open-persona") setOpen(true);
}

function wireEvents() {
  createSelect(
    document.getElementById("personaSelect"),
    PERSONA_OPTIONS,
    state.persona,
    (value) => {
      state.persona = value;
      render();
    }
  );
}

// Track the last pointer position so click-triggered overlays can anchor to where the user
// clicked. In the Domo App Studio iframe the app renders at full content height (no internal
// scroll), so position:fixed centering lands far down the page; anchoring to the click keeps
// modals/drawers in view.
var LAST_CLICK = { clientY: 120, pageY: 120 };
function trackPointer(e) {
  if (typeof e.clientY === "number") LAST_CLICK = { clientY: e.clientY, pageY: e.pageY != null ? e.pageY : e.clientY };
}

async function init() {
  document.addEventListener("pointerdown", trackPointer, true);
  document.addEventListener("click", trackPointer, true);
  // Route every external (http/https) link through domo.navigate so it opens directly in a
  // new tab via the parent frame — anchor target=_blank is blocked in the sandboxed iframe.
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (/^https?:\/\//i.test(href)) {
      e.preventDefault();
      openExternal(href);
    }
  });
  wireEvents();
  wireTabs();
  wireForecastControls();
  initGenie();
  await loadReadiness();
  renderGuide();
  renderReadiness();
  refreshDomoReadinessLive();
  renderMl();
  renderLakebase();
  loadLakebaseLive();
  await loadData();
  render();
  document.getElementById("readinessSyncBtn")?.addEventListener("click", syncReadinessDemo);
  const hashView = { "#ml": "ml", "#lakebase": "lakebase", "#readiness": "readiness", "#genie": "genie", "#genie-embed": "genieEmbed", "#guide": "guide" }[window.location.hash];
  if (hashView) activateView(hashView);
  if (window.location.hash === "#genie-demo") {
    activateView("genie");
    setGenieInspect(true);
    askGenie("Why did renewal risk increase for West enterprise accounts?");
  }
}

init();
