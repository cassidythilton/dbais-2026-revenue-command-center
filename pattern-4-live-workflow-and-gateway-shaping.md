---
shaping: true
---

# Pattern 4 — Live Domo Workflow + Unity AI Gateway/OBO — Shaping

Two related deliverables, currently documented as optional follow-ons in the build plan
(Sprint 4/5 "known limitations"). Shape BOTH first, pick a shape per track, then build.

- **Track 1 — Live Domo Agent Catalyst / Workflow:** turn the in-app "Approve & execute"
  into a real, governed Domo Workflow (human approval → execution → status writeback + audit
  trace), triggered from the pro-code app.
- **Track 2 — Unity AI Gateway / OBO:** govern the Databricks-side tool calls (model + Genie)
  through Unity AI Gateway with usage tracking, rate limits, guardrails, and a documented
  on-behalf-of (OBO) identity path.

---

## Grounding facts (verified this session, read-only)

- The app's `executeAction()` → `domo.post('/domo/codeengine/v2/packages/writeActionStatus', …)`
  → released `pattern4ce` **v1.0.12** `writeActionStatus(actionId, decision, executionStatus,
  approvedBy, note, persona)` → inserts into Delta `…pattern4_agent_automation.agent_action_writeback`
  (`writeback_id, action_id, decision, execution_status, approved_by, note, persona,
  source_app, created_ts`). UI optimistically flips Approval/Execution + bumps Protected Revenue.
- `pattern4ce` already has a **server-side `domoApi(method, path, body)` helper** authed with a
  Domo developer token (used today for AI Readiness). So a CE function CAN call Domo platform
  APIs server-side — including a Workflow start/trigger endpoint.
- The project moved OFF per-card manifest bindings (`workflowMapping`/app context) to
  `proxyId: "pattern4ce"` + singular `packageMapping` precisely because App Studio card
  **contexts went stale** and silently fell back. Any new trigger path should avoid
  reintroducing that staleness.
- `pattern4-renewal-risk` serving endpoint: `ai_gateway: null` today; `state.ready = READY`;
  it's a **custom** UC-model endpoint (HGB regressor v6), not external/PT/pay-per-token.
- Other **custom** endpoints in this workspace already have AI Gateway enabled
  (`dkg_marketing_leads_forecaster_v2`, `adrenaline-dba-wiki`) → usage-tracking + inference
  table (and rate limits) are enable-able on a custom endpoint here.
- Foundation `llm/v1/chat` endpoints exist (pay-per-token: `databricks-claude-*`, `gpt-*`) —
  these are where AI Gateway **guardrails** (PII/safety/topic) are real, because guardrails
  inspect text. A regressor returns a number, so guardrails don't apply to it.
- Genie is NOT a serving endpoint; it can't be "put behind" AI Gateway. Genie governance =
  Unity Catalog + Genie space permissions + (today) a static workspace PAT in CE.

---

# Track 1 — Live Domo Workflow

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | Clicking **Approve & execute** starts a real, governed Domo Workflow that routes a human approval and writes status back so the dashboard reflects reality (pending/approved/executed/rejected visible + auditable) | Core goal |
| R1 | Reuse/extend the existing `agent_action_writeback` contract so Forecast Home status pills + Protected Revenue still update from the workflow's result | Must-have |
| R2 | Capture a queryable audit/trace: source question/context → recommendation → approval → execution result (incl. the workflow run/instance id) | Must-have |
| R3 | Trigger path must be **robust to the App Studio stale-context gotcha** that already broke per-card bindings on this project | Must-have |
| R4 | No **new** `pattern4ce` Code Engine release required (avoids the release gate + cross-workstream rebuild coordination) | Nice-to-have |
| R5 | Human approval is a real Domo task (assignable, visible in a queue/inbox, auditable) | Must-have |
| R6 | Keep the existing CE `writeActionStatus` writeback as a graceful **fallback** path if the workflow start fails | Must-have |
| R7 | A real Agent Catalyst agent generates the renewal-risk triage recommendation (vs. the recommendation coming from the gold action queue) | Nice-to-have |

