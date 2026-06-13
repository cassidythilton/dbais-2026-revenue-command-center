---
shaping: true
---

# Pattern 4 — Technical Architecture Diagram (How It Works sub-tab) — Shaping

## Source (verbatim)

> see how it works tab->solution architecture diagram. at current the diagram is great for executive
> level or business user. I would also like to add a secondary diagram (build a sub-tab in on the how
> it works page) that is more of an actual technical architectural diagram that shows
> relationships/intergrations/data flow/etc. it should be detailed and cater to a more technical
> audience, but maintain the same look and feel as the current Solution Architecture diagram (it's very
> well done in terms of information and UI&UX). reference the current apps code base to understand all
> the veraious components as well as the current architecture diagram. then use your shaping skill to
> capture the requirements and tease apart the key parts of the solution that i have specified here.
> reference https://github.com/plannotator/effective-html during shaping and for implementation as i
> like this approach as a reference point.

## Problem

The **How It Works → Solution Architecture** diagram is excellent for executives/business users: three
plane lanes (Databricks · Interop & Governance · Domo) of clickable capability cards with a detail
panel (lead + bullets + Input/Output/Governed by), brand markers, and the Domo/Databricks palette. But
it deliberately **abstracts away the technical wiring** — it does not show the actual components,
**integration edges, protocols, or data-flow sequences** a technical audience (SE, architect, data/ML
engineer) needs to evaluate the solution.

## Outcome

A **second, sibling diagram** ("Technical Architecture") reachable from a **sub-tab on How It Works**
that renders the **real deployed components**, the **integrations/relationships between them with their
protocols/contracts**, and the **end-to-end data-flow sequences** — detailed and technical, but
visually a twin of the current diagram (same palette, brand markers, plane colors, detail-panel chrome,
typography). Inspired by the `effective-html` approach: an **SVG-first, low-prose canvas** with
**clickable nodes** and **flow chips that light up and animate request paths**.

## Reference: `effective-html` (cited per the request)

[plannotator/effective-html](https://github.com/plannotator/effective-html) — `html-diagram` skill.
Key principles adopted here:

- **SVG-first, low-prose**: the canvas is the artifact; detail appears on demand, not as walls of text.
- **High-quality, hand-built SVG** topology — iterate on the diagram itself more than anything.
- **Interactive + animated sequences**: "clickable nodes, flow chips that light up and animate request
  paths" maps directly to this demo's real flows (federation read, Ask Genie, Score account, Agent⇄Agent
  + approval writeback, Lakebase state, AI Readiness sync).
- **Theme-aware via CSS variables** (the skill defaults to dark mode w/ toggle) — captured as an open
  decision (R8) since this portal is otherwise a light, embedded Domo theme.

---

## Component inventory (CURRENT system — teased apart from the codebase)

The technical diagram's nodes. Every one is a real, deployed element (verified in
`manifest.json`, `src/app.js`, and the project env/IDs).

### Databricks plane — governed intelligence
| Node | What it is | ID / detail |
|------|-----------|-------------|
| Unity Catalog | Governance · lineage · ABAC · source of truth | `databricks_raptor.pattern4_agent_automation` |
| Delta gold views (6) | revenue health · renewal risk · incident impact · forecast TS · agent action queue · portal user scope | + `agent_action_writeback` Delta table |
| SQL Warehouse | Query engine for federation **and** Genie | `ea829ba58bcae093` |
| Genie Space | NL → governed SQL over the gold views | `01f1642295b61d6b8849e106f52fc781` |
| Model Serving | Renewal-risk **regressor v6** (MLflow/UC-registered) | endpoint `pattern4-renewal-risk` |
| Agent Bricks Supervisor (MAS) | Genie-grounded retention agent | `mas-77bd204b-endpoint` |
| Unity AI Gateway | usage · rate limits · guardrails · inference tables | on `pattern4-renewal-risk` + `pattern4-reasoning-gateway` |
| Lakebase (Postgres OLTP) | `p4_scenario_runs` · `p4_prediction_feedback` | project `cobra-v1` (prod/primary), SP `lakebase-demo-sp` |
| MLflow traces | agent/model observability | linked from the Agent Action Queue |

### Interop & governance plane — the integration boundary
| Node | What it is | ID / detail |
|------|-----------|-------------|
| Cloud Amplifier | Live federation, **no copy** (~15-min metadata poll) | integration `Databricks Raptor AWS` `a83b5bbc…` |
| Code Engine bridge (`pattern4ce`) | Server-side token boundary; **20 functions** (MCP-aligned) | proxyId `pattern4ce`, pkg `36a18258…`, v1.0.12 bound |
| Unity AI Gateway | Governs model + LLM tool calls (straddles the boundary) | (same endpoints as above) |
| Shared identity | SSO · OAuth U2M · OBO (documented) | Domo identity today; per-user OBO is the documented next step |

