---
shaping: true
---

# Genie Chat — Innovative UI Capabilities (Shaping)

Working document for shaping the next-generation Genie chat experience inside the
Pattern 4 Agent Portal. Ground truth for requirements (R), shapes, parts, and fit checks.

---

## Frame

### Source (verbatim)

> for the chat window, lets add some really innovative UI capabilities. the ability
> to "pop out" maybe? resize? change colors? change model? show api call detail?
> add a "go to the genie agent in databricks" option/link? emphasize the genie
> branding! etc.? use your shaping skill to capture the requirements and tease apart
> the key parts of the solution that i have specified here.

### Problem

Today the Genie panel is a static **preview**: suggested chips, an input, and canned
answers, with a Databricks-Genie header. It does not call Genie live, can't expand or
be personalized, exposes no transparency into the call, and offers no path into the
real Genie agent in Databricks. It reads as a mockup, not a flagship governed copilot.

### Outcome

An unmistakably **Databricks Genie** chat embedded in the governed Domo portal that
feels like a premium product: it can expand/resize, be personalized, show its work
(model + API + SQL), let power users jump to the real Genie agent in Databricks, and
answer live — all while honoring persona scope and Unity Catalog governance.

---

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| **R0** | Flagship, innovative, unmistakably **Databricks Genie** chat embedded in the governed Domo portal | Core goal |
| **R1** | **Window & layout control** | — |
| R1.1 | User can "pop out" the chat into a larger, focused surface | Must-have |
| R1.2 | User can resize the chat | Must-have |
| R1.3 | User can dock/restore back into the dashboard | Must-have |
| **R2** | **Personalization** | — |
| R2.1 | User can switch the chat color theme/accent | Nice-to-have |
| R2.2 | User can adjust density / text size | Nice-to-have |
| **R3** | **Model control** | — |
| R3.1 | User can choose the model/endpoint that answers | Undecided (feasibility) |
| R3.2 | Chat shows which model answered (attribution) | Nice-to-have |
| **R4** | **Transparency / API inspector** | — |
| R4.1 | Show the underlying API call detail (endpoint, request, response) | Must-have |
| R4.2 | Show generated SQL, governed source, and latency | Must-have |
| R4.3 | Guard what detail is shown (redaction / permission) | Must-have |
| **R5** | **Genie integration** | — |
| R5.1 | "Open this Genie agent in Databricks" deep link | Must-have |
| R5.2 | Live answers from the Genie Conversation API (replace preview) | Undecided (now vs later) |
| R5.3 | Secure token handling — backend proxy, no secrets in the browser | Must-have (if live) |
| **R6** | **Branding** | — |
| R6.1 | Emphasize Genie identity (logo, name, motif, micro-interactions) | Must-have |
| R6.2 | Stay within Domo styleguide — Genie accent never overpowers Domo Blue | Must-have |
| **R7** | **Governance & trust** | — |
| R7.1 | Answers honor persona scope (UC row filters / Domo PDP) | Must-have |
| R7.2 | Calls governed via Unity AI Gateway / OBO and audited | Leaning yes |

---

## CURRENT: Static preview panel

| Part | Mechanism | Flag |
|------|-----------|:----:|
| CUR1 | Inline chat card in the pro-code app (thread + chips + input) | |
| CUR2 | Canned, keyword-matched preview answers (no live call) | |
| CUR3 | Genie header: real Databricks mark + red top accent | |
| CUR4 | No pop-out, resize, theme, model, inspector, or deep link | |

---

## Shape options

The mutually-exclusive choice is **where the rich chat lives and who answers it**.
All three shapes share a cross-cutting component **K: Answer Source** (below).

### A: Enhanced in-place panel

Everything stays inside the existing pro-code card; "pop out" is an overlay that
maximizes within the card's iframe.

| Part | Mechanism | Flag |
|------|-----------|:----:|
| A1 | Maximize overlay (CSS fixed within the card iframe viewport) | ⚠️ |
| A2 | Drag-handle resize within the iframe bounds | ⚠️ |
| A3 | Theme switcher (Genie / Domo / dark accents) — client-side | |
| A4 | Model selector dropdown → passes model to **K** | ⚠️ |
| A5 | API inspector drawer (endpoint, request, response, SQL, latency) → from **K** | ⚠️ |
| A6 | "Open in Databricks" deep link to the Genie Space | ⚠️ |
| A7 | Amplified Genie branding (lockup, animated spark, typing shimmer) | |
| A8 | Answer source = **K** | ⚠️ |

> Constraint: an App Studio pro-code card renders in an iframe, so "pop out" cannot
> exceed the card's frame. True full-screen requires Shape B or C.

### B: Dedicated full-page Genie Workspace

"Pop out" navigates to a dedicated full-page Genie view (a second App Studio page or
a `fullpage` pro-code app) with a multi-pane workspace.