## A: CE-bridged workflow start, released `writeActionStatus` as the action step

| Part | Mechanism | Flag |
|------|-----------|:----:|
| A1 | **Workflow model** (via `community-domo-cli`): `rootNode` inputs (actionId, account, recommendation, persona, predicted, protected, sourceQuestion) → `userTaskNode` approval form (shows account/recommendation/protected; Approve/Reject) → `conditionalGatewayNode` → Approve branch / Reject branch | |
| A2 | **Action step** = `serviceTaskNode` calling the ALREADY-RELEASED `pattern4ce.writeActionStatus` (decision=Approved/Rejected, executionStatus=Executed/Rejected). No CE change needed for the action. | |
| A3 | **Trigger** = new `pattern4ce.startRetentionWorkflow(...)` that server-side POSTs to the Domo Workflow start API via the existing developer-token `domoApi` helper; returns the run/instance id. App `executeAction` calls it via `domo.post`. (Robust to context staleness — no `workflowMapping`.) | ⚠️ confirm exact start endpoint + dev-token auth |
| A4 | **Audit/trace**: extend `agent_action_writeback` with `workflow_instance_id, source_question, recommendation, predicted_value, protected_value, approval_state` (or add `agent_action_trace`), written at start + at decision | |
| A5 | **App UX**: `executeAction` → start workflow → pill shows "Workflow started · run <id> · awaiting approval"; on fallback, the current optimistic approve→execute path runs and is labelled local | |

Cost: one **gated** CE release (the new `startRetentionWorkflow` trigger function). Action step
reuses released code. Robust to staleness. Agent Catalyst = later layer.

## B: App-native WorkflowClient (toolkit), no CE release

| Part | Mechanism | Flag |
|------|-----------|:----:|
| B1 | Same workflow model as A1/A2 | |
| B2 | Add `workflowMapping` to `manifest.json` + `dist`; app uses `@domoinc/toolkit` `WorkflowClient.startModel('retentionTriage', {…})` | |
| B3 | Audit/trace as A4 | |
| B4 | App UX as A5, minus the CE trigger | |

Cost: no CE release. BUT reintroduces the per-card **context binding** (`workflowMapping`) that
historically went stale in App Studio (R3), and adds the toolkit bundle to the pro-code app.

## C: A + a real Agent Catalyst triage agent

| Part | Mechanism | Flag |
|------|-----------|:----:|
| C1 | Everything in Shape A | |
| C2 | An **Agent Catalyst** agent for renewal-risk triage that turns a risk condition (Genie/model) into the recommendation feeding the workflow | ⚠️ Agent Catalyst authoring/availability via CLI/API not yet confirmed |

Cost: A + Agent Catalyst surface. Fuller narrative; more unknowns.

## Fit Check — Track 1

| Req | Requirement | Status | A | B | C |
|-----|-------------|--------|---|---|---|
| R0 | Approve & execute starts a real governed Workflow w/ approval + writeback; states visible + auditable | Core goal | ✅ | ✅ | ✅ |
| R1 | Reuse/extend `agent_action_writeback`; dashboard pills + Protected Revenue update | Must-have | ✅ | ✅ | ✅ |
| R2 | Queryable audit/trace incl. workflow run id | Must-have | ✅ | ✅ | ✅ |
| R3 | Robust to App Studio stale-context gotcha | Must-have | ✅ | ❌ | ✅ |
| R4 | No new `pattern4ce` release required | Nice-to-have | ❌ | ✅ | ❌ |
| R5 | Human approval is a real Domo task (queue/inbox, auditable) | Must-have | ✅ | ✅ | ✅ |
| R6 | Existing CE writeback kept as fallback | Must-have | ✅ | ✅ | ✅ |
| R7 | Agent Catalyst agent generates the triage recommendation | Nice-to-have | ❌ | ❌ | ❌ |

