---
shaping: true
---

# Pattern 4 — Agent Action "Execution Journey" Timeline — Shaping

## Source (verbatim)

> while we're still focused on vignette 5, when i click approve & execute there's a bit of
> animation then this state. "executed" with "writeback". there's not denotation of an approval
> task waiting (which is true) and it's not intuitive to the user what they should do next… what
> i'm envisioning is an animated, multi-step, multi-colored timeline that shows the critical steps
> being taken across both the domo workflow/agent and the databricks agent as well as the pending
> approval, and then once the task has been approved a fully complete timeline. of course, maintain
> the ability to "go to source" on each step. the good news is, since we moved the Agent Action
> Queue to the full width of the app we have the real estate to make this beautiful.

## Problem

After **Approve & execute**, the execution cell jumps to a terminal **"Executed · ✓ writeback"** —
even when a real human-approval task is still **OPEN** in Domo. It's misleading (the action isn't
done) and gives the user no idea what to do next. Root cause: `executeAction()` falls to the local
optimistic path (mark `Executed` + writeback) whenever the live workflow-start result isn't a clean
`SUCCEEDED { instanceId }`, so the genuine **PENDING → approval → writeback** lifecycle is hidden.

## Outcome

Clicking Approve & execute lights up a **beautiful, animated, multi-colored timeline** that traces
the action across **Domo (workflow + AI agent)** and **Databricks (agent + Genie + Unity Catalog)**,
makes the **pending approval** and the **next step** obvious, lets you **go to source on every
step**, and resolves to a **fully complete timeline** once approved (or a clear rejected branch).

---

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | Replace the terminal "Executed/writeback" exec-cell with an **animated, multi-step timeline** that traces the action across Domo and Databricks, surfaces the pending approval + next step, and resolves to a fully complete timeline once approved/rejected. | Core goal |
| R1 | **Truthful state** — the visualization always reflects the real run state; it must **never show "Executed" while a human approval is still pending**. Pending / approved / rejected / writeback are distinct and accurate. | Must-have |
| R2 | **Cross-platform & multi-colored** — each step is color- + icon-coded to its plane (Domo Workflow, Domo AI agent, Databricks agent/Genie, human approval, Unity Catalog writeback) so the agent-to-agent + governed story reads at a glance. | Must-have |
| R3 | **Unmistakable next action** — while pending, the timeline makes "waiting on your approval" obvious and offers in-app Approve/Reject (and/or one-click jump to Approvals). | Must-have |
| R4 | **Animated & self-advancing** — the active step animates, completed steps fill in, progress auto-advances via the existing poll (no manual Refresh); slow/cold agent shows a working state, never a hang or a false "complete". | Must-have |
| R5 | **Go to source on every step** — each step carries its own deep link (workflow run, agent build page, MLflow activity log/trace, Domo task/queue, writeback table), reusing existing `openExternal` links + the in-app agent inspector. | Must-have |
| R6 | **Beautiful use of the full-width real estate** — uses the now-full-width Agent Action Queue to render a rich timeline without re-cluttering the table; collapses to a clean per-row status when unfocused; degrades gracefully in local/fallback mode. | Must-have |
| R7 | **Reuse live plumbing, no CE release** — built entirely on existing client state (`workflowRuns`), `executeAction`, polling, `askRetentionAgent` inspect, and existing source links; no new `pattern4ce` release or workflow re-version. | Must-have |
| R8 | **Booth showpiece focus** — executing an action lights up **one** beautiful focal timeline the presenter can narrate, with the agent's reasoning in the same view, minimizing separate UI surfaces and clicks. | Must-have |

---

## Shared step model (the timeline content — same across shapes)

