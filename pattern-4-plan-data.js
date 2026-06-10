window.PATTERN_4_PLAN_MODEL = {
  sprints: [
    {
      done: true,
      key: "Sprint 0",
      title: "Project Framing and Environment Readiness",
      goals: [
        "Confirm demo story, personas, target Domo instance, Databricks workspace, Unity Catalog catalog/schema, and whether Genie embed or Conversation API will be used.",
        "Confirm that the `Databricks Raptor AWS` Domo integration is available and can query the intended Databricks workspace.",
        "Confirm authentication paths for Domo APIs, Databricks CLI/API, Genie, and any MCP/gateway components."
      ],
      deliverables: [
        "Final project requirements document.",
        "Confirmed catalog/schema and Domo integration.",
        "Environment checklist with credentials, profiles, and API access owners.",
        "Initial implementation backlog."
      ],
      acceptance: [
        "No data generation starts until catalog/schema is confirmed.",
        "Integration ID is validated in Domo.",
        "Demo personas and entitlement model are approved."
      ]
    },
    {
      done: true,
      key: "Sprint 1",
      title: "Synthetic Data and Databricks Semantic Layer",
      goals: [
        "Generate story-driven synthetic data.",
        "Land data in Databricks with clear parent-child relationships.",
        "Build gold views and metric views.",
        "Create UC row-filter strategy."
      ],
      deliverables: [
        "Data generation script or Domo generator catalog extensions.",
        "Generated tables in the confirmed UC schema.",
        "Gold views for Domo and Genie consumption.",
        "Data dictionary with metric definitions and entity relationships.",
        "Validation queries for row counts, anomalies, skew, and incident story."
      ],
      acceptance: [
        "Incident story is visible in the data.",
        "At least two personas return different scoped results.",
        "Domo-ready shared dimensions exist across all dashboard datasets.",
        "Main fact tables are large enough for credible aggregation."
      ]
    },
    {
      done: true,
      key: "Sprint 2",
      title: "Domo Cloud Integration and Dashboard Assets",
      goals: [
        "Connect Domo to Databricks through `Databricks Raptor AWS`.",
        "Create live datasets or DataSet Views over gold Databricks objects.",
        "Build first-pass cards and dashboard content."
      ],
      deliverables: [
        "Domo datasets mapped to Databricks gold views.",
        "KPI cards for revenue, renewal risk, incident impact, support pressure, and protected revenue.",
        "Trend and detail cards for regional drilldown and account-level triage.",
        "PDP design or implemented PDP rules aligned to UC scope."
      ],
      acceptance: [
        "Domo cards query the Databricks-backed sources successfully.",
        "Genie and Domo show matching KPI values for the same scope.",
        "Dashboard filters work across datasets using consistent column names."
      ]
    },
    {
      done: true,
      key: "Sprint 3",
      title: "Portal Experience",
      goals: [
        "Assemble the unified Pattern 4 experience.",
        "Put Domo dashboard content and Genie access into one governed user journey."
      ],
      deliverables: [
        "Pro-code portal shell.",
        "Embedded Domo dashboards/cards.",
        "Genie pane, launch link, or Conversation API-backed chat module.",
        "Persona switcher or demo login pattern.",
        "User journey script for executive, regional manager, and operations owner."
      ],
      acceptance: [
        "User can navigate from KPI to customer detail to Genie explanation.",
        "Data scope is consistent between Domo and Genie for the same persona.",
        "Portal feels like one business experience rather than two disconnected embeds."
      ]
    },
    {
      done: false,
      key: "Sprint 4",
      title: "Agent Catalyst and Workflow Automation",
      goals: [
        "Build the Domo-side action runtime.",
        "Convert insight into approved business action."
      ],
      deliverables: [
        "Agent Catalyst agent definition for renewal-risk triage.",
        "Workflow for account owner notification, approval, and action execution.",
        "Action status dataset/table.",
        "Domo cards showing pending, approved, executed, and failed actions.",
        "Optional Code Engine package for custom action payload shaping."
      ],
      acceptance: [
        "Agent can create an action recommendation from a risk condition.",
        "Workflow requires approval for material actions.",
        "Action status appears back in the portal.",
        "Failed or rejected actions are visible and auditable."
      ]
    },
    {
      done: false,
      key: "Sprint 5",
      title: "Agent-to-Agent Mesh",
      goals: [
        "Connect Domo agent reasoning to Genie/Databricks.",
        "Define the Databricks-to-Domo action path."
      ],
      deliverables: [
        "Genie Conversation API wrapper or tool contract.",
        "Domo workflow trigger contract exposed as a tool/action endpoint.",
        "Unity AI Gateway registration plan or implemented gateway configuration, depending on access.",
        "Agent trace schema capturing question, context, answer, action, approval, and result.",
        "End-to-end demo: Domo agent asks Genie for root cause, then starts workflow."
      ],
      acceptance: [
        "Domo agent can call Genie for live reasoning or use a documented mocked path if gateway access is not available.",
        "Genie or Databricks-side action can trigger a Domo workflow through a governed endpoint or documented stub.",
        "Trace records connect the source question to the final action."
      ]
    },
    {
      done: false,
      key: "Sprint 6",
      title: "Hardening, Demo Packaging, and Executive Polish",
      goals: [
        "Make the demo reliable, repeatable, and presentation-ready.",
        "Package the project so future agents can rebuild or extend it."
      ],
      deliverables: [
        "Final demo script.",
        "Architecture diagram and component inventory.",
        "Runbook for data refresh, dashboard validation, and agent demo reset.",
        "Known limitations and fallback paths.",
        "Optional short capture plan for a walkthrough video."
      ],
      acceptance: [
        "Demo can be reset and run end-to-end.",
        "All critical claims have a visible proof point.",
        "Fallback path exists for Genie embed/API, Unity AI Gateway, and Domo workflow triggers."
      ]
    },
    {
      done: false,
      key: "Sprint 7",
      title: "ML Model, Domo AI Services, and Ad Hoc Inference",
      goals: [
        "Build a Databricks ML model on the existing revenue-risk/customer-health data.",
        "Register the model through MLflow / Unity Catalog and serve it through Databricks Model Serving.",
        "Integrate the model into Domo through AI Services Layer / Databricks ML adapter.",
        "Expose ad hoc inference inside the Revenue Command Center through Code Engine."
      ],
      deliverables: [
        "Databricks model training asset or notebook/job.",
        "MLflow registered model and Model Serving endpoint plan/status.",
        "Domo AI Services model integration proof point.",
        "`pattern4ce.runModelInference` contract and app UI for scoring.",
        "Prediction output cards/insights integrated into the main analytics flow."
      ],
      acceptance: [
        "A presenter can explain model lineage from UC data to MLflow to serving.",
        "The app can request a prediction without exposing credentials in the browser.",
        "Prediction output appears in context with forecast/risk analytics."
      ]
    },
    {
      done: false,
      key: "Sprint 8",
      title: "Lakebase Operations and Predictive UX Redesign",
      goals: [
        "Add a meaningful Lakebase-backed operational state layer.",
        "Redesign the app into a forecast-first predictive command center.",
        "Refine Genie into a centered, usable workspace with synced seeded questions and chart support."
      ],
      deliverables: [
        "Lakebase scenario/prediction-feedback/action-state design and Code Engine functions.",
        "Forecast Home page inspired by the forecast line Recharts reference.",
        "Subpage/navigation model for Forecast, ML Predictions, Lakebase Ops, Genie, and How It Works.",
        "Genie Workspace redesign with centered chat, visible input, exact seeded questions, and Domo-side result charts where feasible.",
        "Updated How It Works architecture including MLflow, Model Serving, Domo AI Services, Lakebase, Genie, UC, and Code Engine."
      ],
      acceptance: [
        "Lakebase is visible as a key part of the app experience, not only a backend footnote.",
        "The main page is a polished time-based forecast/comparison experience.",
        "Genie is usable without cramped layout or awkward vertical scrolling.",
        "The app can render useful plots from Genie result data when returned by the Conversation API."
      ]
    }
  ],
  notes: [
    "2026-06-09: Initial scope and sprint build plan created.",
    "2026-06-09: Project-level Cursor rule requested to keep this plan updated during the build.",
    "2026-06-09: Basic HTML project manager UI requested to read this Markdown file as its source of truth.",
    "2026-06-09: Added file-protocol fallback data for the HTML project manager because browsers block local Markdown fetches.",
    "2026-06-09: User provided answers to open decisions; plan updated with resolved decisions and remaining questions.",
    "2026-06-09: Added a Gantt-style project timeline to the HTML project manager for one-view sprint status.",
    "2026-06-09: Sprint 0 started. Verified `community-domo-cli`, `domo`, Python, and Node are available.",
    "2026-06-09: Domo API access confirmed for `databricks-demo` using `DOMO_INSTANCE=databricks-demo` and `DOMO_AUTH_MODE=ryuu-session`.",
    "2026-06-09: Installed Databricks CLI v1.2.1 at `~/bin/databricks`; no Databricks profile/config is present yet.",
    "2026-06-09: Found `Databricks Raptor AWS` (`a83b5bbc-fc3f-43c0-8ea5-f15117de997d`) in Domo dataset metadata, but visible datasets on that cloud ID are currently AWS EC2 Monitoring/API datasets in `ERROR` state, so live Databricks query readiness still needs validation.",
    "2026-06-09: Configured Databricks CLI profile `pattern4` from the provided token and validated workspace access as `cassidy.hilton@domo.com`.",
    "2026-06-09: Validated `databricks_raptor` catalog access and listed available schemas; `pattern4_agent_automation` does not exist yet.",
    "2026-06-09: Identified `Main SQL Warehouse` (`ea829ba58bcae093`) as a running candidate warehouse for SQL validation and live query work.",
    "2026-06-09: Added `databricks token` to `.gitignore` so the local token file is not committed.",
    "2026-06-09: Confirmed Databricks CLI exposes Genie commands (`list-spaces`, `start-conversation`, `create-message`) and existing Genie Spaces on `Main SQL Warehouse`.",
    "2026-06-09: Confirmed Databricks CLI exposes Beta `supervisor-agents` and `knowledge-assistants` surfaces; no explicit Unity AI Gateway command group was visible in CLI help.",
    "2026-06-09: Created `databricks_raptor.pattern4_agent_automation` and verified it through `Main SQL Warehouse` with a SQL statement smoke test.",
    "2026-06-09: Drafted Sprint 1 synthetic data generation spec in `pattern-4-synthetic-data-generation-spec.md`; awaiting approval before writing tables.",
    "2026-06-09: User approved Sprint 1 data generation by saying \"proceed\"; generated 10 Delta tables/fact tables and 5 gold views in `databricks_raptor.pattern4_agent_automation`.",
    "2026-06-09: Wrote generation assets: `scripts/run_databricks_sql.py`, `sql/pattern4_generate_synthetic_data.sql`, and `sql/pattern4_fix_incident_view.sql`.",
    "2026-06-09: Validation report created at `pattern-4-synthetic-data-validation-report.md`; row counts and story checks passed after correcting incident revenue-at-risk aggregation.",
    "2026-06-09: Sprint 2 discovery confirmed Domo can query existing Databricks-backed datasets and that `Databricks Raptor AWS` is a DATABRICKS Cloud Amplifier integration.",
    "2026-06-09: Public/API surfaces did not expose supported creation of new Databricks Cloud Amplifier datasets; created `pattern-4-domo-cloud-integration-report.md` with manual registration steps for the five gold views.",
    "2026-06-09: Created pro-code portal scaffold in `pattern4-agent-portal/` with mock-mode UI, fixed dataset aliases, and Domo alias fetch logic.",
    "2026-06-09: Added `scripts/discover_pattern4_domo_datasets.py`; current discovery found 0/5 Pattern 4 Domo datasets registered.",
    "2026-06-09: User registered all Pattern 4 Databricks tables/views in Domo. Discovery found all 5 required gold-view datasets on `Databricks Raptor AWS`.",
    "2026-06-09: Updated `pattern4-agent-portal/manifest.json` with real Domo dataset IDs and validated all 5 as `direct_federated` with successful sample queries.",
    "2026-06-09: Published `pattern4-agent-portal/` as Domo design `e8a0b5da-d20b-450d-8790-de7ef1634ea7` and added a 300x300 thumbnail.",
    "2026-06-09: Created Domo page `1097826706` and placed pro-code card `1022760405` titled `Pattern 4 Agent Portal`.",
    "2026-06-09: Redesigned the portal from the ground up on the Domo styleguide (Domo Blue, orange, neutrals, Open Sans) with elegant, sparing Databricks branding; added sparkline, persona scoping, interactive Genie panel, and governed-lineage grid; republished design `e8a0b5da-d20b-450d-8790-de7ef1634ea7`.",
    "2026-06-09: Design revision per feedback: swapped in the real Domo + Databricks logos, tightened to a daintier scale (smaller type/objects/spacing), and replaced the native macOS dropdown with a fully custom-styled one (branded panel, sublabels, selected check). Republished.",
    "2026-06-09: Added a second in-app page, 'How It Works' (tabbed): clickable agent-to-agent architecture flow, a 7-step user guide, and a component bill-of-requirements (Databricks / Interop / Domo). Added to Sprint 3 deliverables. Republished.",
    "2026-06-09: Placed in App Studio app 105910661 (view 1913185115); added a co-branded app icon (dataFileId 140) and app description via the app-studio skill (scripts/setup_appstudio_icon.py).",
    "2026-06-09: Shaping doc created for innovative Genie chat capabilities (pop-out, resize, theme, model, API inspector, open-in-Databricks deep link, branding): pattern-4-genie-chat-shaping.md. Awaiting decisions (Q1-Q6) before build.",
    "2026-06-09: Reconciled tracker — Sprints 0-3 complete. Built the enhanced Genie chat (Shape C + staged K-A): amplified branding, model selector, accent themes, API call inspector (preview), pop-out + resize, and an Open-in-Databricks deep link. Republished. Live Conversation API + a dedicated Genie Space are the next live-wiring step.",
    "2026-06-09: Created and tested dedicated Pattern 4 Genie Space `01f1642295b61d6b8849e106f52fc781` over the five gold views. Test question returned the expected West renewal-risk answer, generated SQL, row count, and suggested follow-ups. Wired `GENIE_SPACE_ID` in `pattern4-agent-portal/src/app.js`; the Open-in-Databricks link now targets the actual space and the inspector references the real space id. Republished.",
    "2026-06-09: Added governance/readiness slice. Applied Unity Catalog comments, table properties, and true UC tags to all five gold views; generated `pattern-4-ai-readiness-manifest.json` / `.md` plus `pattern4-agent-portal/public/ai-readiness-summary.json`; added an in-app AI Readiness Sync section to the How It Works page with dataset cards and an \"Update Domo AI Readiness\" action. Domo AI Readiness public writes appear UI-managed/no public endpoint, so the app demonstrates the governed UC→Domo readiness update pattern and uses the manifest as the integration contract.",
    "2026-06-09: Created Code Engine package `Pattern 4 Genie Proxy` (`45a89bf2-150e-42a0-83a9-3d911c928712`, v1.0.0) for server-side Databricks Genie calls; app manifest now maps alias `askPattern4Genie`. Created Code Engine package `Pattern 4 Action Writeback` (`888c73e7-7959-4169-a266-0e4ab72a6ff4`, v1.0.0) for Domo-to-Databricks action writeback; app manifest maps alias `writeActionStatus`. Added `agent_action_writeback` Delta table and Execute buttons in the Agent Action Queue. Packages are not released yet because release requires explicit user approval.",
    "2026-06-09: User RELEASED both Code Engine packages at v1.0.0. Verified via product API that Genie Proxy v1.0.0 exposes `askGenie(question, conversationId, persona, model)` and Action Writeback v1.0.0 exposes `writeActionStatus(actionId, decision, executionStatus, approvedBy, note, persona)` — both match the app manifest packagesMapping (alias/function/param names/types) exactly, so in-app `domo.post` calls are correctly wired. `agent_action_writeback` baseline = 0 rows. Added `scripts/codeengine_probe.py` for re-verification.",
    "2026-06-09: Live Genie/writeback fell back to preview with NO Code Engine logs. Reworked to the deal-inspect pattern: top-level `proxyId` + singular `packageMapping`, app calls `domo.post('/domo/codeengine/v2/packages/<functionName>')`, and Domo routes by `proxyId` = CE package NAME. Created consolidated CE package `pattern4ce` (`36a18258-0fb7-407a-b268-4a326c5b73c3`, v1.0.0) exposing `askGenie` and `writeActionStatus`; fixed runtime bugs in CE code (`writeActionStatus` writes real `agent_action_writeback` columns; `askGenie` returns on useful Genie attachments); released `pattern4ce` v1.0.0; republished app. Next: reload/re-add App Studio card and run live Genie/action tests.",
    "2026-06-09: Shaped the ML + Lakebase + Genie UX scope expansion in `pattern-4-ml-lakebase-experience-expansion-shaping.md`. Selected Shape B: Forecast-first predictive command center. Main page becomes a polished time-based forecast/comparison view; Databricks trains/registers/serves an ML model via MLflow/Model Serving; Domo picks it up through AI Services Layer / Databricks ML adapter; `pattern4ce` grows an ad hoc inference function; Lakebase stores operational scenario/prediction-feedback state; Genie becomes a centered workspace with exact Databricks seeded questions and Domo-side plot rendering from Genie result data where possible. Added Sprints 7-8.",
    "2026-06-09: Resolved all three expansion spikes (read-only investigation; full report in `pattern-4-expansion-spike-findings.md`). X1: `runModelInference` calls Databricks Model Serving directly (`POST /serving-endpoints/<name>/invocations` -> `{predictions:[...]}`); Domo AI Services (`/api/ml/v1/models`) is the governance/catalog layer; ML target = renewal-risk/churn classifier on `gold_customer_renewal_risk` with a named-column signature. X2: existing CE package `LakebaseQuery` (`55a6749a`) connects to Lakebase project `cobra-v1` (user-owned, always-warm) via node-postgres + SP M2M token exchange; reuse cobra-v1, add `p4_scenario_runs` + `p4_prediction_feedback`, fold Lakebase into `pattern4ce`. X3: Genie exposes no chart metadata (only SQL + manifest.schema.columns + result.data_array), so charts are reconstructed Domo-side; exported the 5 verbatim seeded sample questions; `askGenie` must be extended to return columns+rows.",
    "2026-06-09: Built the S6 Genie chart-rendering slice locally without publishing. `pattern4ce.askGenie` source now preserves `statement_response.manifest.schema.columns[]` (`name`, `type_name`, `type_text`, `position`) and `result.data_array` as `columns` + `dataRows` while keeping the existing response contract stable. The Domo app reconstructs result visuals from those fields (KPI, line, bar, scatter, or table with a fallback), includes preview sample rows for validation, and has matching changes in `dist/`. Validation passed: `node --check` for source/dist app JS and CE source, manifest JSON parse, ryuu.js-before-app script ordering, referenced HTML ID check, and headless Chrome render of `dist/index.html#genie-demo`. Live Domo chart rendering still requires creating/releasing a new `pattern4ce` version with the updated source; release remains gated on explicit user approval.",
    "2026-06-09: User approved releasing the chart-ready Code Engine update. Created and released `pattern4ce` v1.0.4 (`36a18258-0fb7-407a-b268-4a326c5b73c3`) using the existing in-memory token-injection helper pattern so no Databricks token was written to git or shell output. Verified package metadata shows `v1.0.4` released at `2026-06-09T23:16:33.990Z`; because the app uses `proxyId: \"pattern4ce\"` with singular `packageMapping`, no manifest version pin change is required.",
    "2026-06-09: Implemented requested UX and Lakebase fixes locally. Forecast KPI cards now sit above the Net Revenue timeline; ML prediction gauge/readability was improved; Genie Workspace has more breathing room, a tighter centered expanded mode, and answer text is promoted above the inspector with markdown-style bold formatting; AI Readiness moved out of How It Works into its own interactive tab with selectable dataset details and links to Domo AI Readiness / Databricks table pages. Lakebase Ops now mirrors the `lakebase explorer` CRUD pattern (refresh, add, edit, delete, selected-row details) and writes prediction feedback from the ML page. Created and ran `scripts/seed_pattern4_lakebase.py`, which created `public.p4_scenario_runs` and `public.p4_prediction_feedback` in `cobra-v1` and seeded them from existing `databricks_raptor.pattern4_agent_automation` gold views (4 scenarios, 6 feedback rows). Added typed Lakebase functions to local `pattern4ce` source and created unreleased Code Engine version v1.0.5 with those functions; release is pending explicit user approval.",
    "2026-06-09: User approved release of `pattern4ce` v1.0.5. Released package `36a18258-0fb7-407a-b268-4a326c5b73c3` and verified metadata shows `releasedOn: 2026-06-09T23:43:06.844Z`. This makes the Lakebase Ops functions live for Domo runtime calls (`listScenarios`, `createScenario`, `updateScenario`, `deleteScenario`, `listPredictionFeedback`, `savePredictionFeedback`) while preserving the existing `askGenie` and `writeActionStatus` aliases.",
    "2026-06-09: Polished the Forecast Home governed lineage cards by adding direct actions to open each mapped Domo dataset and each Unity Catalog source table in Databricks. Implemented with `domo.navigate(..., true)` / browser fallback and synced source + `dist`.",
    "2026-06-10: Reworked Lakebase, AI Readiness, and Genie based on published-app feedback. Lakebase now explains the user value as app-owned operational state (saved scenarios, what-if assumptions, prediction feedback) and adds direct links to the Lakebase project/source table from the selected scenario. AI Readiness now explicitly compares Databricks Unity Catalog metadata prepared vs Domo AI Readiness synced, fixes the Domo AI Readiness URL (`/details/ai-readiness`), and stages column-level sync without claiming Domo is enabled. Genie chips now match the Databricks seeded-question order from the screenshot; the chat fills the app width with a light background container; expanded mode is capped in height; and `pattern4ce.askGenie` source now waits for completed Genie messages instead of returning on early query attachments, with a row-based fallback answer when Genie returns SQL but no narrative. Created unreleased `pattern4ce` v1.0.6 with the Genie fix; release requires explicit user approval.",
    "2026-06-10: User approved release of `pattern4ce` v1.0.6. Released package `36a18258-0fb7-407a-b268-4a326c5b73c3` and verified metadata shows `releasedOn: 2026-06-10T00:16:54.715Z`. This makes the Genie wait-for-completed behavior and fallback row-summary answer live for Domo runtime calls.",
    "2026-06-10: Updated the Forecast Home hero chart to mimic the seasonal/time-based behavior shown in the MFG production reference without regenerating Databricks data. The app now uses a weekly synthetic forecast series with annual seasonality, quarter pulses, operating noise, an incident dip, recovery, future lift, and a widening confidence band; controls changed from 12/18/24 months to 26/52/78 weeks. Underlying gold-table regeneration is still optional if the persisted Domo datasets need to show the same fine-grained seasonality.",
    "2026-06-10: Fixed Databricks external-link handling in Domo apps: non-Domo URLs now use a normal new-tab browser open instead of `domo.navigate`, avoiding unsupported-domain errors for Lakebase/Databricks workspace links. Clarified Lakebase Prediction Feedback UX: scenario saves do not create feedback rows; feedback rows come from Accept/Adjust/Reject actions on the ML Predictions tab. Decision: update underlying Databricks/Domo data with seasonal forecast behavior during the upcoming ML model build/data refresh pass.",
    "2026-06-10: Added a separate Genie Embed Alpha tab using the native Databricks iframe URL (`/embed/genie/rooms/01f1642295b61d6b8849e106f52fc781?o=8127410670216233`). This gives a side-by-side test path for native Databricks-rendered result tables/plots if iframe policy allows it. The existing Genie Workspace remains the controlled Code Engine path for app-native inspector metadata and Domo-side chart reconstruction from `columns` + `dataRows`.",
    "2026-06-10: Reworked AI Readiness again to avoid implying a live write path. The app now loads detailed column-level Unity Catalog readiness metadata from `ai-readiness-detail.json`, compares each column's Databricks/UC prepared state against Domo synced state, and supports per-column Sync/Wipe plus dataset-level Sync all/Wipe controls as staged demo state. Investigated historical Code Engine package `0689ed1a-1d81-422b-8e88-49d305bf340c`; product API metadata shows it is private/unreleased with no exposed functions, so it is not currently a callable implementation path. Real Domo AI Readiness persistence remains TBD pending a confirmed writable endpoint or package contract.",
    "2026-06-10: Scope refinement: Unity Catalog remains the authoritative source of truth, but the app should also support a controlled column-level edit/propose UC context path so a user can update Databricks column comments/tags/synonyms from the app when they intentionally want to improve source metadata. This is a governed exception to the primary UC -> Domo sync direction and should include review/confirmation, audit/writeback, and a clear distinction between editing UC source metadata and syncing UC metadata into Domo AI Readiness.",
    "2026-06-10: Built the live AI Readiness bridge locally in `pattern4ce` source and app wiring. Added server-side functions to read UC readiness state, read/write/wipe Domo AI Readiness, and update UC column context (`getUcReadinessState`, `getDomoAiReadiness`, `syncDomoAiReadiness`, `wipeDomoAiReadiness`, `updateUcColumnContext`). Updated app manifests and `scripts/create_pattern4ce.py` to include these aliases. The Domo AI Readiness functions now use a `domo_account` Code Engine `ACCOUNT` input, matching the existing `Databricks Unity Catalog AIR` pattern (`codeengine.getAccount(domo_account.id).properties.domoAccessToken`). The app attempts live sync/wipe and UC edit calls, falling back to staged local state when Code Engine/account configuration is unavailable. Release gate: configure the `domo_account` parameter to the Domo Access Token account and create/release a new `pattern4ce` version with explicit approval.",
    "2026-06-10: User configured the `domo_account` Code Engine Account parameter for the Domo Access Token provider and approved release of `pattern4ce` v1.0.7. Released package `36a18258-0fb7-407a-b268-4a326c5b73c3` and verified metadata shows `releasedOn: 2026-06-10T02:08:35.482Z`. This makes account-backed Domo AI Readiness sync/wipe and UC column-context edit functions live for app runtime calls.",
    "2026-06-10: Published-app testing showed the app-runtime Code Engine proxy could not pass/inject `domo_account` and returned 400s for AI Readiness calls. Reworked `pattern4ce` v1.0.8 to use a server-side Domo access token placeholder injected from the local secure token file at version creation time, while keeping the app manifest free of `domo_account`. User approved release; released `pattern4ce` v1.0.8 and verified metadata shows `releasedOn: 2026-06-10T02:30:42.410Z`.",
    "2026-06-09: Sprint 7 model foundation and inference bridge built up to approval gates. Refreshed seasonal Databricks revenue/risk facts and gold views, added `gold_revenue_forecast_time_series`, trained and registered UC/MLflow model `databricks_raptor.pattern4_agent_automation.pattern4_renewal_risk` v3, wrote model report + serving endpoint plan, and staged `pattern4ce.runModelInference(records)` plus ML Predictions live-call wiring in source and `dist`. Model Serving deployment, Code Engine release, and final Domo AI Services registration remain gated/blockered as documented.",
    "2026-06-09: User approved Model Serving cost for Sprint 7. Created Databricks Model Serving endpoint `pattern4-renewal-risk` for UC model v3. Latest observed state remains `NOT_READY` / `IN_PROGRESS`; served entity `pattern4_renewal_risk_v3` is `DEPLOYMENT_CREATING` with message `Container creation pending.` Code Engine release remains gated until endpoint is READY and tested."
  ],
  blockers: [
    "Unity AI Gateway availability is not yet confirmed; Code Engine proxy currently provides the server-side bridge while Gateway/OBO is finalized.",
    "UC row-filter implementation is still pending; entitlement design exists in `dim_user_entitlement` / `gold_portal_user_scope`.",
    "Domo AI Readiness write automation is not publicly exposed; current implementation uses UC metadata + readiness manifest + in-app update demo pending an internal/supported write endpoint.",
    "Code Engine packages released and verified against the manifest; final check is action writeback execution from the published Domo app.",
    "RESOLVED 2026-06-09: ML/AI-Services/Lakebase/Genie spikes complete (`pattern-4-expansion-spike-findings.md`); implementation can proceed.",
    "Gated on user confirm before execution (cost / shared-resource writes): deploying a Databricks Model Serving endpoint, and writing Lakebase tables into the shared `cobra-v1` project. The forecast-first front-end redesign proceeds mock-first in parallel.",
    "Domo AI Services runtime invoke contract for a registered Databricks model is unconfirmed (registry list is POST-gated); direct Model Serving avoids the dependency.",
    "RESOLVED 2026-06-10: User configured `domo_account` and approved release; `pattern4ce` v1.0.7 is live with account-backed AI Readiness sync/wipe and UC column-context edit functions. Remaining check is an in-Domo AI Readiness click-test after publishing latest `dist`.",
    "RESOLVED 2026-06-09: User approved release and `pattern4ce` v1.0.4 is live with the chart-result contract. Remaining check is an in-Domo app click-test to confirm live Genie responses now include `columns` + `dataRows` and render charts in the published portal.",
    "RESOLVED 2026-06-09: User approved release and `pattern4ce` v1.0.5 is live with Lakebase read/write functions. Remaining check is an in-Domo app click-test after the user publishes latest `dist`.",
    "RESOLVED 2026-06-10: User approved release and `pattern4ce` v1.0.6 is live with the Genie wait-for-completed + fallback answer fix. Remaining check is an in-Domo Genie click-test after user publishes latest `dist`.",
    "Sprint 7 status: Model Serving endpoint `pattern4-renewal-risk` was created after user approval, but is not READY yet (`DEPLOYMENT_CREATING`, container creation pending).",
    "Sprint 7 approval gate: do not release the staged `pattern4ce.runModelInference` Code Engine update until the endpoint is READY/tested and the user explicitly approves release.",
    "Domo AI Services registration route remains unconfirmed: current CLI session returned 404 for `/api/ml/v1/models`; direct Databricks Model Serving remains the runtime inference path."
  ],
  decisions: [
    "Pattern 4 is the baseline experience.",
    "Agent-to-agent automation is included as a primary build module.",
    "`Databricks Raptor AWS` (`a83b5bbc-fc3f-43c0-8ea5-f15117de997d`) is the intended Domo cloud integration.",
    "When opened from disk, the HTML dashboard uses bundled plan data from `pattern-4-plan-data.js`; when served over HTTP, it fetches the live Markdown file.",
    "The HTML project manager should include a visual timeline/Gantt view in addition to sprint cards and lists.",
    "Use `databricks_raptor` as the Unity Catalog catalog for generated data.",
    "Use `databricks_raptor.pattern4_agent_automation` as the project schema.",
    "Use a hybrid synthetic data approach: generate governed scale data in Databricks with Spark + Faker, using the Domo data-generator skill patterns for entity design, realism, reproducibility, date grain, and Domo card compatibility.",
    "Build the portal as a fully pro-code experience rather than App Studio-only.",
    "Anchor all portal UI on `snowflake-summary/domo-styleguide.mdc`: Domo Blue dominant, orange secondary/risk accent, Domo neutrals, Open Sans; Databricks red + lakehouse glyph used sparingly and never overpowering Domo Blue.",
    "Use `https://databricks-demo.domo.com/` as the Domo instance; Domo CLI access is already logged in.",
    "Use `~/bin/databricks` as the local Databricks CLI path until PATH is updated.",
    "Use Databricks CLI profile `pattern4` for workspace validation and build automation.",
    "Use `Main SQL Warehouse` (`ea829ba58bcae093`) as the candidate SQL warehouse unless a better project-specific warehouse is selected.",
    "Use Shape C hybrid for Genie chat: enhanced in-place Domo panel plus actual Pattern 4 Genie Space deep link; stage K-A preview UI now, K-B live Conversation API proxy next.",
    "Treat Databricks `supervisor-agents` as a possible later agent-mesh enhancement, not a Sprint 1 dependency.",
    "Use `pattern-4-synthetic-data-generation-spec.md` as the Sprint 1 data generation approval artifact.",
    "Use `pattern-4-synthetic-data-validation-report.md` as the Sprint 1 data validation proof point.",
    "Use `pattern-4-domo-cloud-integration-report.md` as the Sprint 2 Cloud Amplifier registration guide.",
    "Use `pattern4-agent-portal/` as the pro-code portal scaffold and keep it in mock mode until Domo dataset IDs are discovered.",
    "Use `pattern4-agent-portal/dataset-validation-report.json` as the Sprint 2 Domo dataset validation proof point.",
    "Unity Catalog is the source of truth for Domo AI Readiness metadata. Mirror `pattern-4-ai-readiness-manifest.json` into Domo AI Readiness / AI Dictionary for the five gold datasets.",
    "The AI Readiness app should support column-level UC metadata edits as a governed source-system update path, while keeping UC -> Domo as the sanctioned sync direction.",
    "Published portal page: `https://databricks-demo.domo.com/page/1097826706`",
    "Published design: `https://databricks-demo.domo.com/assetlibrary?designId=e8a0b5da-d20b-450d-8790-de7ef1634ea7`",
    "Use `pattern-4-ml-lakebase-experience-expansion-shaping.md` as the source of truth for the ML/Lakebase/forecasting/Genie UX expansion.",
    "Selected expansion shape: Shape B — Forecast-first predictive command center.",
    "Main page redesign should be inspired by `/Users/cassidy.hilton/Cursor Projects/forecast line recharts` (actual vs prediction, confidence band, period controls, compact legend, polished tooltip).",
    "ML inference runtime path: `pattern4ce.runModelInference` calls Databricks Model Serving directly (`dataframe_records` in, `{predictions:[...]}` out); Domo AI Services is the governance/catalog layer.",
    "ML model = renewal-risk/churn classifier on `gold_customer_renewal_risk`, named-column MLflow signature, registered in UC, served like `CassidyLightGBM`.",
    "Sprint 7 deployment target is UC model `databricks_raptor.pattern4_agent_automation.pattern4_renewal_risk` version 3 and planned serving endpoint `pattern4-renewal-risk`; config is captured in `pattern-4-model-serving-endpoint-plan.json`.",
    "Seasonal forecast behavior should be pushed into the underlying Databricks/Domo datasets during the ML model build/data refresh pass, rather than as a standalone regeneration right now.",
    "Lakebase: reuse project `cobra-v1`; first tables `public.p4_scenario_runs` + `public.p4_prediction_feedback`; fold Lakebase access into `pattern4ce` (SP M2M token -> node-postgres).",
    "Genie has no chart metadata; render Domo-side charts from `manifest.schema.columns` + `result.data_array`. App seeded-question chips must match the 5 verbatim Genie sample questions.",
    "App IA = tabs/views inside the pro-code app: Forecast Home, ML Predictions, Lakebase Ops, Genie Workspace, How It Works."
  ],
  openDecisions: [
    "Investigate whether Unity AI Gateway is available in the target workspace for tool registration; requires Databricks API token or configured CLI profile.",
    "Decide the persona/group model to mirror between UC row filters and Domo PDP.",
    "Confirm with user: deploy Databricks Model Serving endpoint `pattern4-renewal-risk` (ongoing compute cost) for UC model version 3.",
    "RESOLVED: `p4_scenario_runs` + `p4_prediction_feedback` tables are already created in the shared `cobra-v1` Lakebase project.",
    "Optionally capture the Domo AI Services model network call from the browser to confirm the AI-Services-mediated invoke contract (not required for direct Model Serving)."
  ],
  nextSteps: [
    "DONE — All three expansion spikes resolved (`pattern-4-expansion-spike-findings.md`).",
    "Redesign the app IA around Forecast Home, ML Predictions, Lakebase Ops, Genie Workspace, and How It Works; build the forecast-first hero (mock-first), inspired by `forecast line recharts`.",
    "DONE — Genie Workspace chart rendering: `askGenie` source returns columns+rows, the app renders Domo-side KPI/line/bar/scatter/table visuals, and `pattern4ce` v1.0.4 is released. Next validation is an in-Domo app click-test after the user publishes or reloads the latest `dist`.",
    "DONE — Lakebase Ops: `p4_scenario_runs` + `p4_prediction_feedback` are created/seeded in `cobra-v1`; app CRUD UI and `pattern4ce` v1.0.5 live functions are built/released for live reads/writes.",
    "Validate the published Domo app after user publishes latest `dist`: live Lakebase rows should load, scenario CRUD should write to `cobra-v1`, ML prediction feedback should save, and Genie result charts should remain visible.",
    "Sprint 7 next step: wait for Model Serving endpoint `pattern4-renewal-risk` to become READY, test `dataframe_records` inference, then request explicit Code Engine release approval for the staged `pattern4ce.runModelInference(records)` update.",
    "Keep UC row-filter/PDP alignment and Agent Catalyst/Workflow approval wrapper in scope as supporting governance and automation work."
  ]
};
