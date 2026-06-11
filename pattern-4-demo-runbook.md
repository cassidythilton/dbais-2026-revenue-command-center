# Pattern 4 — Revenue Command Center: Demo Runbook

Sprint 6 packaging. Everything a presenter needs to run, reset, and explain the demo,
plus known limitations and fallbacks. This is the **demo-day source of truth**; the build
plan (`pattern-4-agent-to-agent-automation-scope-build-plan.md`) remains the
engineering/scope source of truth.

---

## 1. What this demo proves

> Databricks is the governed intelligence plane; Domo is the business delivery + action
> plane. One identity, one governed metric layer, surfaced as an executive command center
> that **predicts** (ML), **explains** (Genie), and **acts** (agent actions + writeback).

The five-act story: forecast headwind → Genie root-cause → ML scoring of an at-risk
account → human-approved agent action with writeback → governed AI Readiness + lineage.

---

## 2. Environment & IDs (quick reference)

| Thing | Value |
| --- | --- |
| Domo instance | `https://databricks-demo.domo.com/` |
| App Studio app / view | `105910661` / `1913185115` |
| App design id | `e8a0b5da-d20b-450d-8790-de7ef1634ea7` |
| Live app instance | `793a830f-db93-468d-98a9-5447d3847bdb` |
| Code Engine package | `pattern4ce` (`36a18258-0fb7-407a-b268-4a326c5b73c3`), released **v1.0.18** (writeback INSERT…SELECT fix + dynamic workflow-version resolution + bounded agent + approval-task fns) |
| Live Domo Workflow version | **v1.0.3** (deploy this; tiles/CE bound to pattern4ce v1.0.18). startRetentionWorkflow auto-starts the highest active version. |
| Databricks workspace | `https://dbc-0516e56c-ba3e.cloud.databricks.com` (CLI profile `pattern4`) |
| Catalog / schema | `databricks_raptor.pattern4_agent_automation` |
| SQL warehouse | `ea829ba58bcae093` |
| Genie space | `01f1642295b61d6b8849e106f52fc781` |
| ML model / endpoint | UC `pattern4_renewal_risk` **v6 (regressor)** → endpoint `pattern4-renewal-risk` (AI Gateway: usage + 120/min + inference table) |
| Live Domo Workflow | `Pattern 4 - Renewal Risk Retention` (`6cbd5ecb-1036-410a-b188-60a49820d264`, v1.0.0); approval queue `Renewal Risk Approvals`; assignee `cassidy.hilton@domo.com` |
| AI Gateway LLM endpoint | `pattern4-reasoning-gateway` (external-model over `databricks-claude-sonnet-4-5`; guardrails + usage + inference table); secret `{{secrets/pattern4/dbx_pat}}` |
| Databricks agent (MAS) | `Pattern 4 Retention Supervisor` (`mas-77bd204b-endpoint`, `agent/v1/responses`); tool = Pattern 4 Genie Space. Called by the Domo workflow AI agent tile via `pattern4ce.askRetentionAgent`. |
| Agent observability | Build page `…/ml/bricks/sa/build/77bd204b-…`; **activity log = MLflow traces** `…/ml/experiments/1772952801684800/traces` (auto-logged per run: reasoning + Genie tool calls). In-app "go to source" links live on the Agent Action Queue + Approvals tab. |
| Lakebase | project `cobra-v1`, tables `public.p4_scenario_runs`, `public.p4_prediction_feedback` |
| External lineage object | `domo_pattern4_revenue_command_center` (`ff15743d-…`) |
| GitHub | `https://github.com/cassidythilton/dbais-2026-revenue-command-center` |

---

## 3. Pre-demo checklist (do this ~15 min before)

1. **Publish the latest app** (presenter/owner action — agents build/validate `dist` only):
   from `pattern4-agent-portal/dist`, run `domo publish`.
2. **Re-instantiate the App Studio card** if Code Engine bindings changed (remove + re-add
   the pro-code app to view `1913185115`) so a fresh context picks up the current
   `packageMapping`. This clears any stale `listScenarios` / `runModelInference` 400s.
3. **Warm the model endpoint** (scale-to-zero cold start is ~20–30s): score once ahead of
   time so the live demo is fast:
   ```bash
   ~/bin/databricks serving-endpoints query pattern4-renewal-risk -p pattern4 \
     --json '{"dataframe_records":[{"segment":"Enterprise","region":"West","industry":"Manufacturing","annual_recurring_revenue":1330000,"cases_90d":41,"sla_breaches_90d":12,"negative_cases_90d":9,"avg_usage_score_90d":58,"usage_drop_days_90d":22,"days_to_renewal":47}]}'
   # expect a single smooth probability, e.g. {"predictions":[0.33]}
   ```
4. **Confirm Genie** answers in the published app (Genie Workspace → click a chip).
5. Open the app full-screen; persona = **Executive Sponsor**.

---

## 4. Talk track (≈6–8 min)