| # | Step | Plane · color | Lights when | Go to source |
|---|------|---------------|-------------|--------------|
| 1 | **Agent recommended the play** | Databricks agent · red | seeded (already done on load) | Inspect agent (in-app) · Open agent ↗ |
| 2 | **Domo Workflow started** | Domo workflow · blue | `startRetentionWorkflow` → `instanceId` | Workflow run ↗ |
| 3 | **Domo agent ⇄ Databricks agent reasoned** | Agent⇄Agent · violet | agent tile / MAS produced recommendation | Activity log (MLflow) ↗ · Inspect agent |
| 4 | **Awaiting human approval** | Human · amber (pulses while pending) | workflow `PENDING` | **Approve / Reject** (in-app) · Open task ↗ |
| 5 | **Approved / Rejected** | Decision · green / red | poll sees `decided` | Approvals tab · Open task ↗ |
| 6 | **Written back to lakehouse** | Unity Catalog · teal | `writeActionStatus` service task | Writeback table ↗ |

**State mapping**
- *Just executed (live):* 1✓ 2✓ 3 working→✓ · **4 ● pulsing (current)** · 5 — · 6 — (poll running)
- *Approved:* 1–4 ✓ · 5 ✓ green · 6 ✓ → **fully complete**, Protected Revenue ticks up
- *Rejected:* 5 ✗ red · 6 ✓ (rejected status) → complete, red branch
- *Local fallback (no live workflow):* compress to "Approved (local) → writeback (local)" with a subtle "demo fallback" note; intermediate steps marked local/skipped

---

## CURRENT

The exec-cell (`renderActions`) renders one of: **Approve & execute** button (pending) · a `.wf-mini`
"awaiting approval" line with Refresh/Approve→/Open task/Inspect (workflow `PENDING`) · **"Executed ·
✓ writeback"** (`justActioned`) · or just Inspect. The agent reasoning lives in a separate full-width
`#actionRationale` panel below the queue (the "Agent Inspector"). Auto-poll exists
(`startWorkflowPolling`) but the fallback path skips PENDING entirely → the misleading "Executed".

---

## A: In-cell mini-stepper

| Part | Mechanism | Flag |
|------|-----------|:----:|
| A1 | exec-cell becomes a horizontal mini-stepper (6 segments), plane-colored, current segment pulses | |
| A2 | per-node hover tooltip with label + a go-to-source link | ⚠️ |
| A3 | poll fills nodes; pending node pulses amber with an inline "Approve" link | |

Compact; lives entirely in the cell.

## B: Expand-in-place full-width row drawer

| Part | Mechanism | Flag |
|------|-----------|:----:|
| B1 | exec-cell shows a one-line live status ("● awaiting approval · 3/5") + a **Track ▸** toggle | |
| B2 | toggling opens a full-table-width drawer `<tr>` with the horizontal animated timeline (shared model), labels, plane colors, per-step go-to-source | |
| B3 | the "Databricks agent" step embeds the agent reasoning (reuse `inspectAction` transcript), so the inspector merges into the drawer | |
| B4 | poll animates the drawer; pending step shows Approve/Reject (reuse `completeApproval`) + Open task | |
| B5 | auto-expands the row you just executed; others stay collapsed | |

Rich + contextual to each row; timeline is embedded in the table flow.

## C: Dedicated "Action Journey" showpiece panel

| Part | Mechanism | Flag |
|------|-----------|:----:|
| C1 | repurpose the existing full-width `#actionRationale` region into an **Action Journey** panel below the queue | |
| C2 | exec-cell becomes a compact status chip ("● awaiting approval ▸") that focuses that action's journey in the panel; the just-executed action auto-focuses | |
| C3 | panel renders the big horizontal, multi-colored, **animated** timeline (shared model) with generous labels + per-step go-to-source | |
| C4 | the agent inspector folds into the panel as the expandable "Databricks agent reasoned" step (one panel = journey + reasoning) | |
| C5 | poll drives the panel; pending step shows Approve/Reject inline + Open task; on approval the whole timeline completes (filled/green), writeback lights, Protected Revenue bumps | |

One beautiful focal canvas; absorbs the separate inspector; ideal for a narrated booth demo.