**Notes:**
- B fails R3: `workflowMapping` binds at card-instantiation time → the exact staleness class that already broke this app.
- A and C fail R4: starting the workflow server-side adds `startRetentionWorkflow`, which needs a gated CE release.
- C's R7 is ❌ (flagged): Agent Catalyst CLI/API authoring is unconfirmed → fails until spiked. (R7 is ❌ for all shapes today; A/B simply don't attempt it.)
- A3 is flagged ⚠️: confirm the Domo Workflow start endpoint + that the developer token can call it (one small spike before/early in the build).

**Recommendation:** **Shape A.** It is robust to the staleness gotcha that already burned this
project, reuses the released `writeActionStatus` as the workflow's action step, and only costs
one gated CE release (the trigger fn). Layer Shape C's Agent Catalyst agent later once we spike
CLI authoring. (Shape B is fastest but knowingly walks back into the stale-context failure mode.)

---

# Track 2 — Unity AI Gateway / OBO

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | Govern + audit the Databricks-side tool calls (model + Genie) through Unity AI Gateway, with a **documented OBO** identity path — don't fake what isn't available | Core goal |
| R1 | Enable AI Gateway on the existing `pattern4-renewal-risk` endpoint (usage tracking + inference/payload table + rate limits) WITHOUT breaking the live `runModelInference` contract | Must-have |
| R2 | Govern the **text/LLM reasoning** path with guardrails (PII/safety) — guardrails are real on an `llm/v1/chat` endpoint, not on the numeric regressor | Nice-to-have |
| R3 | **OBO**: pass end-user identity through instead of a static service token; if not feasible in the embedded Domo app, document the exact blocker + the supported route | Must-have |
| R4 | No new `pattern4ce` release required; app/runtime contract stays stable | Nice-to-have |
| R5 | Make governance **visible/auditable** in the demo (inference-table / system-table query, or an in-app "governed by gateway" surface) and flip How It Works `gw` stage roadmap → live | Must-have |
| R6 | No new ongoing **compute cost** without approval | Must-have |

## A: Inference-table + usage + rate-limit governance on the existing endpoint

| Part | Mechanism | Flag |
|------|-----------|:----:|
| A1 | `serving-endpoints put-ai-gateway pattern4-renewal-risk` with **usage_tracking_config** (logs to system tables) + **inference_table_config** (payload logging to a UC table in `pattern4_agent_automation`) + **rate_limits** | |
| A2 | Invocations URL unchanged → `runModelInference` / app contract untouched (no CE release) | |
| A3 | OBO = **documented**: today CE invokes with a single service-principal/workspace token (audited as one identity); OBO target = U2M OAuth / token federation; the honest blocker = an embedded Domo app carries a Domo identity, not a Databricks user identity | |
| A4 | Genie governance = documented (UC + Genie space perms); Genie can't sit behind a serving-endpoint gateway | |
| A5 | Demo proof: query the inference/usage table to show governed, audited calls; flip How It Works `gw` stage to live **for the model path** | |

Cost: inference-table writes only (no new endpoint). No CE/app change. Guardrails N/A (numeric).

## B: A + AI Gateway over an LLM reasoning endpoint (full guardrails)

| Part | Mechanism | Flag |
|------|-----------|:----:|
| B1 | Everything in Shape A | |
| B2 | Enable AI Gateway (usage + rate limits + **guardrails** + inference table) on a pay-per-token foundation `llm/v1/chat` endpoint and route an agent-reasoning call through it | |
| B3 | Wire a real LLM call path into the narrative (e.g. a `pattern4ce.askReasoningModel` or an Agent Bricks step) so guardrails are exercised live | ⚠️ adds a new call path the app doesn't make today (CE release) |

Cost: A + FMAPI pay-per-token per call (no idle compute) + a CE release for the new call path.

## C: Document-only (architecture + exact enablement commands)