### Domo plane — activation & action
| Node | What it is | ID / detail |
|------|-----------|-------------|
| Pro-code App (App Studio) | The command center experience | app `105910661` / view `1913185115`, design `e8a0b5da…` |
| Federated DataSets (5) | alias-mapped gold views | `executiveRevenueHealth · customerRenewalRisk · incidentRevenueImpact · agentActionQueue · portalUserScope` |
| Domo Workflow + approval queue | Renewal Risk Retention v1.0.3 · sign-off → writeback | model `6cbd5ecb…`, queue `55c37364…`, Task Center |
| Agent Catalyst tile | Domo AI Agent that calls the Databricks MAS (agent ⇄ agent) | → `askRetentionAgent` |
| Approvals · Action Center | In-app approve/reject completes the Domo task | `listApprovalTasks` / `completeApprovalTask` |
| ML Predictions / AI Readiness / Domo PDP | scoring · UC→Domo readiness sync · per-persona scope | PDP ↔ UC row filters |

### `pattern4ce` functions (the integration contracts — 20)
`askGenie` · `askRetentionAgent` · `askReasoningModel` · `runModelInference` ·
`startRetentionWorkflow` · `getRetentionWorkflowResult` · `listApprovalTasks` · `completeApprovalTask` ·
`writeActionStatus` · `listScenarios` · `createScenario` · `updateScenario` · `deleteScenario` ·
`listPredictionFeedback` · `savePredictionFeedback` · `getUcReadinessState` · `getDomoAiReadiness` ·
`syncDomoAiReadiness` · `wipeDomoAiReadiness` · `updateUcColumnContext`

### Integration edges (relationships + protocol — what the new diagram must draw)
| From → To | Protocol / contract |
|-----------|---------------------|
| App → Federated DataSets | Domo Query API (read by alias) |
| Federated DataSets → Cloud Amplifier → SQL Warehouse → UC gold | **Live federation (no copy)**, ~15-min metadata poll |
| App → Code Engine | `domo.post` via `proxyId pattern4ce` (server-side token boundary) |
| CE `askGenie` → Genie → Warehouse → UC | Genie **Conversation API** → SQL → rows |
| CE `runModelInference` → AI Gateway → Model Serving v6 | REST invocations (token server-side) |
| CE `askReasoningModel` → `pattern4-reasoning-gateway` | Guardrailed LLM (input safety+PII block / output mask) |
| CE `askRetentionAgent` → MAS → Genie → UC | Agent `responses` API (agent ⇄ agent) |
| CE `startRetentionWorkflow` → Domo Workflow | `POST /workflow/v1/instances/message` (dev token) |
| Domo Workflow → Agent Catalyst → CE `askRetentionAgent` → MAS | in-workflow agent tile (agent ⇄ agent) |
| Domo Workflow → approval task; CE `list/completeApprovalTask` | **Task Center API** (`/queues/v1/...`) |
| CE `writeActionStatus` → UC `agent_action_writeback` | Delta `INSERT … SELECT` |
| CE scenario/feedback fns → Lakebase | `node-postgres` over **M2M service principal** |
| CE readiness fns → UC metadata / Domo AI Readiness | UC comments/tags (read+write) ↔ Domo AI Readiness API |
| model/agent/LLM calls → MLflow traces + AI Gateway inference tables | observability/audit |

### End-to-end flows (the selectable, animated sequences)
| # | Flow | Path |
|---|------|------|
| F1 | **Live federated read** | App → DataSet alias → Cloud Amplifier → Warehouse → UC gold → back *(no copy)* |
| F2 | **Ask Genie (NL→SQL)** | App → CE `askGenie` → Genie → Warehouse → UC → answer + SQL + rows → chart |
| F3 | **Score an account (ML)** | App → CE `runModelInference` → AI Gateway → Model Serving v6 → prob → App → feedback → Lakebase |
| F4 | **Agent ⇄ Agent + approval writeback** *(showpiece)* | App *Approve&execute* → CE `startRetentionWorkflow` → Domo Workflow → Agent Catalyst → CE `askRetentionAgent` → MAS → Genie/UC → recommendation → human approval (Task Center) → CE `writeActionStatus` → UC `agent_action_writeback` |
| F5 | **Lakebase operational state** | App → CE scenario/feedback fns → node-postgres (SP) → Lakebase Postgres |
| F6 | **AI Readiness sync** | UC metadata (source of truth) → CE `getUcReadinessState` → App → sync → CE `syncDomoAiReadiness` → Domo AI Readiness |