| Part | Mechanism | Flag |
|------|-----------|:----:|
| B1 | Compact panel on the dashboard + "Expand" → `domo.navigate` to the Genie Workspace page | |
| B2 | Full-page layout: conversation + side panels (model, inspector, history) | |
| B3 | Theme switcher (A3) | |
| B4 | Model selector → **K** | ⚠️ |
| B5 | API inspector panel → **K** | ⚠️ |
| B6 | "Open in Databricks" deep link (A6) | ⚠️ |
| B7 | Amplified Genie branding (A7) | |
| B8 | Answer source = **K** | ⚠️ |

> "Pop out" here = navigation to a bigger surface, not a floating window.

### C: Hybrid — enhanced panel + native Genie pop-out

Keep an enhanced in-place panel for quick questions; "pop out" opens the **real
Databricks Genie** (native iframe in a Domo modal/page, or new tab via deep link),
which already provides model selection, its own API/SQL transparency, and the agent.

| Part | Mechanism | Flag |
|------|-----------|:----:|
| C1 | Enhanced in-place panel (A3 theme, A7 branding, quick Q&A via **K**) | ⚠️ |
| C2 | "Pop out" → native Genie: iframe in a full-width Domo modal/page **or** new-tab deep link | ⚠️ |
| C3 | Model choice + deep API/SQL transparency delegated to native Genie when popped out | |
| C4 | In-place API inspector (lightweight) for the quick-Q&A path → from **K** | ⚠️ |
| C5 | "Open in Databricks" deep link (A6) — same target as C2 new-tab | ⚠️ |
| C6 | Answer source for in-place = **K**; popped-out = native Genie | ⚠️ |

---

## K: Answer Source (cross-cutting component)

Resolves most ⚠️ flags. Pick one (can stage K-A → K-B over time).

| Alt | Mechanism | Flag |
|-----|-----------|:----:|
| K-A | Preview stub (current canned answers) | |
| K-B | Genie **Conversation API** via a secured backend proxy (Domo Code Engine / Workflow holds the token; OBO + audit) | ⚠️ |
| K-C | Native Databricks **Genie iframe** embed (no Domo-side answer plumbing) | ⚠️ |
| K-D | Browser → Genie Conversation API directly | ❌ (would expose a token in the client — rejected) |

### K fit check

| Req | Requirement | Status | K-A | K-B | K-C |
|-----|-------------|--------|-----|-----|-----|
| R5.2 | Live answers from the Genie Conversation API | Undecided | ❌ | ✅ | ✅ |
| R5.3 | Secure token handling (no secrets in browser) | Must-have | ✅ | ✅ | ✅ |
| R4.1 | Show API call detail (endpoint/request/response) | Must-have | ❌ | ✅ | ✅ |
| R4.2 | Show generated SQL + source + latency | Must-have | ❌ | ✅ | ✅ |
| R3.1 | Choose the model/endpoint that answers | Undecided | ❌ | ❌ | ✅ |
| R7.1 | Answers honor persona scope (UC/PDP) | Must-have | ❌ | ✅ | ✅ |

**Notes:**
- K-A fails everything live — it's a mock; fine only as a staging fallback.
- K-B is the governed Domo-native path; it surfaces real API/SQL detail because the proxy returns it. Model choice is **not** natively exposed by the Genie Conversation API → R3.1 stays ❌ for K-B (see Open Questions).
- K-C inherits model selection + transparency from native Genie, but the chat lives in Databricks' UI (less Domo theming control, subject to the ~20 q/min iframe limit).
- K-D rejected: a PAT/OAuth token can never live in the browser.

---

## Fit Check (R × shapes)

