---
shaping: true
---

# Pattern 4 Expansion — ML, Lakebase, Forecasting, and Genie UX (Shaping)

Working document for expanding the Pattern 4 Revenue Command Center beyond live Genie + action writeback into a fuller Databricks + Domo intelligence experience: ML predictions, Lakebase operational state, a redesigned forecast-first main page, and a more usable Genie workspace.

This document is the ground truth for the expansion requirements, shapes, fit checks, and implementation slices. Keep it synchronized with `pattern-4-agent-to-agent-automation-scope-build-plan.md` and `pattern-4-plan-data.js`.

---

## Frame

### Source (verbatim)

> Similar to the unity catalog addition to the roadmap, we also need to incorporate an ml model into the scope (e.g. https://dbc-0516e56c-ba3e.cloud.databricks.com/editor/notebooks/2555654965487094?o=8127410670216233). This should include a model built in databricks (on same or similar data as we already have) registered via mlflow (e.g. https://dbc-0516e56c-ba3e.cloud.databricks.com/ml/endpoints/CassidyLightGBM/overview?o=8127410670216233). Then, in Domo, we will pick that model up (integrate) via ai services layer (databricks ml connector/adapter--example: https://databricks-demo.domo.com/ai-services/models?model=c8cb6bd7-9ce2-4a47-8070-f6b309849e40). I also want to be able to run ad hoc inferences from the revenue command center app and i want to showcase predictions as a natural part of the analytics and insights in the app. We can use a code engine function for this piece (see relevant Domo and Databricks skills for all noted items above).
>
> Additionally, it's imperative that this app has a tie-in or integration to lake base in some way. See https://databricks-demo.domo.com/codeEngine/55a6749a-8eff-44d5-a388-99289395fcb6 and https://databricks-demo.domo.com/assetlibrary/f0530276-c614-461a-b05d-96d93f06a33e/overview for how to approach it. This should also be a key part of the existing app experience. See relevant Domo and Databricks skills for all noted items above.
>
> A critical callout: with the ml and lake base additions as well as the genie chat improvements it makes sense to rethink the general layout and design of the app. Perhaps subpages are now needed? As such, on the main page I'd like a primary time based view that is gorgeous and shows forecasting, comparisons, etc. See example here: /Users/cassidy.hilton/Cursor Projects/forecast line recharts. I also would like to refine the design of the databricks' genie modal. At current it's bunched up. It's almost impossible to see the activity in the current state of the modal (way too small). Also, in the expanded view it's very spread out. I want a tight view, perhaps similar to the default databricks genie view with generous left/right margins, chat modal at center, etc. Ours has to scroll vertically just to see the chat input at bottom (very poor design). Also make sure the seeded questions I our app are identical to the ones in databricks/genie. Finally, if at all possible, I'd like to render the same plots in our app that are rendered in genie (supportive of the question responses). Is this possible? See relevant Domo and Databricks skills for all noted items above.
>
> Use your shaping skill to carefully capture the requirements and tease apart the key parts of the solution(s) that I have specified here in order to elegantly add to the existing scope.

### Problem

The current app has proven live Genie Q&A and Code Engine routing, but it still reads primarily as a dashboard plus chat demo. The new requirements move it into a broader Databricks + Domo product story:

- Databricks should not only govern data and answer questions; it should also train/register/serve a predictive model.
- Domo should not only display data; it should consume the Databricks ML model through AI Services, call it ad hoc from the app, and present predictions as part of the main analytical experience.
- Lakebase must be visible as an operational/serving-layer integration, not a footnote.
- The UI needs to graduate from a dense card layout into a polished multi-page command center with a forecast-first home page and a better Genie experience.

### Outcome

A demo-ready Revenue Command Center where the opening page is a beautiful time-based forecast and comparison workspace, supported by:

- Databricks-trained and MLflow-registered model served through Databricks Model Serving.
- Domo AI Services Layer integration to the Databricks ML connector/adapter.
- App-level ad hoc inference through Code Engine.
- Lakebase-backed operational state or low-latency serving data.
- A centered, usable Genie workspace that shares seeded questions with the Databricks Genie Space and can render supportive plots from Genie results where feasible.

---

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| **R0** | Expand the Pattern 4 app into a unified predictive command center that combines governed analytics, ML predictions, Lakebase operational state, and Genie reasoning | Core goal |
| **R1** | **Databricks ML model lifecycle** | — |
| R1.1 | Build a classical ML model in Databricks on the existing or closely related revenue-risk/customer-health data | Must-have |
| R1.2 | Register the model in MLflow / Unity Catalog with input examples and a stable schema contract | Must-have |
| R1.3 | Serve the model through Databricks Model Serving, similar in role to `CassidyLightGBM` | Must-have |
| R1.4 | Preserve model lineage to the same governed data story used by the portal and Genie | Must-have |
| **R2** | **Domo AI Services / ML adapter integration** | — |
| R2.1 | Register/pick up the Databricks-served model in Domo AI Services Layer through the Databricks ML connector/adapter | Must-have |
| R2.2 | Expose model metadata/status in the app so users understand the model source and governance | Must-have |
| R2.3 | Keep inference credentials server-side; no Databricks tokens or AI Services secrets in browser code | Must-have |
| **R3** | **App-level inference experience** | — |
| R3.1 | Users can run ad hoc inference from the Revenue Command Center app | Must-have |
| R3.2 | Predictions appear as a natural part of analytics, not as a detached technical demo | Must-have |
| R3.3 | Prediction outputs include score, confidence/band, drivers or context, and action recommendation where available | Must-have |
| R3.4 | Code Engine can mediate inference calls and normalize responses for the app | Leaning yes |
| **R4** | **Lakebase integration** | — |
| R4.1 | The app has a visible, meaningful Lakebase tie-in | Must-have |
| R4.2 | Lakebase stores or serves operational state that complements the Delta/UC gold views, such as scenarios, overrides, what-if runs, prediction feedback, or action state | Must-have |
| R4.3 | Lakebase integration follows Databricks Lakebase guidance: project/branch/database/endpoint discovery, server-side connectivity, no destructive operations without approval | Must-have |
| R4.4 | Domo integrates with Lakebase through a Code Engine pattern informed by the existing Domo Lakebase examples | Must-have |
| **R5** | **Main app redesign** | — |
| R5.1 | The main page becomes a gorgeous time-based forecast/comparison view | Must-have |
| R5.2 | The design references `/Users/cassidy.hilton/Cursor Projects/forecast line recharts`: actual vs prediction lines, confidence band, period controls, compact legend, and polished tooltip behavior | Must-have |
| R5.3 | The app can use subpages/tabs for Forecast, Predictions/ML, Lakebase Operations, Genie, and How It Works if needed | Leaning yes |
| R5.4 | The app remains Domo-branded, Databricks-governed, dainty/polished, and publishable from `pattern4-agent-portal/dist` | Must-have |
| **R6** | **Genie UX refinement** | — |
| R6.1 | Compact embedded Genie panel must not be bunched up; users can see recent activity and input without awkward vertical scrolling | Must-have |
| R6.2 | Expanded Genie view should be centered and tight, similar to Databricks Genie: generous left/right margins, conversation centered, input visible, not spread edge-to-edge | Must-have |
| R6.3 | Seeded questions in the app match the Databricks Genie Space sample/seeded questions exactly | Must-have |
| R6.4 | The app should render supportive plots from Genie answers if the response contains enough structured result data; exact native Genie chart parity is subject to API metadata availability | Leaning yes |
| **R7** | **Governance, observability, and demo trust** | — |
| R7.1 | All new ML, Lakebase, Genie, and Code Engine flows preserve governance story: UC lineage, Domo delivery, server-side secrets, and clear audit/logging | Must-have |
| R7.2 | Code Engine functions log enough runtime detail to diagnose app-level calls | Must-have |
| R7.3 | The roadmap and project manager stay synchronized as scope expands | Must-have |

---

## CURRENT: Live Genie + action portal

| Part | Mechanism | Flag |
|------|-----------|:----:|
| CUR1 | Pro-code Domo app in `pattern4-agent-portal`, published from `dist` with `ryuu.js` loaded | |
| CUR2 | Live Genie Q&A through `pattern4ce.askGenie` and Databricks Genie Space `01f1642295b61d6b8849e106f52fc781` | |
| CUR3 | Action writeback through `pattern4ce.writeActionStatus` into `databricks_raptor.pattern4_agent_automation.agent_action_writeback` | |
| CUR4 | Five Domo dataset aliases backed by Databricks Cloud Amplifier gold views | |
| CUR5 | Current UI is a dense dashboard/chat layout with limited forecasting emphasis and an imperfect Genie panel | |
| CUR6 | No ML model, Domo AI Services model integration, Lakebase tie-in, or ad hoc inference UI exists yet | |

---

## Shape options

### A: Add-on tabs around the current dashboard

Keep the existing Command Center mostly intact and add ML, Lakebase, and forecasting as additional panels/tabs.

| Part | Mechanism | Flag |
|------|-----------|:----:|
| A1 | Add ML card: model score, "Run inference" form, latest predictions | |
| A2 | Add Lakebase card: scenario/action state and recent operational events | ⚠️ |
| A3 | Add forecast chart above or beside current KPIs, borrowing the `forecast line recharts` style | |
| A4 | Keep Genie panel mostly as-is with small size/layout fixes | |
| A5 | Extend `pattern4ce` with `runModelInference` and `lakebaseQuery` functions | ⚠️ |

Tradeoff: fastest path, but risks feeling like a collection of widgets rather than a redesigned flagship experience.

### B: Forecast-first predictive command center

Reframe the app around a forecast-first main page. ML, Lakebase, and Genie become connected sub-experiences supporting the same revenue forecast narrative.

| Part | Mechanism | Flag |
|------|-----------|:----:|
| B1 | New app information architecture: Forecast Home, ML Predictions, Lakebase Ops, Genie Workspace, How It Works | |
| B2 | Forecast Home: time-based actual vs forecast vs prediction line chart with confidence band, period controls, KPI comparisons, and narrative insight rail | |
| B3 | Databricks ML pipeline: train LightGBM/sklearn model from revenue-risk/customer-health gold views, register in UC/MLflow, deploy to Model Serving | ⚠️ |
| B4 | Domo AI Services Layer: register/pick up the Databricks model through the ML connector/adapter; expose model identity/status in app | ⚠️ |
| B5 | App inference: `pattern4ce.runModelInference` calls AI Services or Databricks endpoint server-side; app renders predictions in Forecast Home and ML page | ⚠️ |
| B6 | Lakebase Ops: Lakebase stores scenario runs, user overrides, prediction feedback, or action state; Domo app reads/writes through Code Engine | ⚠️ |
| B7 | Genie Workspace: centered, tight full-height view; seeded questions synced from Databricks Genie; results can render Domo-side charts when tabular data is available | ⚠️ |
| B8 | How It Works updated to show UC -> MLflow/Model Serving -> Domo AI Services -> Code Engine -> Lakebase -> Domo UX | |

Tradeoff: more build work, but it directly satisfies the narrative and creates a coherent executive demo.

### C: Platform showcase with separate product lanes

Split the app into standalone product showcases: Forecasting, Genie, ML Services, Lakebase, and Architecture. Each lane proves one capability with less integration between them.

| Part | Mechanism | Flag |
|------|-----------|:----:|
| C1 | Forecast page using `forecast line recharts` style | |
| C2 | Genie page modeled after Databricks Genie | |
| C3 | ML page for endpoint/model scoring demo | ⚠️ |
| C4 | Lakebase page for operational data demo | ⚠️ |
| C5 | Cross-page navigation and shared persona/context | |

Tradeoff: clear for enablement, but weaker as a single "Revenue Command Center" product story.

---

## Fit Check

| Req | Requirement | Status | A | B | C |
|-----|-------------|--------|---|---|---|
| R0 | Expand the Pattern 4 app into a unified predictive command center that combines governed analytics, ML predictions, Lakebase operational state, and Genie reasoning | Core goal | ❌ | ✅ | ❌ |
| R1.1 | Build a classical ML model in Databricks on the existing or closely related revenue-risk/customer-health data | Must-have | ✅ | ✅ | ✅ |
| R1.2 | Register the model in MLflow / Unity Catalog with input examples and a stable schema contract | Must-have | ✅ | ✅ | ✅ |
| R1.3 | Serve the model through Databricks Model Serving, similar in role to `CassidyLightGBM` | Must-have | ✅ | ✅ | ✅ |
| R1.4 | Preserve model lineage to the same governed data story used by the portal and Genie | Must-have | ✅ | ✅ | ✅ |
| R2.1 | Register/pick up the Databricks-served model in Domo AI Services Layer through the Databricks ML connector/adapter | Must-have | ✅ | ✅ | ✅ |
| R2.2 | Expose model metadata/status in the app so users understand the model source and governance | Must-have | ❌ | ✅ | ✅ |
| R2.3 | Keep inference credentials server-side; no Databricks tokens or AI Services secrets in browser code | Must-have | ✅ | ✅ | ✅ |
| R3.1 | Users can run ad hoc inference from the Revenue Command Center app | Must-have | ✅ | ✅ | ✅ |
| R3.2 | Predictions appear as a natural part of analytics, not as a detached technical demo | Must-have | ❌ | ✅ | ❌ |
| R3.3 | Prediction outputs include score, confidence/band, drivers or context, and action recommendation where available | Must-have | ✅ | ✅ | ✅ |
| R3.4 | Code Engine can mediate inference calls and normalize responses for the app | Leaning yes | ✅ | ✅ | ✅ |
| R4.1 | The app has a visible, meaningful Lakebase tie-in | Must-have | ✅ | ✅ | ✅ |
| R4.2 | Lakebase stores or serves operational state that complements the Delta/UC gold views, such as scenarios, overrides, what-if runs, prediction feedback, or action state | Must-have | ❌ | ✅ | ✅ |
| R4.3 | Lakebase integration follows Databricks Lakebase guidance: project/branch/database/endpoint discovery, server-side connectivity, no destructive operations without approval | Must-have | ✅ | ✅ | ✅ |
| R4.4 | Domo integrates with Lakebase through a Code Engine pattern informed by the existing Domo Lakebase examples | Must-have | ✅ | ✅ | ✅ |
| R5.1 | The main page becomes a gorgeous time-based forecast/comparison view | Must-have | ❌ | ✅ | ✅ |
| R5.2 | The design references `/Users/cassidy.hilton/Cursor Projects/forecast line recharts`: actual vs prediction lines, confidence band, period controls, compact legend, and polished tooltip behavior | Must-have | ✅ | ✅ | ✅ |
| R5.3 | The app can use subpages/tabs for Forecast, Predictions/ML, Lakebase Operations, Genie, and How It Works if needed | Leaning yes | ✅ | ✅ | ✅ |
| R5.4 | The app remains Domo-branded, Databricks-governed, dainty/polished, and publishable from `pattern4-agent-portal/dist` | Must-have | ✅ | ✅ | ✅ |
| R6.1 | Compact embedded Genie panel must not be bunched up; users can see recent activity and input without awkward vertical scrolling | Must-have | ❌ | ✅ | ✅ |
| R6.2 | Expanded Genie view should be centered and tight, similar to Databricks Genie: generous left/right margins, conversation centered, input visible, not spread edge-to-edge | Must-have | ❌ | ✅ | ✅ |
| R6.3 | Seeded questions in the app match the Databricks Genie Space sample/seeded questions exactly | Must-have | ✅ | ✅ | ✅ |
| R6.4 | The app should render supportive plots from Genie answers if the response contains enough structured result data; exact native Genie chart parity is subject to API metadata availability | Leaning yes | ❌ | ✅ | ✅ |
| R7.1 | All new ML, Lakebase, Genie, and Code Engine flows preserve governance story: UC lineage, Domo delivery, server-side secrets, and clear audit/logging | Must-have | ✅ | ✅ | ✅ |
| R7.2 | Code Engine functions log enough runtime detail to diagnose app-level calls | Must-have | ✅ | ✅ | ✅ |
| R7.3 | The roadmap and project manager stay synchronized as scope expands | Must-have | ✅ | ✅ | ✅ |

**Notes:**

- A fails the core product requirement because it appends capabilities without making predictions and operations feel like one command center.
- C fails the core product requirement because it is a platform tour, not a unified executive workflow.
- B is the recommended shape because it creates a coherent predictive command center with ML, Lakebase, and Genie as connected parts of the same revenue story.

---

## Selected shape: B — Forecast-first predictive command center

Shape B is selected for planning. It best satisfies the user's ask to rethink layout/design around ML, Lakebase, and Genie rather than bolting them onto the current card layout.

### B parts

| Part | Mechanism | Flag |
|------|-----------|:----:|
| **B1** | **Information architecture**: replace the current two-tab command/guide structure with a multi-page or multi-view app: Forecast Home, ML Predictions, Lakebase Ops, Genie Workspace, How It Works | |
| **B2** | **Forecast Home**: build a time-series hero view inspired by `forecast line recharts`: actual revenue, forecast, model prediction, confidence band, period/range controls, compact legend, comparison chips, and insight rail | |
| **B3** | **Databricks ML pipeline**: train a LightGBM/sklearn-style model on existing gold views, register via MLflow/UC, deploy to Databricks Model Serving; target prediction: renewal risk / revenue at risk / protected revenue uplift | ⚠️ |
| **B4** | **Domo AI Services model integration**: pick up the served Databricks model in Domo AI Services Layer through the Databricks ML connector/adapter; expose model id/status/last scoring time in the app | ⚠️ |
| **B5** | **Ad hoc inference**: extend `pattern4ce` with `runModelInference` that accepts account/scenario inputs, calls the Domo AI Services adapter or Databricks endpoint server-side, and returns normalized prediction output | ⚠️ |
| **B6** | **Lakebase Ops**: create/use Lakebase to store low-latency operational state: scenario runs, forecast overrides, prediction feedback, "what changed" notes, or action state; Domo app reads/writes via Code Engine | ⚠️ |
| **B7** | **Genie Workspace redesign**: compact embedded Genie card for quick Q&A and a centered full-height Genie workspace with margins, visible input, synced seeded questions, and chart rendering from returned SQL result data where available | ⚠️ |
| **B8** | **Plot rendering from Genie**: if Genie returns tabular data and generated SQL, render Domo-side charts using the same result set; exact native Genie plot parity requires a spike to determine whether chart metadata is exposed by the Conversation API | ⚠️ |
| **B9** | **Architecture page update**: revise How It Works to include MLflow/Model Serving, Domo AI Services, Code Engine inference, Lakebase operational store, Genie, UC, and Domo Cloud Amplifier | |

---

## Breadboard: UI affordances

| Place | Affordance | Wires In | Wires Out |
|-------|------------|----------|-----------|
| Global shell | Subpage navigation: Forecast, ML Predictions, Lakebase Ops, Genie, How It Works | Current custom tab system | Routes/view state for all pages |
| Forecast Home | Forecast hero chart with actual, forecast, prediction, confidence band | Domo dataset aliases + ML prediction output | Tooltip, selected period, insight rail |
| Forecast Home | Period/range controls (day/week/month, trailing window, forecast horizon) | User input | Chart transform + inference defaults |
| Forecast Home | Insight rail with forecast delta, risk drivers, recommended next action | Gold views + ML output + Genie summaries | Deep links to ML page and Genie question |
| ML Predictions | Model status card | Domo AI Services metadata / Databricks serving status | Trust metadata: model name, endpoint, version, last updated |
| ML Predictions | Ad hoc inference form | User-selected account/scenario fields | `pattern4ce.runModelInference` |
| ML Predictions | Prediction result panel | Code Engine response | Score, confidence, drivers, recommended action, save scenario |
| Lakebase Ops | Scenario run table | Lakebase query via Code Engine | Select scenario, compare to forecast, audit trail |
| Lakebase Ops | Scenario create/update controls | User what-if inputs | Lakebase insert/update via Code Engine |
| Genie Workspace | Centered conversation column | Genie response stream/history | `pattern4ce.askGenie`, chart renderer |
| Genie Workspace | Seeded question chips | Exported/queried Genie sample questions | Exact app chips matching Databricks Genie |
| Genie Workspace | Result chart panel | Genie result rows/columns or SQL-result data | Domo-side plot rendering |
| How It Works | Updated architecture flow | Build metadata + static explanatory content | Demo explanation of ML + Lakebase + Genie |

---

## Breadboard: non-UI affordances

| Place | Affordance | Wires In | Wires Out |
|-------|------------|----------|-----------|
| Databricks UC | ML feature training view/table | Existing gold views | Model training notebook/job |
| Databricks MLflow | Registered model | Training run, signature, input examples | Databricks Model Serving endpoint |
| Databricks Model Serving | Served model endpoint | Registered UC model version | Domo AI Services adapter and/or Code Engine |
| Domo AI Services Layer | Databricks ML model adapter | Serving endpoint config | App-visible model id/status and inference path |
| Domo Code Engine `pattern4ce` | `runModelInference` | App payload | Normalized prediction object |
| Databricks Lakebase | Scenario/feedback/action-state tables | Code Engine writes | Code Engine reads and app pages |
| Domo Code Engine `pattern4ce` | Lakebase functions: `createScenario`, `listScenarios`, `getScenario`, `savePredictionFeedback` | App payloads | Lakebase Data API/Postgres responses |
| Genie Space | Seeded/sample question export | Databricks Genie config/API | App chip list |
| Genie result parser | Result rows/columns from Conversation API or query-result endpoint | `askGenie` response | Chart-ready series |
| Dist build | Clean publish artifact | Source app files | Domo `domo publish` |

---

## Slices

| Slice | Demo-able outcome | Includes |
|-------|-------------------|----------|
| **S1: Shape + roadmap commit** | Project docs clearly show ML/Lakebase/Genie redesign scope and build order | This shaping doc, main build plan updates, project manager data sync |
| **S2: Forecast Home redesign shell** | Main page opens to a polished time-based forecast/comparison view using existing data/mock predictions | IA/navigation, forecast hero chart, period controls, insight rail, responsive layout |
| **S3: Databricks ML model foundation** | A model is trained/registered/servable in Databricks and documented in the roadmap | Feature view/table, notebook/job, MLflow registration, endpoint plan/status |
| **S4: Domo AI Services + inference bridge** | App can run an ad hoc inference and render a prediction panel | Domo AI Services model registration, `pattern4ce.runModelInference`, UI form/result |
| **S5: Lakebase operational tie-in** | App shows saved scenarios/prediction feedback/action state backed by Lakebase | Lakebase project discovery/create, schema, Code Engine Lakebase functions, Ops page |
| **S6: Genie workspace redesign** | Genie view is centered/tight, input visible, questions match Databricks Genie, and chart rendering works for tabular results | UX refactor, sample question sync, result chart renderer |
| **S7: How It Works and demo polish** | Presenter can explain UC + MLflow + Model Serving + Domo AI Services + Lakebase + Genie in one flow | Architecture page, demo script, QA |

---

## Spikes

> **STATUS: All three spikes resolved 2026-06-09.** Full findings in
> `pattern-4-expansion-spike-findings.md`. Summary below per spike.

### X1: Domo AI Services Databricks ML adapter mechanics — RESOLVED

- **Runtime path:** `pattern4ce.runModelInference` calls **Databricks Model Serving directly**
  (`POST /serving-endpoints/<name>/invocations`, Bearer PAT, body `{"dataframe_records":[{...}]}`,
  response `{"predictions":[...]}`); Domo AI Services is the **governance/catalog** layer
  (`/api/ml/v1/models`). Mirrors the proven deal-inspect "CE → compute REST" pattern.
- **ML target:** binary renewal-risk/churn classifier on `gold_customer_renewal_risk` →
  `predicted_churn_probability` + derived `revenue_at_risk`; train with a named-column MLflow signature.
- **Open item:** exact Domo AI Services stored-metadata JSON / runtime invoke contract unconfirmed
  (registry list is POST-gated); capture from the browser network tab on the model URL if needed.



| # | Question |
|---|----------|
| X1-Q1 | What API/UI steps register a Databricks Model Serving endpoint in Domo AI Services Layer? |
| X1-Q2 | Can Code Engine call the Domo AI Services model directly, or should Code Engine call Databricks Model Serving and Domo AI Services be shown as governance/catalog integration? |
| X1-Q3 | What response shape does the Domo AI Services model invocation return for tabular model predictions? |

Acceptance: MET — concrete serving contract + recommended CE runtime path documented.

### X2: Lakebase existing-example mechanics — RESOLVED

- **Package `55a6749a` = `LakebaseQuery`:** generic `lakebaseQuery(sql, params)` → `{rows,rowCount,fields}`,
  via node-postgres + SP M2M token exchange (`oidc/v1/token` → `postgres/credentials`) into `cobra-v1`.
- **App `f0530276` = "Lakebase Explorer":** plural `packagesMapping` (alias `lakebaseQuery`, packageId pinned
  v1.0.3); calls `domo.post('/domo/codeengine/v2/packages/lakebaseQuery', {sql, params: JSON.stringify(...)})`.
- **Reuse `projects/cobra-v1`** (user-owned, always-warm, already wired). Do not create a new project.
- **First objects:** `public.p4_scenario_runs` + `public.p4_prediction_feedback` (DDL in findings doc).
- **CE wiring:** lean to **folding Lakebase into `pattern4ce`** (port SP-token→`pg` block; typed functions
  `listScenarios/createScenario/getScenario/savePredictionFeedback`) to keep one manifest pattern.



| # | Question |
|---|----------|
| X2-Q1 | What functions and manifest/runtime pattern are used by Domo Code Engine package `55a6749a-8eff-44d5-a388-99289395fcb6`? |
| X2-Q2 | What app affordances are in asset `f0530276-c614-461a-b05d-96d93f06a33e`, and which should be reused for Pattern 4? |
| X2-Q3 | Should Pattern 4 create a new Lakebase project or reuse an existing one for demo reliability? |
| X2-Q4 | Which Lakebase object is the best fit: scenarios, overrides, prediction feedback, or action operational state? |

Acceptance: MET — safe reuse path, table schemas, and CE function list documented.

### X3: Genie sample questions and chart metadata — RESOLVED

- **Seeded questions exported** (5 verbatim, from `GET /api/2.0/data-rooms/{space}/curated-questions`) — see findings doc.
- **Chart metadata: definitive NO.** Genie returns only SQL + result rows/columns + text. Charts must be
  reconstructed Domo-side from `statement_response.manifest.schema.columns` + `result.data_array`.
- **`askGenie` must be extended** to surface columns+types+rows (currently discarded) so the app can render plots.
- **Chart mapping rules** (temporal+numeric→line, categorical+numeric→bar, etc.) documented in findings doc.



| # | Question |
|---|----------|
| X3-Q1 | How do we export the exact sample/seeded questions from Genie Space `01f1642295b61d6b8849e106f52fc781`? |
| X3-Q2 | Does the Genie Conversation API expose chart/visualization metadata, or only SQL/result data? |
| X3-Q3 | If only SQL/result data is available, what Domo-side chart mapping rules should recreate useful plots? |

Acceptance: app can match Genie seeded questions exactly and we know whether "same plots" means native parity or Domo-side reconstruction.

---

## Recommendation

Proceed with **Shape B: Forecast-first predictive command center**.

This shape turns the new requirements into a single executive story:

1. Forecast Home shows the time-based revenue/risk trajectory.
2. Databricks ML explains what is likely to happen next.
3. Domo AI Services makes the model available to the business app layer.
4. Code Engine enables ad hoc inference and server-side normalization.
5. Lakebase stores scenario/feedback/operational state.
6. Genie explains why and supports drill-in, with plots where result data allows.

---

## Open decisions

| Decision | Options | RESOLVED (2026-06-09 post-spike) |
|----------|---------|---------|
| ML target | Renewal risk score, revenue at risk, protected revenue uplift, churn probability | **Renewal-risk/churn classifier on `gold_customer_renewal_risk`** → `predicted_churn_probability` + derived `revenue_at_risk` |
| ML runtime path | Domo AI Services only, Databricks endpoint only, hybrid | **Hybrid:** Code Engine calls Databricks Model Serving directly; Domo AI Services = governance/catalog layer |
| Lakebase object | Scenario runs, prediction feedback, action state, all three | **Scenario runs + prediction feedback first** (`p4_scenario_runs`, `p4_prediction_feedback`); reuse `cobra-v1` |
| Genie plots | Native Genie chart parity, Domo-side reconstruction, no plots | **Domo-side reconstruction** (no native chart metadata exists); extend `askGenie` to return columns+rows |
| App IA | Tabs inside one pro-code app, App Studio subpages, separate custom apps | **Tabs/views inside the pro-code app** (Forecast Home / ML Predictions / Lakebase Ops / Genie Workspace / How It Works), App Studio-compatible |