### Governance boundaries (must be legible)
Unity Catalog (gold + model + Genie) · Unity AI Gateway (model + LLM) · **Code Engine server-side token
boundary** (no Databricks token in the browser) · Domo PDP ↔ UC row filters · **human approval gate**.

---

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | Add a **second "Technical Architecture" diagram** on a **How It Works sub-tab** that shows the real components, their integrations/relationships, and data flow — **without replacing** the existing executive Solution Architecture diagram. | Core goal |
| R1 | **Same look & feel** — reuse the existing palette (Domo blue / Databricks red / interop violet), plane coloring, brand markers/iconography, card + detail-panel chrome, and typography so it reads as a sibling of the current diagram. | Must-have |
| R2 | **Real components & contracts** — every node is an actual deployed element (5 datasets, 20 `pattern4ce` fns, Genie, Model Serving v6, MAS, AI Gateway, Lakebase, Workflow+queue, Cloud Amplifier, UC gold, MLflow); edges carry the real protocol/contract. | Must-have |
| R3 | **Explicit relationships & data flow** — directional connectors/edges between components (not just a card grid), so a technical viewer can trace request/response paths and dependencies. | Must-have |
| R4 | **Selectable, animated flow sequences** — the key end-to-end paths (F1–F6) can be highlighted/animated one at a time (effective-html "flow chips that light up request paths"). | Must-have |
| R5 | **Detail on demand, low-prose canvas** — clicking a node (or edge) reveals technical detail (what · contract/signature · governance · I/O) reusing the existing detail-panel pattern; the canvas itself stays diagram-first. | Must-have |
| R6 | **Governance boundaries legible** — the diagram makes the trust boundaries obvious (UC, AI Gateway, CE server-side token boundary, Domo PDP, human approval gate). | Must-have |
| R7 | **Embedded-portal safe + validated** — renders correctly in the App Studio iframe (auto-size, no horizontal scroll), responsive/degrades on narrow widths, no blocked APIs, build-validated (node --check, headless render); dist mirrors src; **no CE release**. | Must-have |
| R8 | **Theme treatment** — effective-html defaults to a dark "blueprint" canvas; decide dark stage vs. light-for-cohesion (portal is otherwise light + embedded). | Undecided (leaning light) |

---

## CURRENT — Executive Solution Architecture (baseline)

3 plane lanes (`ARCH_PLANES`: dbx / interop / domo) of clickable `.ac-card`s → `#archDetail` panel
(lead + bullets + I/O/Governed-by, reusing `FLOW_STAGES`), a context strip, a "Sources & ingestion"
strip, a build-requirements row, and a "View Unity Catalog lineage →" deep link. **No edges, no
protocols, no flow sequences** — capabilities are implied by lane membership, not drawn relationships.

---

## A: Enrich-in-place (edge overlay on the existing card grid)

| Part | Mechanism | Flag |
|------|-----------|:----:|
| A1 | New sub-tab that **re-renders the same 3-column card grid**, then overlays an SVG layer drawing edges between cards + a flow-chip selector | |
| A2 | Edges computed from the existing card DOM rects | ⚠️ |
| A3 | Reuse `#archDetail` for node detail; add protocol labels to cards | |

Cheapest reuse, but the card grid's vertical-stack columns give **poor geometry for clean cross-lane
edges** and unreadable animated sequences.

## B: Effective-html full SVG stage (clean-slate topology)

| Part | Mechanism | Flag |
|------|-----------|:----:|
| B1 | New sub-tab = a **dedicated full-width SVG canvas** with hand-placed component nodes positioned for clean topology | |
| B2 | Labeled directional edges (protocols) drawn as SVG paths between node anchors | ⚠️ |
| B3 | Flow-chip selector animates request paths (dim non-participants, pulse along the path) | |
| B4 | Click node/edge → detail panel (reusing the existing detail chrome); palette + brand markers reused | |
| B5 | Responsive: re-layout / pan on narrow widths | ⚠️ |

Purest effective-html diagram + best free-form topology; departs **most** from the current diagram's
literal lane structure (continuity carried by shared design tokens, not shared layout).

## C: Lane-structured SVG (hybrid — keep the lanes, add the wiring)