| # | Tab / action | Say this |
| --- | --- | --- |
| 1 | **Forecast Home** | "One governed cockpit. KPIs and this Actual-vs-Forecast hero are Databricks gold views, live-federated into Domo through Cloud Amplifier — no copies." Point at Revenue at Risk + the West hotspot bar. |
| 2 | **Insight Rail** → *Ask Genie why* | "The model flags the West dip is tied to incident INC-0001. Let's ask the lakehouse." |
| 3 | **Genie Workspace** | Click *Why did renewal risk increase for West enterprise accounts?* Open **Inspect** to show the governed API call + generated SQL. "Same Unity Catalog metrics, answered in natural language, on-behalf-of me." |
| 4 | **ML Predictions** | "Now score a specific account." Run prediction on the default West Enterprise account → ~33% churn (Medium). Show the **run log** (it's calling Databricks Model Serving via Code Engine), then open the **Inference Payload** panel → cURL / Python / SQL. "This is the exact governed request; data scientists can reproduce it. Token never touches the browser." Bump SLA breaches up and re-run to show it move. |
| 5 | **Forecast Home → Agent Action Queue** | "Genie explained, the model scored — now Domo acts." Click **Inspect agent ▸** on a row to watch the **Databricks Retention Supervisor** reason in-app (Genie-grounded recommendation), with one-click "go to source" links (agent, MLflow activity log, writeback table). Click **Approve & execute** → starts the live, governed **Domo Workflow** (run id captured), routes a human-approval task. Approve in the **Approvals** tab, then **Refresh status** → status writes back to `agent_action_writeback` and **Protected Revenue** ticks up. "Human-in-the-loop as a real workflow; every agent decision traced in MLflow; status auditable in the lakehouse." |
| 6 | **Lakebase Ops** | "Operational state — saved what-if scenarios and prediction feedback — lives in Lakebase Postgres next to the lakehouse, not in a spreadsheet." |
| 7 | **AI Readiness** | "Governance: Unity Catalog is the source of truth. We sync prepared column metadata into Domo AI Readiness — Domo never edits the source. Editing UC context is a separate, governed action (the Inspect drawer)." |
| 8 | **How It Works** | Land here to recap the agent-to-agent architecture, the user guide, and the component bill across Databricks / Interop / Domo. |

---

## 5. Reset procedure (between runs)

- **Agent actions / Protected Revenue:** the approve→execute bump is session-local — just
  **reload the app** to reset KPIs and the action queue to baseline.
- **ML form:** reload resets the form to the default West Enterprise account.
- **Lakebase scenarios:** if a presenter added/edited scenarios live and you want the
  canonical 4 scenarios / 6 feedback rows back, re-run `scripts/seed_pattern4_lakebase.py`.
- **AI Readiness:** Sync/Wipe write to Domo AI Readiness live; to reset to "nothing synced",
  use **Wipe all from Domo** per dataset.
- **Genie:** stateless per question; nothing to reset.

---

## 6. Known limitations & fallbacks

| Area | Limitation | Fallback |
| --- | --- | --- |
| External tab links (Databricks/Lakebase) | The App Studio iframe is sandboxed without `allow-popups`, and the Domo parent rejects external domains via `navigate`, so the app can't auto-open a new tab. | The app copies the URL to the clipboard and shows a toast; paste into a new tab. (Domo-internal links open normally.) |
| Model Serving cold start | Scale-to-zero adds ~20–30s on the first score. | Warm it in the pre-demo checklist; the run-log animation keeps the audience engaged. |
| Genie / Code Engine | Live answers require the published app context (not local preview). | Local preview shows representative sample answers; the published app answers live. |
| Domo AI Services registry | `/api/ml/v1/models` returned 404 this session. | Runtime inference uses **direct Databricks Model Serving** via Code Engine; AI Services is the governance/catalog layer. |
| Domo Workflow deploy | The workflow model `Pattern 4 - Renewal Risk Retention` (`6cbd5ecb-…`, v1.0.0) is authored + validated (0 errors) via REST, but the **Deploy** step is UI-only (the API lacks deploy/publish permission, like `domo publish`). Until deployed, `startRetentionWorkflow` returns "No trigger found" and the app falls back to the Code Engine writeback. | One-click: open the workflow in Domo → **Deploy** (registers the start trigger). `pattern4ce` **v1.0.14** (with `startRetentionWorkflow`/`getRetentionWorkflowResult`) is already released. |
| Agent Catalyst (live agent) | A live Agent Catalyst triage agent that *generates* the recommendation is deferred (Shape C). | The recommendation comes from `gold_agent_action_queue`; the governed action object is the live Domo Workflow. Optional: add an Agent Catalyst agent later. |
| Unity AI Gateway / OBO | **Live** on `pattern4-renewal-risk` (usage + rate limits + inference table) and `pattern4-reasoning-gateway` (guardrails + usage + audit). Per-user **OBO** is not wired — the embedded app carries a Domo identity, not a Databricks one. | Calls are governed/audited as a single service identity today; documented supported route = Databricks U2M OAuth / token federation (`pattern-4-ai-gateway-and-obo.md`). |

---

## 7. Validation checklist (engineering)

Run before publishing a new `dist`:

- `node --check pattern4-agent-portal/src/app.js` (and `dist/src/app.js`).
- `dist` mirrors `src` (`index.html`, `src/app.js`, `src/styles.css`).
- `manifest.json` and `dist/manifest.json` `packageMapping` aliases match (14 functions).
- Headless render each tab: `#forecast #ml #lakebase #readiness #genie #genieEmbed #guide`.
- Live endpoint smoke test returns a smooth probability (Section 3, step 3).
- No secrets staged (`databricks token`, `scripts/lakebase_pg_bundle.b64` stay gitignored).

---

## 8. Component inventory (one-liner per plane)

- **Databricks:** Unity Catalog gold views + metric definitions, Genie Space, MLflow model
  `pattern4_renewal_risk` v6 + Model Serving endpoint, Lakebase Postgres, external lineage.
- **Interop:** Cloud Amplifier (`Databricks Raptor AWS`) live federation, Code Engine
  `pattern4ce` (Genie / writeback / Lakebase / readiness / inference), shared identity, a
  single entitlement model (Domo PDP ↔ UC filters).
- **Domo:** the pro-code App Studio portal (Forecast, ML Predictions, Lakebase Ops, AI
  Readiness, Genie Workspace, How It Works), action queue + approval + writeback,
  AI Readiness control plane.
