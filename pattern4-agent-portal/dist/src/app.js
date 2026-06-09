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

// 24 months of total net revenue (USD). Seasonal climb, an incident dip near the
// recent past, then modeled recovery. todayIdx splits actual (<=) from forecast (>).
const FORECAST_BASE = {
  todayIdx: 17, // 18 months of actuals, 6 months of forecast horizon
  monthly: [
    9.6, 9.9, 10.2, 10.4, 10.1, 10.6, 11.0, 11.3, 11.1, 11.6,
    12.0, 12.4, 12.2, 12.7, 12.1, 11.3, 11.7, 12.3, // <- index 15/16 = incident dip + early recovery
    12.9, 13.4, 13.9, 14.3, 14.7, 15.1, // forecast horizon
  ].map((m) => m * 1_000_000),
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ML_MODEL = {
  name: "pattern4_renewal_risk",
  registry: "databricks_raptor.pattern4_agent_automation.pattern4_renewal_risk",
  endpoint: "pattern4-renewal-risk",
  flavor: "LightGBM · sklearn pipeline",
  target: "predicted_churn_probability",
  features: [
    { key: "segment", label: "Segment", type: "select", options: ["Enterprise", "Mid-Market", "SMB"], value: "Enterprise" },
    { key: "region", label: "Region", type: "select", options: ["West", "East", "Central", "South"], value: "West" },
    { key: "annual_recurring_revenue", label: "ARR (USD)", type: "number", value: 1_330_000 },
    { key: "cases_90d", label: "Support cases (90d)", type: "number", value: 41 },
    { key: "sla_breaches_90d", label: "SLA breaches (90d)", type: "number", value: 12 },
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
  "Which accounts were most affected by incident INC-0001?",
  "How much revenue is at risk because of SLA breaches?",
  "Which recommended actions should the regional manager approve first?",
  "Did approved agent actions reduce revenue at risk after the incident?",
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
  mlServing: false, // flip true once the Model Serving endpoint + runModelInference are live
  lakebaseLive: false, // flip true once cobra-v1 tables + CE Lakebase functions are wired
  lakebase: {
    scenarios: LAKEBASE_MOCK.scenarios.slice(),
    feedback: LAKEBASE_MOCK.feedback.slice(),
    selectedScenarioId: 1,
    editingScenario: null,
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

const forecastState = { range: 18, confidence: true, hoverIdx: null };

// Build the actual/forecast/confidence series for the hero chart, scaled per persona.
function buildForecast(scale) {
  const s = scale || 1;
  const today = new Date();
  const base = FORECAST_BASE.monthly;
  const todayIdx = FORECAST_BASE.todayIdx;
  const n = base.length;

  const points = base.map((raw, i) => {
    const value = raw * s;
    const isFuture = i > todayIdx;
    const monthsOut = Math.max(0, i - todayIdx);
    // Model forecast line: smoothed fit over actuals, projection over the horizon.
    const forecast = value * (isFuture ? 1 : 0.992 + 0.004 * Math.sin(i));
    // Confidence band widens into the future; tight (recent fit) near today.
    const bandPct = isFuture ? 0.02 + 0.018 * monthsOut : i >= todayIdx - 2 ? 0.012 : 0;
    const d = new Date(today.getFullYear(), today.getMonth() - (todayIdx - i), 1);
    return {
      idx: i,
      label: MONTH_NAMES[d.getMonth()],
      year: d.getFullYear(),
      monthLabel: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
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
  document.getElementById("kpiProtected").textContent = fmtCurrency(view.kpis.protectedRevenue);
  document.getElementById("kpiBreaches").textContent = fmtNumber(view.kpis.slaBreaches);

  const netDelta = pctDelta(view.trend);
  const netEl = document.getElementById("kpiNetDelta");
  netEl.textContent = `${netDelta >= 0 ? "▲" : "▼"} ${Math.abs(netDelta).toFixed(1)}%`;
  netEl.className = `kpi-delta ${netDelta >= 0 ? "up" : "down"}`;

  document.getElementById("kpiRiskDelta").textContent = "▲ exposure";
  document.getElementById("kpiProtectedDelta").textContent = "▲ recovered";
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

function renderActions(actions) {
  const body = document.getElementById("actionRows");
  if (!actions.length) {
    body.innerHTML = `<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:22px;">No agent actions in scope.</td></tr>`;
    return;
  }
  body.innerHTML = actions
    .map(
      (a) => `
        <tr>
          <td><strong>${a.account}</strong></td>
          <td>${a.recommendation}</td>
          <td><span class="status ${a.approval.toLowerCase()}">${a.approval}</span></td>
          <td>
            <span class="status ${a.execution.toLowerCase()}">${a.execution}</span>
            ${
              a.execution === "Waiting" || a.approval === "Pending"
                ? `<button class="action-btn" type="button" data-action-id="${escapeHtml(a.actionId)}">Execute</button>`
                : ""
            }
          </td>
          <td class="num">${fmtCurrency(a.protected)}</td>
        </tr>
      `
    )
    .join("");
  document.querySelectorAll(".action-btn[data-action-id]").forEach((button) => {
    button.addEventListener("click", () => executeAction(button));
  });
}

async function executeAction(button) {
  const actionId = button.getAttribute("data-action-id");
  button.textContent = "Writing...";
  button.disabled = true;
  try {
    const result = await writeActionStatus(actionId);
    if (result?.status === "SUCCEEDED") {
      button.textContent = "Written";
      button.classList.add("done");
    } else {
      throw new Error(result?.error ? JSON.stringify(result.error) : "writeback failed");
    }
  } catch (error) {
    console.warn("Action writeback failed; showing demo state", error);
    button.textContent = "Demo write";
    button.classList.add("error");
  }
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
      <div class="dataset-card">
        <div class="alias">${tick}${d.name}</div>
        <div class="object">${d.object}</div>
      </div>
    `
  ).join("");
}

/* ---------- ML Predictions ---------- */

function renderMlStatus() {
  const stateEl = document.getElementById("mlModelState");
  if (stateEl) {
    stateEl.textContent = state.mlServing ? "Serving · live" : "Planned · mock";
    stateEl.classList.toggle("live", !!state.mlServing);
  }
  const grid = document.getElementById("mlMetaGrid");
  if (!grid) return;
  const meta = [
    ["Model", ML_MODEL.name],
    ["Flavor", ML_MODEL.flavor],
    ["UC registry", ML_MODEL.registry],
    ["Serving endpoint", ML_MODEL.endpoint],
    ["Target", ML_MODEL.target],
    ["Governed by", "Unity Catalog + Domo AI Services"],
  ];
  grid.innerHTML = meta
    .map(([k, v]) => `<div class="ml-meta"><span class="ml-meta-k">${escapeHtml(k)}</span><span class="ml-meta-v">${escapeHtml(v)}</span></div>`)
    .join("");
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

// Heuristic stand-in for the served model until pattern4ce.runModelInference is wired.
function mockPredict(f) {
  let z = -2.4;
  z += (f.sla_breaches_90d || 0) * 0.12;
  z += (f.cases_90d || 0) * 0.012;
  z += (f.usage_drop_days_90d || 0) * 0.04;
  z += (60 - (f.avg_usage_score_90d || 60)) * 0.03;
  z += Math.max(0, 90 - (f.days_to_renewal || 90)) * 0.012;
  if (f.segment === "Enterprise") z += 0.25;
  if (f.region === "West") z += 0.6;
  const prob = 1 / (1 + Math.exp(-z));
  const arr = Number(f.annual_recurring_revenue || 0);
  const drivers = [
    { k: "SLA breaches (90d)", v: (f.sla_breaches_90d || 0) * 0.12 },
    { k: "Usage-drop days", v: (f.usage_drop_days_90d || 0) * 0.04 },
    { k: "Support cases", v: (f.cases_90d || 0) * 0.012 },
    { k: "Days to renewal", v: Math.max(0, 90 - (f.days_to_renewal || 90)) * 0.012 },
    { k: "Region = West", v: f.region === "West" ? 0.6 : 0 },
  ].filter((d) => d.v > 0).sort((a, b) => b.v - a.v).slice(0, 4);
  return {
    probability: prob,
    revenueAtRisk: arr * prob,
    tier: prob >= 0.6 ? "High" : prob >= 0.35 ? "Medium" : "Low",
    drivers,
    action: prob >= 0.6 ? "Executive outreach + reliability credit review" : prob >= 0.35 ? "Technical success plan" : "Monitor — standard renewal motion",
  };
}

async function runInference() {
  const f = collectMlFeatures();
  const tag = document.getElementById("mlResultTag");
  const host = document.getElementById("mlResult");
  if (tag) tag.textContent = "scoring…";
  // Live path (when serving + CE function exist): pattern4ce.runModelInference
  let r = null;
  if (window.domo && typeof window.domo.post === "function" && state.mlServing) {
    try {
      const resp = await window.domo.post("/domo/codeengine/v2/packages/runModelInference", { records: [f] });
      const out = unwrapCodeEngineResponse(resp);
      if (out && Array.isArray(out.predictions) && out.predictions.length) {
        const prob = Number(out.predictions[0]);
        const arr = Number(f.annual_recurring_revenue || 0);
        r = { probability: prob, revenueAtRisk: arr * prob, tier: prob >= 0.6 ? "High" : prob >= 0.35 ? "Medium" : "Low", drivers: [], action: prob >= 0.6 ? "Executive outreach" : "Monitor", live: true };
      }
    } catch (e) {
      console.warn("runModelInference failed; using local model", e);
    }
  }
  if (!r) r = mockPredict(f);
  if (tag) tag.textContent = r.live ? "live · Model Serving" : "modeled · preview";

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
      const note = document.getElementById("mlFbNote");
      if (note) note.textContent = "saving...";
      try {
        await savePredictionFeedback({
          predictionId: `preview-${Date.now()}`,
          entityType: "account",
          entityId: `${f.region || "Unknown"} ${f.segment || "Account"}`,
          feedback: b.getAttribute("data-fb"),
          predictedValue: r.probability,
          correctedValue: null,
          comment: `Prediction ${b.getAttribute("data-fb")} from ML Predictions page`,
          createdBy: "demo.user@domo.com",
        });
        if (note) note.textContent = state.lakebaseLive ? "saved to Lakebase" : "captured locally";
      } catch (error) {
        if (note) note.textContent = "save failed";
        console.warn("Prediction feedback save failed", error);
      }
    })
  );
}

function renderMl() {
  renderMlStatus();
  renderMlForm();
  const note = document.getElementById("mlFormNote");
  if (note) note.textContent = state.mlServing
    ? "Calls pattern4ce.runModelInference → Databricks Model Serving."
    : "Model Serving is staged; this scores with the registered feature logic for preview.";
  const btn = document.getElementById("mlRunBtn");
  if (btn && !btn.dataset.wired) { btn.addEventListener("click", runInference); btn.dataset.wired = "1"; }
}

/* ---------- Lakebase Ops ---------- */

async function callPattern4ce(fnName, payload) {
  if (!window.domo || typeof window.domo.post !== "function") {
    throw new Error("Domo runtime unavailable");
  }
  const response = await window.domo.post(`/domo/codeengine/v2/packages/${fnName}`, payload || {});
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
      callPattern4ce("listScenarios", {}),
      callPattern4ce("listPredictionFeedback", {}),
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

function renderLakebase() {
  const stateEl = document.getElementById("lakebaseState");
  if (stateEl) {
    stateEl.textContent = state.lakebaseLive ? "Live · cobra-v1" : "Planned · mock";
    stateEl.classList.toggle("live", !!state.lakebaseLive);
  }
  const grid = document.getElementById("lakebaseMetaGrid");
  if (grid) {
    const meta = [
      ["Project", "projects/cobra-v1"],
      ["Database", "databricks_postgres"],
      ["Tables", "p4_scenario_runs · p4_prediction_feedback"],
      ["Access", "pattern4ce → node-postgres (SP M2M)"],
      ["Mode", state.lakebaseLive ? "Live read/write" : "Preview fallback"],
    ];
    grid.innerHTML = meta.map(([k, v]) => `<div class="ml-meta"><span class="ml-meta-k">${escapeHtml(k)}</span><span class="ml-meta-v">${escapeHtml(v)}</span></div>`).join("");
  }

  const countTag = document.getElementById("scenarioCountTag");
  if (countTag) countTag.textContent = `${state.lakebase.scenarios.length} scenario rows`;

  const rows = document.getElementById("scenarioRows");
  if (rows) {
    if (!state.lakebase.scenarios.length) {
      rows.innerHTML = `<tr><td colspan="5" class="empty-state">No scenario runs yet — add one to write operational state to Lakebase.</td></tr>`;
    } else {
      rows.innerHTML = state.lakebase.scenarios
      .map((s) => `
        <tr class="${state.lakebase.selectedScenarioId === s.id ? "selected-row" : ""}" data-scenario-id="${s.id}">
          <td><strong>${escapeHtml(s.name)}</strong><div class="row-sub">${escapeHtml(s.created_at ? new Date(s.created_at).toLocaleDateString() : "Lakebase scenario")}</div></td>
          <td><span class="status ${s.status}">${s.status}</span></td>
          <td>${escapeHtml(s.created_by)}</td>
          <td class="num ${s.delta >= 0 ? "pos" : "neg"}">${s.delta >= 0 ? "+" : ""}${fmtCurrency(s.delta)}</td>
          <td class="num">
            <button class="btn-icon" type="button" title="Edit" data-scenario-edit="${s.id}">✎</button>
            <button class="btn-icon btn-icon-danger" type="button" title="Delete" data-scenario-delete="${s.id}">✕</button>
          </td>
        </tr>`)
      .join("");
    }
    rows.querySelectorAll("[data-scenario-id]").forEach((row) => {
      row.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        state.lakebase.selectedScenarioId = Number(row.getAttribute("data-scenario-id"));
        renderLakebase();
      });
    });
    rows.querySelectorAll("[data-scenario-edit]").forEach((btn) => {
      btn.addEventListener("click", () => showScenarioForm(state.lakebase.scenarios.find((s) => s.id === Number(btn.getAttribute("data-scenario-edit")))));
    });
    rows.querySelectorAll("[data-scenario-delete]").forEach((btn) => {
      btn.addEventListener("click", () => deleteScenario(Number(btn.getAttribute("data-scenario-delete"))));
    });
  }
  renderScenarioDetail();
  const fb = document.getElementById("feedbackList");
  if (fb) {
    fb.innerHTML = state.lakebase.feedback
      .map((f) => `
        <div class="feedback-item">
          <div class="fb-top"><span class="fb-acct">${escapeHtml(f.entity_id || f.account || "Prediction")}</span><span class="fb-tag ${f.feedback}">${f.feedback}</span></div>
          <p>${escapeHtml(f.comment || f.note || "Feedback captured from prediction review.")}</p>
          <span class="fb-by">${escapeHtml(f.created_by || f.by || "demo.user@domo.com")}${f.predicted_value ? ` · predicted ${Math.round(Number(f.predicted_value) * 100)}%` : ""}</span>
        </div>`)
      .join("");
  }
  const refresh = document.getElementById("lakebaseRefreshBtn");
  if (refresh && !refresh.dataset.wired) {
    refresh.addEventListener("click", loadLakebaseLive);
    refresh.dataset.wired = "1";
  }
  const add = document.getElementById("lakebaseAddBtn");
  if (add && !add.dataset.wired) {
    add.addEventListener("click", () => showScenarioForm(null));
    add.dataset.wired = "1";
  }
  const cancel = document.getElementById("lakebaseCancelBtn");
  if (cancel && !cancel.dataset.wired) {
    cancel.addEventListener("click", hideScenarioForm);
    cancel.dataset.wired = "1";
  }
  const form = document.getElementById("lakebaseScenarioForm");
  if (form && !form.dataset.wired) {
    form.addEventListener("submit", saveScenarioFromForm);
    form.dataset.wired = "1";
  }
}

function renderScenarioDetail() {
  const detail = document.getElementById("scenarioDetail");
  if (!detail) return;
  const scenario = state.lakebase.scenarios.find((s) => s.id === state.lakebase.selectedScenarioId) || state.lakebase.scenarios[0];
  if (!scenario) {
    detail.innerHTML = "";
    return;
  }
  const assumptionText = JSON.stringify(scenario.assumptions || {}, null, 2);
  const resultText = JSON.stringify(scenario.results || {}, null, 2);
  detail.innerHTML = `
    <div class="scenario-detail-head">
      <div><span class="panel-tag">selected run</span><h3>${escapeHtml(scenario.name)}</h3></div>
      <button class="btn btn-secondary btn-sm" type="button" data-scenario-edit="${scenario.id}">Edit selected</button>
    </div>
    <div class="scenario-json-grid">
      <div><b>Assumptions</b><pre>${escapeHtml(assumptionText)}</pre></div>
      <div><b>Results</b><pre>${escapeHtml(resultText)}</pre></div>
    </div>`;
  detail.querySelector("[data-scenario-edit]")?.addEventListener("click", () => showScenarioForm(scenario));
}

function showScenarioForm(scenario) {
  state.lakebase.editingScenario = scenario || null;
  const panel = document.getElementById("lakebaseScenarioFormPanel");
  panel?.classList.remove("is-hidden");
  document.getElementById("lakebaseFormTitle").textContent = scenario ? `Edit Scenario #${scenario.id}` : "Add Scenario";
  document.getElementById("scenarioNameInput").value = scenario?.name || "";
  document.getElementById("scenarioStatusInput").value = scenario?.status || "draft";
  document.getElementById("scenarioOwnerInput").value = scenario?.created_by || "demo.user@domo.com";
  document.getElementById("scenarioDeltaInput").value = scenario?.delta || 0;
  document.getElementById("scenarioAssumptionsInput").value = JSON.stringify(scenario?.assumptions || { source: "manual", region: "West" }, null, 2);
}

function hideScenarioForm() {
  state.lakebase.editingScenario = null;
  document.getElementById("lakebaseScenarioFormPanel")?.classList.add("is-hidden");
}

async function saveScenarioFromForm(event) {
  event.preventDefault();
  const editing = state.lakebase.editingScenario;
  const assumptions = safeJson(document.getElementById("scenarioAssumptionsInput").value, {});
  const delta = Number(document.getElementById("scenarioDeltaInput").value || 0);
  const payload = {
    id: editing?.id,
    name: document.getElementById("scenarioNameInput").value,
    status: document.getElementById("scenarioStatusInput").value,
    createdBy: document.getElementById("scenarioOwnerInput").value,
    assumptions,
    results: { forecast_delta: delta, source: "Revenue Command Center" },
  };
  const saveBtn = document.getElementById("lakebaseSaveBtn");
  saveBtn.textContent = "Saving...";
  saveBtn.disabled = true;
  try {
    if (state.lakebaseLive) {
      const result = await callPattern4ce(editing ? "updateScenario" : "createScenario", payload);
      const row = normalizeScenario((result.rows && result.rows[0]) || result.row || payload);
      if (editing) {
        state.lakebase.scenarios = state.lakebase.scenarios.map((s) => s.id === editing.id ? row : s);
      } else {
        state.lakebase.scenarios.unshift(row);
        state.lakebase.selectedScenarioId = row.id;
      }
    } else if (editing) {
      state.lakebase.scenarios = state.lakebase.scenarios.map((s) => s.id === editing.id ? normalizeScenario({ ...s, ...payload, delta }) : s);
    } else {
      const next = normalizeScenario({ ...payload, id: Date.now(), delta });
      state.lakebase.scenarios.unshift(next);
      state.lakebase.selectedScenarioId = next.id;
    }
    hideScenarioForm();
    renderLakebase();
  } catch (error) {
    state.lakebase.error = error.message || "Unable to save scenario";
    console.warn("Scenario save failed", error);
  } finally {
    saveBtn.textContent = "Save scenario";
    saveBtn.disabled = false;
  }
}

async function deleteScenario(id) {
  if (!id) return;
  try {
    if (state.lakebaseLive) await callPattern4ce("deleteScenario", { id });
    state.lakebase.scenarios = state.lakebase.scenarios.filter((s) => s.id !== id);
    state.lakebase.selectedScenarioId = state.lakebase.scenarios[0]?.id || null;
    renderLakebase();
  } catch (error) {
    console.warn("Scenario delete failed", error);
  }
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
};

const FLOW_STAGES = [
  {
    id: "uc", name: "Unity Catalog Gold", sub: "Governed semantic layer", plane: "dbx", icon: "data",
    lead: "The single source of truth. Five governed gold views in databricks_raptor.pattern4_agent_automation define revenue, risk, incidents, actions, and access.",
    bullets: ["Metric views + gold tables over medallion data", "ABAC row filters and full lineage", "Same definitions feed Genie and Domo — no metric drift"],
    input: "Bronze / Silver Delta + synthetic generator",
    output: "5 governed gold views",
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
    lead: "The five gold views surface in Domo as direct-federated DataSets, mapped to the pro-code app by stable aliases.",
    bullets: ["executiveRevenueHealth · customerRenewalRisk · incidentRevenueImpact", "agentActionQueue · portalUserScope", "PDP-ready for per-persona scoping"],
    input: "Cloud Amplifier connection",
    output: "5 alias-mapped DataSets",
    governed: "Domo PDP ↔ UC row filters",
  },
  {
    id: "app", name: "Pro-code Portal", sub: "Governed experience", plane: "domo", icon: "app",
    lead: "This application. A persona-scoped command center: KPIs, regional risk, incident root cause, the action queue, and governed lineage.",
    bullets: ["Reads DataSets by alias (Query API)", "Persona scoping mirrors entitlements", "Domo styleguide UI, Databricks-governed data"],
    input: "Domo DataSets (aliases)",
    output: "Executive command center",
    governed: "Domo SSO + PDP",
  },
  {
    id: "genie", name: "Databricks Genie", sub: "Natural-language reasoning", plane: "dbx", icon: "genie",
    lead: "Genie answers 'why did this change?' in natural language over the exact same governed gold views, returning a cited root cause.",
    bullets: ["Conversation API: start-conversation / create-message", "Genie Space instructions encode the business context", "Answers cite governed metrics + generated SQL"],
    input: "User question + UC context",
    output: "Root-cause answer + SQL",
    governed: "Unity Catalog + Genie Space",
  },
  {
    id: "gw", name: "Unity AI Gateway + MCP", sub: "Governed agent handoff", plane: "both", icon: "gateway",
    lead: "The agent-to-agent boundary. Databricks Agent Bricks is served over MCP; Domo's agent consumes it on-behalf-of the user, fully audited.",
    bullets: ["On-behalf-of (OBO) identity", "Rate limits + prompt-injection / content filters", "Dual audit trail across both planes"],
    input: "Agent tool calls (MCP)",
    output: "Governed, audited responses",
    governed: "Unity AI Gateway — OBO, policy, audit",
  },
  {
    id: "act", name: "Agent Catalyst + Workflows", sub: "Action & writeback", plane: "domo", icon: "action",
    lead: "The action runtime. Domo plans and executes the response with human sign-off, then writes status back so the dashboard reflects reality.",
    bullets: ["Recommendation → approval → execution", "Code Engine shapes custom action payloads", "Status writeback to Lakebase / dataset"],
    input: "Genie reasoning + risk signals",
    output: "Approved action + status writeback",
    governed: "Domo RBAC + approval gates",
  },
];

const GUIDE_STEPS = [
  { title: "Choose your persona", desc: "Use the Viewing as menu. The view rescopes to your region or accounts — the same entitlement enforced by UC row filters and Domo PDP." },
  { title: "Scan the KPI strip", desc: "Net Revenue (with trend), Revenue at Risk, Protected Revenue, and SLA Breaches give the health of your scope at a glance." },
  { title: "Find the hotspot", desc: "Regional Renewal Risk ranks regions; the West enterprise hotspot separates clearly from the control regions." },
  { title: "Ask Genie why", desc: "Use the Genie panel to ask the lakehouse a natural-language question. It explains the root cause from the same governed data." },
  { title: "Review recommendations", desc: "The Agent Action Queue lists Genie-informed actions with their approval and execution state and the revenue each protects." },
  { title: "Approve & writeback", desc: "Material actions require human sign-off. Once approved, execution status and protected revenue update back in the portal." },
  { title: "Trust the governance", desc: "Lineage shows live federation via Cloud Amplifier — no copies. Unity Catalog, Unity AI Gateway, and Domo PDP enforce access end to end." },
];

const ARCH = {
  dbx: [
    { name: "Unity Catalog", sub: "Governance, lineage, ABAC" },
    { name: "Delta gold tables / views", sub: "Revenue, risk, incidents, actions" },
    { name: "Genie Space", sub: "NL access to governed metrics" },
    { name: "Agent Bricks", sub: "Reasoning agent · multi-model" },
    { name: "Model Serving + MLflow", sub: "Forecast / scoring endpoints" },
    { name: "Mosaic AI Vector Search", sub: "RAG over governed content" },
    { name: "Unity AI Gateway", sub: "Governs model + MCP calls" },
    { name: "Lakebase", sub: "Agent memory + OLTP state" },
  ],
  interop: [
    { name: "MCP", sub: "Agent ⇄ agent tool protocol" },
    { name: "Unity AI Gateway", sub: "OBO · limits · audit · filters" },
    { name: "Shared Identity", sub: "SSO / OAuth U2M / OBO" },
    { name: "Domo PDP ↔ UC filters", sub: "One entitlement model" },
  ],
  domo: [
    { name: "Cloud Amplifier", sub: "Live federated query (no copy)" },
    { name: "Domo DataSets", sub: "5 alias-mapped gold views" },
    { name: "Pro-code App", sub: "This portal · experience + action" },
    { name: "Agent Catalyst", sub: "Plans & executes the response" },
    { name: "Workflows + approvals", sub: "Human-in-the-loop sign-off" },
    { name: "Code Engine", sub: "Custom governed functions / APIs" },
    { name: "AI Service Layer", sub: "Databricks ML connector in Domo" },
  ],
};

const REQUIREMENTS = [
  { k: "Identity", v: "SSO · OAuth U2M · OBO" },
  { k: "Governance", v: "Unity Catalog + AI Gateway + Domo PDP" },
  { k: "Safety", v: "Injection / content filters · limits" },
  { k: "Human-in-loop", v: "Sign-off on writes & actions" },
  { k: "Observability", v: "Audit · lineage · agent eval" },
  { k: "State", v: "Lakebase memory + run status" },
];

function planeLabel(plane) {
  return plane === "dbx" ? "Databricks" : plane === "domo" ? "Domo" : "Interop";
}

function renderFlow() {
  const rail = document.getElementById("flowRail");
  rail.innerHTML = FLOW_STAGES.map((s, i) => {
    const stage = `
      <button class="flow-stage ${s.plane}" type="button" data-id="${s.id}">
        <span class="stage-ic">${ICONS[s.icon]}</span>
        <span class="flow-plane ${s.plane}">${planeLabel(s.plane)}</span>
        <span class="stage-name">${s.name}</span>
        <span class="stage-sub">${s.sub}</span>
      </button>`;
    const arrow = i < FLOW_STAGES.length - 1 ? '<span class="flow-arrow" aria-hidden="true"></span>' : "";
    return stage + arrow;
  }).join("");
  rail.querySelectorAll(".flow-stage").forEach((el) => {
    el.addEventListener("click", () => selectStage(el.getAttribute("data-id")));
  });
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
    const res = await fetch("./public/ai-readiness-summary.json", { cache: "no-store" });
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
    }));
  }
}

function renderReadiness() {
  const grid = document.getElementById("readinessGrid");
  if (!grid) return;
  grid.innerHTML = state.readiness
    .map((item) => {
      const pct = item.columnCount ? Math.round((item.aiEnabledCount / item.columnCount) * 100) : 0;
      return `
        <article class="readiness-card ${state.readinessSelected === item.alias ? "active" : ""}" data-readiness-alias="${escapeHtml(item.alias)}">
          <div class="readiness-top">
            <div class="readiness-title">${escapeHtml(item.alias)}</div>
            <div class="readiness-status ${state.readinessSynced ? "synced" : ""}">
              ${state.readinessSynced ? "Synced" : "Ready"}
            </div>
          </div>
          <p>${escapeHtml(item.context || "Unity Catalog context ready to mirror into Domo AI Readiness.")}</p>
          <div class="readiness-progress"><span style="width:${pct}%"></span></div>
          <div class="readiness-metrics">
            <div class="readiness-metric"><b>${item.aiEnabledCount}/${item.columnCount}</b><span>AI cols</span></div>
            <div class="readiness-metric"><b>${item.synonymCount}</b><span>synonyms</span></div>
            <div class="readiness-metric"><b>${item.tagCount}</b><span>UC tags</span></div>
          </div>
        </article>
      `;
    })
    .join("");
  grid.querySelectorAll("[data-readiness-alias]").forEach((card) => {
    card.addEventListener("click", () => {
      state.readinessSelected = card.getAttribute("data-readiness-alias");
      renderReadiness();
    });
  });
  renderReadinessDetail();
}

function domoDatasetUrl(item) {
  return `https://databricks-demo.domo.com/datasources/${item.datasetId}/details/settings/ai-readiness`;
}

function databricksTableUrl(item) {
  return `${WORKSPACE_HOST}/explore/data/${encodeURIComponent(item.object || "")}`;
}

function openExternal(url) {
  if (!url) return;
  if (window.domo && typeof window.domo.navigate === "function") {
    window.domo.navigate(url, true);
  } else {
    window.open(url, "_blank", "noopener");
  }
}

function renderReadinessDetail() {
  const detail = document.getElementById("readinessDetail");
  if (!detail) return;
  const item = state.readiness.find((r) => r.alias === state.readinessSelected) || state.readiness[0];
  if (!item) {
    detail.innerHTML = `<p class="empty-state">No readiness records loaded.</p>`;
    return;
  }
  const pct = item.columnCount ? Math.round((item.aiEnabledCount / item.columnCount) * 100) : 0;
  detail.innerHTML = `
    <div class="readiness-detail-top">
      <span class="panel-tag">selected dataset</span>
      <h3>${escapeHtml(item.alias)}</h3>
      <p>${escapeHtml(item.context || "")}</p>
    </div>
    <div class="readiness-score">
      <b>${pct}%</b>
      <span>AI-enabled columns</span>
      <div class="readiness-progress"><span style="width:${pct}%"></span></div>
    </div>
    <dl class="readiness-kv">
      <div><dt>Domo dataset</dt><dd>${escapeHtml(item.datasetId || "")}</dd></div>
      <div><dt>Unity Catalog table</dt><dd>${escapeHtml(item.object || "")}</dd></div>
      <div><dt>Readiness assets</dt><dd>${item.synonymCount || 0} synonyms · ${item.tagCount || 0} UC tags</dd></div>
    </dl>
    <div class="readiness-actions">
      <button class="btn btn-primary btn-sm" type="button" data-open-url="${escapeHtml(domoDatasetUrl(item))}">Open Domo AI Readiness</button>
      <button class="btn btn-secondary btn-sm" type="button" data-open-url="${escapeHtml(databricksTableUrl(item))}">Open Databricks Table</button>
    </div>`;
  detail.querySelectorAll("[data-open-url]").forEach((btn) => {
    btn.addEventListener("click", () => openExternal(btn.getAttribute("data-open-url")));
  });
}

function syncReadinessDemo() {
  state.readinessSynced = true;
  const note = document.getElementById("readinessNote");
  note.classList.add("done");
  note.textContent =
    "Readiness manifest applied for demo: UC comments, UC tags, dataset context, synonyms, and AI-enabled column selections are ready to mirror into Domo AI Readiness. Public Domo AI Readiness writes are UI-managed today; this button represents the governed update action and future internal/API wiring.";
  renderReadiness();
}

const VIEW_IDS = {
  forecast: "viewForecast",
  ml: "viewMl",
  lakebase: "viewLakebase",
  readiness: "viewReadiness",
  genie: "viewGenie",
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
}

function wireTabs() {
  document.querySelectorAll(".view-tab").forEach((tab) => {
    tab.addEventListener("click", () => activateView(tab.getAttribute("data-view")));
  });
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
    "Hi &mdash; I'm <strong>Genie</strong>, reading live from the lakehouse. Ask about renewal risk, the West incident, or recommended actions. Use <strong>Inspect</strong> to see the governed API call, switch the model, or <strong>pop out</strong> to the full agent in Databricks. <em>(Preview responses; live Conversation API wiring is staged next.)</em>"
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

async function init() {
  wireEvents();
  wireTabs();
  wireForecastControls();
  initGenie();
  await loadReadiness();
  renderGuide();
  renderReadiness();
  renderMl();
  renderLakebase();
  loadLakebaseLive();
  await loadData();
  render();
  document.getElementById("readinessSyncBtn")?.addEventListener("click", syncReadinessDemo);
  const hashView = { "#ml": "ml", "#lakebase": "lakebase", "#readiness": "readiness", "#genie": "genie", "#guide": "guide" }[window.location.hash];
  if (hashView) activateView(hashView);
  if (window.location.hash === "#genie-demo") {
    activateView("genie");
    setGenieInspect(true);
    askGenie("Why did renewal risk increase for West enterprise accounts?");
  }
}

init();