Flags fail the check (⚠️ = we don't yet know how → ❌). This reflects the **current**
state before K is decided; choosing K-B or K-C resolves most rows.

| Req | Requirement | Status | A | B | C |
|-----|-------------|--------|---|---|---|
| R0 | Flagship, unmistakably-Genie governed chat | Core goal | ✅ | ✅ | ✅ |
| R1.1 | Pop out to a larger focused surface | Must-have | ❌ | ✅ | ✅ |
| R1.2 | Resize the chat | Must-have | ❌ | ✅ | ✅ |
| R1.3 | Dock / restore | Must-have | ✅ | ✅ | ✅ |
| R2.1 | Switch color theme/accent | Nice-to-have | ✅ | ✅ | ✅ |
| R2.2 | Adjust density / text size | Nice-to-have | ✅ | ✅ | ✅ |
| R3.1 | Choose the model/endpoint | Undecided | ❌ | ❌ | ✅ |
| R3.2 | Show which model answered | Nice-to-have | ❌ | ❌ | ✅ |
| R4.1 | Show API call detail | Must-have | ❌ | ❌ | ❌ |
| R4.2 | Show SQL + source + latency | Must-have | ❌ | ❌ | ❌ |
| R4.3 | Guard what detail is shown | Must-have | ❌ | ❌ | ❌ |
| R5.1 | "Open in Databricks" deep link | Must-have | ❌ | ❌ | ❌ |
| R5.2 | Live Conversation API answers | Undecided | ❌ | ❌ | ❌ |
| R5.3 | Secure token handling | Must-have | ✅ | ✅ | ✅ |
| R6.1 | Emphasize Genie identity | Must-have | ✅ | ✅ | ✅ |
| R6.2 | Stay within Domo styleguide | Must-have | ✅ | ✅ | ✅ |
| R7.1 | Honor persona scope | Must-have | ❌ | ❌ | ❌ |
| R7.2 | Governed via Unity AI Gateway / OBO | Leaning yes | ❌ | ❌ | ❌ |

**Notes:**
- A fails R1.1/R1.2: an iframe card can't expand beyond its frame.
- R4.x, R5.1, R5.2, R7.x are ❌ for **all** shapes today because they depend on **K** (answer source) and a confirmed Genie Space / workspace deep-link target. Decide K → re-run and most flip to ✅.
- R3.1 is only ✅ where native Genie is in play (Shape C, or K-C) — the Conversation API does not expose model choice.

---

## Open Questions (need your call)

| # | Question | Why it matters |
|---|----------|----------------|
| Q1 | Go **live** now (K-B/K-C) or keep preview (K-A) for this iteration? | Gates R5.2 and all transparency rows. |
| Q2 | Which **Genie Space** is the agent? Confirm space id + workspace host for the deep link and Conversation API. | Required for R5.1/R5.2. We can create a dedicated "Pattern 4" space. |
| Q3 | What does **"change model"** mean to you — (a) pick a Databricks **Model Serving** endpoint for a direct chat, (b) switch between Genie vs a model endpoint, or (c) it's really native-Genie behavior? | Genie's Conversation API doesn't expose model choice; this decides whether R3.1 needs native Genie (Shape C / K-C) or a separate serving-endpoint chat. |
| Q4 | Is it OK to **surface API request/response + SQL** to business users, or gate the inspector behind a role/persona (e.g., admin only)? | Drives R4.3 redaction/permission. |
| Q5 | Preferred **pop-out** behavior: in-card maximize (A), dedicated full page (B), or native Genie (C)? | Selects the shape. |
| Q6 | Can we stand up a **Code Engine / Workflow proxy** to hold the token and call the Conversation API (OBO)? | Required for K-B and R5.3/R7.2. |

---

## Recommendation (pre-decision)

- **Shape C (Hybrid)** best satisfies the spec as written: the in-place panel stays
  Domo-themed and fast, while "pop out" opens the **real** Genie — which already
  delivers model selection (Q3), deep API/SQL transparency, and *is* the agent (R5.1).
- **K = stage K-A → K-B**: ship the enhanced UI now (theme, resize/expand, branding,
  inspector shell, deep link) on the preview source, then swap in the governed
  Conversation API proxy to make answers + inspector real.
- **Spike** recommended before committing K-B: confirm Conversation API request/response
  shape, the deep-link URL format, and whether any model selection is exposed.

---

## Decision & Build Status (2026-06-09)

🟡 **Decided:** Selected **Shape C (Hybrid)** with **staged K (K-A preview now → K-B live next)**, per "get it fully built."

Shipped in this pass (preview source, K-A):

| Req | Shipped now | Notes |
|-----|:-----------:|-------|
| R1.1 Pop out | ✅ | Full-overlay pop-out + backdrop + Escape (covers the card/iframe viewport); native "Open in Databricks" is the external pop-out. |
| R1.2 Resize | ✅ | Drag handle adjusts the chat thread height (140–520px). |
| R1.3 Dock/restore | ✅ | Collapse back from pop-out. |
| R2.1 Theme/accent | ✅ | Cycles Databricks-red → Domo-blue → slate (default stays subtle). |
| R4.1 API detail | ✅ (preview) | Inspector shows endpoint + request JSON; flagged "Preview". |
| R4.2 SQL + latency | ✅ (preview) | Generated SQL, latency, row count per answer. |
| R4.3 Guard detail | ⏳ | Currently shown to all; gate to a role/persona when live (Q4). |
| R5.1 Open in Databricks | ✅ | Deep link to `WORKSPACE_HOST/genie`; swap to `genie/rooms/<space_id>` once a dedicated space exists. |
| R5.2 Live answers | ⏳ | Still preview — needs K-B (Conversation API proxy). |
| R6.1 Genie branding | ✅ | Amplified lockup, pulsing spark, "Answered by …" attribution. |
| R6.2 Styleguide | ✅ | Domo Blue stays dominant; Genie accent is restrained. |
| R3.1 Change model | ✅ (UI) | Selector + attribution present; real routing needs native Genie / serving endpoint (Q3). |
| R7.1 / R7.2 Governance | ⏳ | Labeled in inspector ("Governed by Unity Catalog + Unity AI Gateway (OBO)"); enforced when K-B lands. |

## Next actions (live wiring — K-B)

1. **Spike** (`spike-genie-conversation-api.md`): confirm the Conversation API request/response shape, the deep-link URL format, and whether model selection is exposed.
2. ✅ Created a dedicated **Pattern 4 Genie Space** over the gold views: `01f1642295b61d6b8849e106f52fc781`; `GENIE_SPACE_ID` is now set in `app.js` so the deep link + inspector target it.
3. Stand up the **Code Engine / Workflow proxy** (holds the token, OBO) and swap `answerFor()` from canned → live; render real SQL/latency in the inspector.
4. Decide **Q3** (model meaning) and **Q4** (who can see API detail).