---

## Fit Check

| Req | Requirement | Status | A | B | C |
|-----|-------------|--------|---|---|---|
| R0 | Animated multi-step timeline replacing the terminal cell | Core goal | ✅ | ✅ | ✅ |
| R1 | Truthful state (never "Executed" while pending) | Must-have | ✅ | ✅ | ✅ |
| R2 | Cross-platform & multi-colored steps | Must-have | ✅ | ✅ | ✅ |
| R3 | Unmistakable next action (in-app Approve while pending) | Must-have | ❌ | ✅ | ✅ |
| R4 | Animated & self-advancing via existing poll | Must-have | ✅ | ✅ | ✅ |
| R5 | Go to source on every step | Must-have | ❌ | ✅ | ✅ |
| R6 | Beautiful use of the full-width real estate | Must-have | ❌ | ✅ | ✅ |
| R7 | Reuse live plumbing, no CE release | Must-have | ✅ | ✅ | ✅ |
| R8 | Booth showpiece focus (one focal timeline + reasoning) | Must-have | ❌ | ❌ | ✅ |

**Notes**
- **A fails R3/R5/R6:** the cell is too cramped for a clear Approve CTA, per-step source links (only via fiddly tooltips — flagged), and it doesn't use the new full width.
- **B fails R8:** a per-row drawer is rich, but it's embedded in table chrome, several can open at once, and the agent reasoning is nested inside a row — it isn't the single, narratable focal timeline a booth wants.
- **C passes all:** one dedicated full-width canvas that absorbs the existing inspector, auto-focuses the action you just executed, and reads as the showpiece — while the row keeps a clean live status chip (the good part of A).

---

## Recommendation