| Part | Mechanism | Flag |
|------|-----------|:----:|
| C1 | **How It Works sub-tab nav** added to `viewGuide`: *Solution Architecture* (current) · *Technical Architecture* (new) · *User Guide* — reusing the existing `.seg`/tab styling | |
| C2 | **Reuse the 3 plane lanes** (dbx/interop/domo headers, colors, brand logos, AGENT⇄AGENT tag) as the spatial skeleton — this is what makes it a visual twin | |
| C3 | **Real component nodes** per lane, styled like `.ac-card` (brand marker + name + sub), positioned for clean topology; data-attrs carry technical metadata | |
| C4 | **SVG edge layer** (absolutely-positioned overlay) draws directional connectors w/ protocol labels between node anchors; cross-lane edges = integrations; recompute on resize | ⚠️ |
| C5 | **Flow selector + animation** — chips for F1–F6; selecting one dims non-participants and animates the path (dash-offset pulse) | |
| C6 | **Detail panel** — click node/edge → reuse `.arch-detail` to show what · contract/signature · governance · I/O; canvas stays low-prose | |
| C7 | **Governance overlay** — legend/toggle marking UC · AI Gateway · CE token boundary · PDP · approval gate | |
| C8 | Responsive + embedded-fit (lanes stack & edges recompute/hide on narrow), no blocked APIs, node --check + headless render, dist mirrors src, no CE release | |

Maximum continuity with the praised current diagram (the lanes **are** the current structure) **plus**
the technical edges/flows. The Interop lane in the middle naturally hosts the Code Engine/MCP bridge +
Cloud Amplifier + AI Gateway + identity — exactly where most integration edges cross.

---

## Fit Check

| Req | Requirement | Status | A | B | C |
|-----|-------------|--------|---|---|---|
| R0 | Second technical diagram on a How It Works sub-tab (doesn't replace current) | Core goal | ✅ | ✅ | ✅ |
| R1 | Same look & feel (palette, plane colors, brand markers, detail-panel chrome, type) | Must-have | ✅ | ✅ | ✅ |
| R2 | Real components & contracts on nodes + edges | Must-have | ✅ | ✅ | ✅ |
| R3 | Explicit relationships & data-flow edges (not just a card grid) | Must-have | ❌ | ✅ | ✅ |
| R4 | Selectable, animated flow sequences (F1–F6) | Must-have | ❌ | ✅ | ✅ |
| R5 | Detail on demand, low-prose canvas | Must-have | ✅ | ✅ | ✅ |
| R6 | Governance boundaries legible | Must-have | ❌ | ✅ | ✅ |
| R7 | Embedded-portal safe + validated, no CE release | Must-have | ✅ | ✅ | ✅ |

**Notes**
- **A fails R3/R4/R6:** the card-grid's stacked columns can't host clean cross-lane edges or readable
  animated sequences, and trust boundaries aren't expressible without real edge geometry.
- **B passes** but carries continuity only through shared design tokens — it discards the lane layout
  the user explicitly praised, so "same look & feel" is weaker in spirit even though it's met.
- **C passes all** and keeps the literal lane structure (strongest "same look & feel") while adding the
  SVG edge + flow layer. R8 (theme) is orthogonal and applies to whichever shape is picked.

---

## Recommendation

**Shape C — Lane-structured SVG (hybrid).** It's the strongest "visual twin" (keeps the exact plane
lanes, palette, brand markers, and detail-panel chrome the user called out as well done) while adding
everything the technical audience needs: **real component nodes, drawn integration edges with
protocols, six selectable animated data-flow sequences, click-to-detail, and visible governance
boundaries** — exactly the effective-html "clickable nodes + flow chips that light up request paths,"
expressed inside the existing design language. **B** stays on the table if you'd rather have a freer,
pure-SVG topology that isn't constrained to three lanes.

**Main unknown to resolve before/while building (C4 / B2):** SVG **edge geometry** — anchoring
connectors to node DOM rects and recomputing on resize inside the auto-sized App Studio iframe. Small
spike during implementation (measure node anchors → draw paths → `ResizeObserver` recompute); flows
(C5) and detail (C6) are well-understood reuse.

## Open decisions (need your call)

1. **Shape:** C (lane-structured hybrid, recommended) vs B (pure SVG stage).
2. **User Guide placement:** make it the 3rd sub-tab (How It Works = Solution Arch · Technical Arch ·
   User Guide), or keep the User Guide always-visible below the diagrams.
3. **Theme (R8):** light canvas for portal cohesion (recommended) vs a dark "blueprint" stage per the
   effective-html default.
4. **Flow scope for v1:** all six flows (F1–F6) now, or start with the showpiece subset
   (F2 Ask Genie · F3 Score · F4 Agent⇄Agent) and add the rest after.

---

## Status

**SHAPING — awaiting decisions (1–4 above).** No build started. When a shape is picked, next step is to
breadboard Shape C's affordances (sub-tab nav, node registry, edge layer, flow registry, detail panel,
governance overlay) and slice it; build is UI-only (no `pattern4ce` release; bindings stay on 1.0.12).