| Part | Mechanism | Flag |
|------|-----------|:----:|
| C1 | No platform changes; produce a precise gateway + OBO design doc + diagram, capture the exact `put-ai-gateway` payloads and the OBO blocker; leave How It Works `gw` as roadmap | |

Cost: none. Lowest value — essentially current state + better docs.

## Fit Check — Track 2

| Req | Requirement | Status | A | B | C |
|-----|-------------|--------|---|---|---|
| R0 | Govern + audit model + Genie via gateway, with documented OBO (no faking) | Core goal | ✅ | ✅ | ❌ |
| R1 | Enable gateway on existing endpoint, runModelInference contract intact | Must-have | ✅ | ✅ | ❌ |
| R2 | Govern the text/LLM path with live guardrails | Nice-to-have | ❌ | ✅ | ❌ |
| R3 | OBO passthrough OR documented blocker + supported route | Must-have | ✅ | ✅ | ✅ |
| R4 | No new `pattern4ce` release required | Nice-to-have | ✅ | ❌ | ✅ |
| R5 | Governance visible/auditable in demo; `gw` stage → live | Must-have | ✅ | ✅ | ❌ |
| R6 | No new ongoing compute cost without approval | Must-have | ✅ | ✅ | ✅ |

**Notes:**
- A fails R2: a regressor has no text, and Genie isn't a serving endpoint, so there's no live guardrail surface — this is an honest platform limitation, not a defect of A.
- B satisfies R2 (FMAPI guardrails are real) but fails R4 (needs a new LLM call path → CE release) and exercises pay-per-token cost (R6 = approved-per-call, flag).
- C fails most — nothing is enforced live.

**Recommendation:** **Shape A.** It's a real, honest, zero-extra-cost win: AI Gateway usage
tracking + inference-table payload logging + rate limits on `pattern4-renewal-risk`, no CE/app
change, and the `gw` stage goes live for the model path. The Genie + OBO pieces get documented
precisely (real blocker: the embedded Domo app has no Databricks user identity; supported route =
U2M OAuth / token federation; today = one audited service principal). Layer **B** later if you
want live LLM guardrails in the agent-reasoning narrative.

---

## Decision log

- 2026-06-10 — **Track 1 = Shape A** (CE-bridged workflow start; reuse released `writeActionStatus` as the action step; trigger via new `pattern4ce.startRetentionWorkflow`). Approval task **assigned to `cassidy.hilton@domo.com`** (demoable from own inbox). Agent Catalyst (C) deferred.
- 2026-06-10 — **Track 2 = Shape B** (A + live AI Gateway guardrails over an LLM reasoning endpoint). User accepted pay-per-token cost. Guardrails/usage/rate-limits/inference-table on the LLM path; usage+inference-table+rate-limits on `pattern4-renewal-risk`; Genie+OBO documented honestly.
- Gates: build + validate locally only; **no `pattern4ce` release without explicit "release"**; user runs `domo publish`. No new idle-GPU compute (pay-per-token LLM only).
- 2026-06-10 — **AGENT-TO-AGENT upgrade (user-directed).** The workflow now embeds a **Domo AI Agent tile** that calls a **Databricks Agent Bricks Supervisor Agent (MAS)** — true agent ⇄ agent. Built: (1) Databricks MAS **"Pattern 4 Retention Supervisor"** (`mas-77bd204b-endpoint`, `agent/v1/responses`) with the Pattern 4 **Genie Space** as a governed tool (the renewal-risk regressor isn't a chat endpoint so it can't be a MAS tool; scoring stays in `runModelInference`). (2) CE `askRetentionAgent(prompt)` → calls the MAS invocations endpoint, parses the Responses-API output, returns the recommendation. (3) Workflow definition rebuilt: `Start → AI_AGENT "Retention triage agent" (tool = askRetentionAgent → MAS) → userTask approval (form now shows the agent recommendation) → Approved? gateway → writeActionStatus → ends`; validated **0 ERRORs**; approval form recreated as v2 (`09d21bbc…`). **Release dependency:** `askRetentionAgent` is in the full `functions.js` (18 fns) but NOT in released v1.0.14 — the AI agent tool binds `packageVersion 1.0.14` as a placeholder. **To go live:** (a) coordinated `pattern4ce` release that includes `askRetentionAgent`; (b) bump `CE_VERSION` in `scripts/create_pattern4_workflow.py` to that release + re-run (re-PUTs the definition); (c) user Deploys workflow 1.0.0; (d) `domo publish` + re-instantiate the App Studio card (manifest now 18 aliases).
- 2026-06-10 — **RELEASED.** User approved; `pattern4ce` **v1.0.15** released (adds `askRetentionAgent`); workflow def re-PUT binding the AI agent tool + service tasks to v1.0.15 (0 ERRORs); released source == local; 18/18 manifest aliases covered. Remaining = UI-only (Deploy workflow 1.0.0, `domo publish`, re-instantiate card).
- 2026-06-10 — **BUILD COMPLETE (both tracks).** Track 1: workflow `Pattern 4 - Renewal Risk Retention` (`6cbd5ecb…` v1.0.0) authored+validated (0 ERRORs); CE `startRetentionWorkflow`/`getRetentionWorkflowResult` + app wiring + trace columns done. Track 2: AI Gateway live on `pattern4-renewal-risk` + new guardrailed `pattern4-reasoning-gateway` + CE `askReasoningModel` + in-app rationale. `pattern4ce` **v1.0.14 released** (17 fns, signatures match manifest, body references the workflow + reasoning endpoint). **Remaining user gates (UI-only):** Deploy the workflow in Domo (registers the start trigger) + `domo publish` latest `dist` + re-instantiate the App Studio card.