**Shape C — Dedicated "Action Journey" showpiece panel** (with the A-style compact status chip kept
in the row as the pointer). It satisfies every requirement, reuses the full-width `#actionRationale`
slot we already have (folding the agent inspector into the timeline so we don't add another panel),
and gives the booth one gorgeous animated timeline to narrate — Domo workflow + agent on the left of
the story, Databricks agent + Genie + Unity Catalog on the right, the pending approval pulsing in the
middle, and a satisfying full-green completion on approval.

**One companion fix (required for R1 regardless of shape):** make `executeAction` prefer and hold the
live **PENDING** state instead of silently falling to "Executed", so the timeline can show the real
approval wait. The local fallback stays only for non-live/preview contexts and is clearly labeled.

---

## Decision (2026-06-11) — BUILT

User picked **Shape C** + the **state-machine fix** (both via fit-check pick). Implemented (UI-only,
no CE/workflow change):

- **Action Journey panel** (`renderJourney`) renders into the full-width `#actionRationale` slot below
  the Agent Action Queue: a 6-step horizontal, multi-colored, animated timeline
  (`rec → workflow → agent⇄agent → awaiting approval → approved/rejected → writeback`) with
  plane-accented dots (Databricks red, Domo blue, Agent violet, Human amber, Unity Catalog green),
  completed connectors, a pulsing active step, ✓/✕ badges, and per-step go-to-source links. The
  Databricks agent's reasoning folds into step 3 (the old inspector is absorbed).
- **Row exec-cell → compact status chip** ("● Awaiting approval · listening · Track ▸" / "✓ Journey
  complete · Track ▸" / "✕ Rejected · Track ▸") that focuses the journey; the just-executed action
  auto-focuses; **Approve & execute** button stays for not-yet-started rows.
- **State fix:** in a live runtime, `executeAction` holds the real **PENDING** state (never the false
  "Executed"); the decision arrives via the existing poll **or** the Approvals tab
  (`completeApproval` now resolves the matching journey via `resolveJourneyDecision`). The optimistic
  local approve→execute path is reserved for non-live preview and labeled "(local)".
- Instance ids persist (`_journeyInstanceIds`) so "Workflow run ↗" keeps working on a completed
  journey. `node --check` clean, lints clean, dist synced.

### Follow-up fix (2026-06-11) — stale-decision guard

UAT found the journey flipping to "approved" while the Domo task was still OPEN. `getRetentionWorkflowResult`
resolves a decision by `action_id` alone, and `agent_action_writeback` accumulates an Approved row **per
run** — so re-running an action that was approved in an earlier test returned a stale decision. Fix
(client-side, no CE release): record `run.startedAt` and accept a decision via `decisionIsCurrent()` only
when the decision row's `decidedTs` is newer than the run start (60s skew) **or** the live workflow
instance status (queried by `instanceId`) is terminal; ambiguous → keep listening. Optional permanent CE
hardening: filter `getRetentionWorkflowResult` by `workflow_instance_id` (requires a release).

### Live / API-driven progression (2026-06-11) — BUILT (user picked B + C)

**Spike — Domo workflow instance API (probed live):** `GET /workflow/v1/instances?modelId=…&limit=N` and
`GET /workflow/v1/instances/{id}` return only a coarse `status` (`IN_PROGRESS` vs terminal) — **no
per-node / current-task / history** (`/history`, `/nodes`, `/executions` all 404). The real progress
signal is the **Task Center**: `GET /queues/v1/{queueId}/tasks` returns tasks carrying
`sourceInfo.instanceId` (+ `flowNodeId`, `modelVersion`), which matches the instance `id` returned by
`startRetentionWorkflow`.

**Build:**
- Released **`pattern4ce` v1.0.19** — `listApprovalTasks` now returns each task's `instanceId` /
  `flowNodeId` / `modelVersion` (no signature/manifest change, so no re-instantiation expected).
- New client `startJourneyProgress(actionId)` polls the live instance result + Task Center every 4s and
  advances the timeline from genuine signals: instance running with no matching task → **agents reasoning**
  (stage 1); an **OPEN task matched to THIS instance** → **awaiting approval** (stage 2); a current
  `writeActionStatus` decision row (stale-guarded) → approved/rejected. Task→run match is precise by
  `instanceId`, with a newest-OPEN-after-start heuristic fallback for older CE contexts.
- The app also fires the real `askRetentionAgent` on execute so the "Show reasoning" transcript is genuine
  (option C). Preview (no Domo runtime) keeps the timed cascade + local auto-complete.
- Net: steps 2→3→4 are now driven by the real workflow instance + Task Center state, not sleep timers;
  steps 5→6 (decision + writeback) were already event-driven.

### Polish round (2026-06-11) — DONE

- **Connector-through-circles — FIXED.** Dots now use an opaque base fill
  (`background-color: surface` + a `linear-gradient(--aj-tint)` wash layer), so the connector line behind
  them no longer shows through the disc. Standard stepper look (continuous line, opaque dots on top).
- **Agent ⇄ Agent marker** — tried the combined **Databricks + Domo** logo (`public/dbx-domo-logo.png`)
  but the dark rounded-square asset reads as a "sticker" inside a light disc → **reverted to the clean
  robot glyph** as an interim. The proper dual-brand mark (transparent, disc-friendly) is deferred to the
  branded-iconography shaping exercise.
- **"Working" animation** on the reasoning step: while stage 1 is active, the sub-line rotates
  Claude-style phrases (`REASON_PHRASES`) every 2.5s with a live **elapsed-seconds** counter and pulsing
  dots (`startReasonTicker`). Phrases reflect what the agent is genuinely doing (Genie query, risk scoring,
  incident weighting, synthesis). The elapsed time is real; the phrases are evocative verbiage (the
  listener only exposes coarse instance status, so there's no per-token stream to surface).
- **Blood-red recolor:** the timeline's Databricks/Unity-Catalog accents, the Action-Journey bot icon, the
  "Databricks agent · Genie-grounded" badge, and the reasoning loader dots now use the AI-Readiness
  `--uc` (#b8443c) blood red instead of the bright `--dbx-red`.