## Spike findings (resolved)

- **A3 RESOLVED — workflow start endpoint.** `@domoinc/toolkit` `WorkflowClient.startModel(alias, vars)` POSTs to `/domo/workflow/v1/models/{alias}/start`. The app-runtime proxy resolves `{alias}`→modelId via `workflowMapping` (the stale-context surface). The **raw** server-side endpoint (Shape A) is `POST /api/workflow/v1/models/{modelId}/start` with the input vars as JSON body — callable from `pattern4ce` via the existing developer-token `domoApi` helper. No alias, no `workflowMapping`, no card context → immune to staleness.
- **Authoring via REST** (not CLI). Installed `community-domo-cli` 0.1.1 only exposes `workflows get`, so the workflow is authored through the Domo Workflows REST API via `community_domo_cli`'s Python `DomoClient` (ryuu-session / dev token). Endpoints: list/get `/workflow/v2/models`, definition `/workflow/v2/models/{id}/versions/{v}/definition`, forms `/forms/v2`, queues `/queues/v1`, instances `/workflow/v1/instances`.
- **Templates harvested** from real v2 workflows in this instance: rootNode (`isFormStart:false`, API inputs → dataList + `schema.inputs`), userTaskNode (form fields, `assignedTo` person, `selectedQueue`), Basic `rules` conditionEdge (`operator:"Equals"`, `valueType:"Custom"`) + `Default` else, and CE `serviceTaskNode` (`taskType:"nebulaFunction"`, `metadata.packageId/packageName/functionName/version`, `selectedTaskTitle/Description`).
- **Runtime IDs**: approval assignee = my Domo user **1433178023** (Admin); queues live at `/queues/v1`; CE package `pattern4ce` `36a18258-…` released **v1.0.12** `writeActionStatus(actionId, decision, executionStatus, approvedBy, note, persona)` (all text; `outputs:null`).
- **Track 2 grounding**: `pattern4-renewal-risk` `ai_gateway:null`; multiple custom endpoints here already run AI Gateway → usage-tracking + inference-table + rate-limits enable-able on it. Guardrails require a text/LLM endpoint; system `llm/v1/chat` FM endpoints exist and an **external-model wrapper** endpoint is the isolated way to attach our own gateway guardrails without mutating a shared system endpoint.
