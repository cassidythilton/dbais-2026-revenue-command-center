# Pattern 4 — Revenue Command Center: Booth Demo Vignettes

Short, SE-led vignettes for a trade-show booth. Each is a **~5-minute** interaction with a
clear backdrop, the **Databricks** components in play (and the **Domo** pieces that deliver
them), a **golden-path** storyline, and a **"go to source"** moment that proves it's real —
not a mockup. Every vignette ties back to the same company story so a visitor can stay for one
or stitch several together.

> **One-line pitch:** *Databricks is the governed intelligence + record plane; Domo is the
> business delivery + action plane. One identity, one governed metric layer — surfaced as an
> executive command center that **predicts**, **explains**, and **acts**.*

---

## The setup (say this once, ~45 seconds)

**Company:** **Tessera Cloud** — a fictional B2B SaaS company (an enterprise data-collaboration
platform). They sell subscriptions to mid-market and enterprise accounts.

**App:** the **Revenue Command Center** — *Built with Databricks, Delivered with Domo* — used by:

| Function | Persona in the app | What they care about |
| --- | --- | --- |
| Revenue Operations / CRO | **Executive Sponsor** | Top-line forecast, protected revenue |
| Regional leadership | **Regional Manager** | Why a region is slipping, which accounts |
| Customer Success / AE | **Account Owner** | Scoring & saving a specific account |
| Support / SRE, Finance, Data Governance | (cross-cutting) | Root cause, audit, governed metadata |

**The backdrop (the through-line for every vignette):** Tessera had a **West-region reliability
incident — `INC-0001`** (workflow-queue saturation after a regional failover). SLA breaches
spiked, product usage dropped, support sentiment soured → **renewal risk climbed for West
enterprise accounts**, putting **~$106M of renewals** in the exposed cohort. The Command Center
**predicts** the exposure on Forecast Home, **explains** the root cause in Genie (the
`gold_incident_revenue_impact` detail — affected accounts, SLA breaches, revenue at risk — surfaces
in Genie's cited answer, with the Insight Rail flagging the `INC-0001` link up front), and drives a
**governed, human-approved retention play** — all on one governed Databricks foundation, with **no
data copied** into Domo.

> **Predict → explain handoff (say it once):** Forecast Home stays deliberately clean — it shows the
> *what* (the West dip, revenue at risk). The *why* — the incident root cause and its full impact —
> is one click away in **Genie (Vignette 2)**, reasoning over the same governed gold views.

**Booth tip:** open full-screen, persona = **Executive Sponsor**. Each vignette below names the
tab to land on and the single "go to source" click that wins the technical credibility moment.

---

## Vignette 1 — "One governed cockpit" (the hook)

- **Tab:** Forecast Home · **~3 min**
- **Backdrop:** Tessera's CRO opens Monday's number and sees a forecast headwind. Where is it,
  and is it real?
- **Databricks (+ Domo):** Six **Unity Catalog gold views** define every metric once; Domo reads
  them **live through Cloud Amplifier** (the `Databricks Raptor AWS` integration) — **zero copy**.
  The Actual-vs-Forecast hero, Regional Renewal Risk, and the Insight Rail are all the same
  governed numbers Genie and the model see — no metric drift.
- **Golden path:** Point at **Revenue at Risk** and the **West hotspot** (51.7 vs ~40 elsewhere).
  The **Insight Rail** says the dip is isolated to West and tied to `INC-0001`. Don't over-explain on
  Home — that's the *what*; the *why* (incident root cause + impact) is the next click, in Genie.
- **Go to source:** On a governed-lineage card, click **Open Databricks table** → the gold view in
  Catalog Explorer. "Domo isn't holding a stale copy — it's querying this, live."
- **Tie-in:** "Let's ask the lakehouse *why* (Vignette 2), then *score* an account (V3) and
  *act* (V5–V6)."

## Vignette 2 — "Ask the lakehouse why" (Genie)

- **Tab:** Genie Workspace · **~4 min**
- **Backdrop:** The West Regional Manager doesn't want a dashboard ticket — she wants an answer.
- **Databricks (+ Domo):** A governed **Genie Space** over the same gold views. Genie generates
  SQL against Unity Catalog metrics; Domo renders the answer + a chart and an **Inspect** panel
  showing the exact governed API call, the generated SQL, latency, and row count.
- **Golden path:** Click the seeded chip *"Why did renewal risk increase for West enterprise
  accounts this month?"* → a cited root cause tied to **`INC-0001`**, with the incident's impact
  pulled from `gold_incident_revenue_impact` (affected accounts, SLA breaches, revenue at risk),
  generated SQL, and a chart built from the returned rows. **This is where the incident root-cause
  detail lives** — Forecast Home shows the dip, Genie explains it. Open **Inspect** to show it's
  governed, on-behalf-of the user.
- **Go to source:** **Open in Databricks** → the live Genie room.
- **Tie-in:** "Same metrics, asked in English. The reason Genie is trustworthy is governed
  metadata — that's Vignette 8 (AI Readiness)."

## Vignette 3 — "Score a specific account" (Model Serving + MLflow)

- **Tab:** ML Predictions · **~4 min**
- **Backdrop:** An Account Owner needs a churn probability for one West enterprise account before
  a renewal call.
- **Databricks (+ Domo):** An **MLflow-registered, Unity Catalog-governed HGB regressor (v6)**
  served on **Databricks Model Serving** (`pattern4-renewal-risk`). Domo scores it **server-side
  via Code Engine** — the token never touches the browser. The **payload panel** shows the exact
  request as **cURL / Python / SQL**; the run-log narrates the call (and the scale-to-zero cold
  start, ~20–30s).
- **Golden path:** Run prediction on the default West account → ~33% churn (Medium). Bump SLA
  breaches and re-run → watch it move. "A data scientist can reproduce this exact governed call."
- **Go to source:** **Registered model →** and **Serving endpoint →** deep links.
- **Tie-in:** "This score feeds the recommendation the agent makes in Vignette 5, and the
  feedback you give it is remembered in Vignette 7 (Lakebase)."

## Vignette 4 — "Governed AI, not the Wild West" (Unity AI Gateway)

- **Tab:** How It Works → Solution Architecture (gateway), with proof in Databricks · **~4 min**
- **Backdrop:** The security/platform buyer asks: "You've got models and an LLM agent calling
  things — how is *that* governed?"
- **Databricks:** **Unity AI Gateway** is live on two surfaces — the renewal-risk **model
  endpoint** (usage tracking, a 120/min rate limit, and an **inference table** logging every
  payload) and a guardrailed **LLM reasoning endpoint** (`pattern4-reasoning-gateway`) with
  **input/output safety + PII guardrails**. Every AI call is rate-limited, audited, and filtered.
- **Golden path:** Explain the two endpoints; note guardrails mask PII and block unsafe content;
  usage + payloads land in governed tables.
- **Go to source:** Query the **inference tables** (`p4_*_inference_*`) / `system.serving` — "here's
  the audit trail of every governed AI call."
- **Tie-in:** "This is the boundary the agent in Vignette 5 calls through. OBO (per-user identity)
  is the documented next step."

## Vignette 5 — "Agent-to-agent" (Domo agent ⇄ Databricks Agent Bricks)

- **Tab:** Forecast Home → Agent Action Queue → **Inspect agent** · **~5 min** (the showpiece)
- **Backdrop:** RevOps wants a recommended retention play for an at-risk account — reasoned over
  governed data, not guessed.
- **Databricks (+ Domo):** **two agents, two jobs — a Domo agent reasoning *with* a Databricks agent.**
  - **What the Databricks agent does:** the **Agent Bricks Multi-Agent Supervisor** (*Pattern 4
    Retention Supervisor*) is the deep-data specialist — it queries the governed gold views **via
    Genie**, weighs the renewal-risk signals, and reasons out the evidence behind a save play.
  - **What the Domo agent does:** the **Domo AI agent inside the governed Domo Workflow** is the
    decision-maker — it decides to consult the Databricks specialist, then reasons over what comes
    back to commit to **one concrete retention action + a one-sentence rationale**, decision-ready
    for the human approver (its actual instruction: *"…return ONE concrete recommended retention
    action plus a one-sentence rationale"*).
- **Golden path:** On a pending action, click **Inspect agent** → watch it reason live (the dots
  pulse: "querying Genie, scoring renewal risk…") → a Genie-grounded recommendation with rationale
  and what-to-watch renders in-app.
- **Show BOTH agents (do this — it's the whole point):**
  1. **The Domo agent — open the Workflow.** From the action row, **Open task ↗** → the Domo
     Workflow *Pattern 4 - Renewal Risk Retention*. Point at the **"Retention triage agent
     (Databricks)"** tile sitting between Start and the human-approval step: "*this* is the Domo
     agent — it decided to consult the Databricks specialist, then handed a decision-ready action
     to the approver." (Its output, `agentRecommendation`, is a workflow variable.)
  2. **The Databricks agent — open the MLflow traces.** Click **Activity log (MLflow) ↗** → the
     `mas-77bd204b` agent's trace list. Open one trace whose **Request** is the at-risk account /
     "why did renewal risk…" prompt and whose **Response** is the `final_response` recommendation:
     "*this* is the Databricks agent's actual reasoning over governed data — the same call the Domo
     agent made, fully traced and auditable."
- **Go to source:** Inspector footer / Approvals: **Open agent ↗** (the Agent Bricks Supervisor),
  **Activity log (MLflow) ↗** (every agent decision is traced), **Open task ↗** (the Domo Workflow
  with the agent tile), **Writeback table ↗**.
- **The line:** *"You're literally watching two agents collaborate across two platforms — the Domo
  agent in the workflow on one screen, the Databricks agent's governed reasoning trace on the
  other — one identity, one governed metric layer."*
- **Tie-in:** "The agent recommends; a human still signs off — that's Vignette 6."

## Vignette 6 — "Human-in-the-loop, written to the lakehouse" (Workflow + writeback)

- **Tab:** Forecast Home → **Approve & execute** → Approvals tab · **~5 min**
- **Backdrop:** Revenue-impacting actions need a human sign-off and a permanent, auditable record.
- **Databricks (+ Domo):** A **live, governed Domo Workflow** (Renewal Risk Retention) routes a
  human-approval task; on approval its service task writes status **back to a Unity Catalog Delta
  table** (`agent_action_writeback`) — same governed lakehouse as the metrics, queryable by Genie.
- **Golden path:** Click **Approve & execute** → a full-width, multi-colored **Action Journey**
  timeline lights up below the queue and traces the action across both platforms:
  *Agent recommended (Databricks)* → *Workflow started (Domo)* → *Domo agent ⇄ Databricks agent
  reasoned* → **Awaiting your approval (pulsing amber)** → *Approved* → *Written back to lakehouse
  (Unity Catalog)*. The row chip honestly reads **"Awaiting approval · listening"** — not "Executed"
  — and auto-advances (no manual refresh). Switch to **Approvals**, click **Approve** → the timeline
  completes to all-green, **Protected Revenue ticks up**, and the writeback step lights.
- **Go to source (on the timeline itself):** every step has its own link — **Open agent ↗**,
  **Workflow run ↗**, **Activity log (MLflow) ↗**, **Open task ↗**, and **Writeback table ↗** (the
  writeback table's Sample Data, showing the Pending + Approved rows for that action).
- **Tie-in:** "Insight → reasoning → human approval → governed record, drawn as one timeline across
  Domo and Databricks. The agent that recommended it was Vignette 5."

## Vignette 7 — "Operational memory" (Lakebase)

- **Tab:** Lakebase Ops · **~3 min**
- **Backdrop:** A CS manager runs what-if scenarios and gives the model feedback — that state must
  be low-latency, transactional, and survive sessions (not a spreadsheet).
- **Databricks (+ Domo):** **Lakebase** (managed **Postgres / OLTP**, `cobra-v1`) sits next to the
  lakehouse for app-owned operational state — saved scenarios + prediction feedback. Domo does
  CRUD through Code Engine; analytic gold stays in Unity Catalog.
- **Golden path:** On ML Predictions, Accept/Adjust/Reject a prediction → it seeds a reviewable
  **scenario**; open Lakebase Ops to see it persisted and editable.
- **Go to source:** Links to the **Lakebase project / table**.
- **Tie-in:** "Right store for the right job — OLTP state in Lakebase, governed analytics in
  Unity Catalog. The model being scored is Vignette 3."

## Vignette 8 — "Why the AI is trustworthy" (Unity Catalog → AI Readiness)

- **Tab:** UC AI Readiness · **~4 min**
- **Backdrop (the real-world story):** Meet Tessera's **data governance lead** — the person who gets
  the angry Slack when "the numbers don't match." A few weeks back a VP asked the assistant about
  *"churn exposure"* and got a near-wrong answer: `revenue_at_risk` had **no description and no
  synonyms**, so the AI never linked "churn exposure," "ARR at risk," and "revenue at risk." That
  near-miss made Tessera adopt a rule — **a gold view isn't "AI-ready" until its metadata is**
  (comments, semantic + PII tags, units, synonyms in Unity Catalog) **and that context is synced into
  Domo's AI Readiness** so Domo-side users get the same trustworthy answers. This tab is their control
  plane: prove Databricks and Domo are in lockstep, and close gaps before a business user hits one.
- **Databricks (+ Domo):** **Unity Catalog** is the source of truth for column comments, tags
  (semantic type, PII classification, units, `metric`), and synonyms — the metadata that makes Genie
  and the model reliable. (All six `gold_*` views are fully curated: every column carries a comment
  and semantic tag, money fields are tagged `unit=usd`, and personal identifiers like
  `account_owner_name` are flagged `classification=pii`.) The app compares **UC-prepared %** vs
  **Domo AI Readiness synced %**, syncs metadata UC→Domo per column or per dataset, and offers a
  **governed "edit UC context"** path in the inspector drawer (deliberate, confirm-gated) for when the
  source itself needs a better description or a new synonym.
- **Golden path:** Pick **Customer Renewal Risk** → the UC-prepared meter reads near-100% while Domo
  may lag → point at `predicted_churn_probability` (comment + `unit=probability` + `metric`) and
  `account_owner_name` (flagged **PII**) as proof the context is real, not cosmetic → **sync a column**
  UC→Domo and watch the Domo meter close the gap → open the **UC inspector** to add a synonym (e.g.,
  "churn exposure" → `revenue_at_risk`) as a governed, confirm-gated change to the source system.
- **Go to source:** The **Databricks table** (Catalog Explorer → the column comments/tags you just
  curated) and the **Domo AI Readiness** page (the same context, now governing the Domo side).
- **Tie-in:** "This governed metadata is *why* Genie's answers (V2) and the agent's reasoning (V5)
  can be trusted — the governance lead did this work *before* anyone asked the question."

## Vignette 9 — "Zero-copy + lineage" (Cloud Amplifier + UC lineage)

- **Tab:** Forecast Home governed-lineage cards / How It Works · **~3 min**
- **Backdrop:** The architecture buyer worries about copy sprawl and metric drift across tools.
- **Databricks (+ Domo):** **Cloud Amplifier** federates Databricks **live** (no copy); **Unity
  Catalog external lineage** records the six `gold_*` tables flowing to the Domo command-center
  object — one governed graph end to end.
- **Golden path:** Show that every Domo dataset is a live federated read; open the lineage graph.
- **Go to source:** **View Unity Catalog lineage →** (the gold table's Lineage tab, showing the
  downstream Domo node).
- **Tie-in:** "Same governed gold feeds the forecast (V1), Genie (V2), the model (V3), and the
  agent (V5) — one source, no forks."

## Vignette 10 — "The executive close" (the full loop, end to end)

- **Tabs:** Forecast Home → Genie → ML → Agent → Approvals · **~5 min, rapid**
- **Overview:** The capstone run for a senior buyer (CRO, CIO, CDO) who's seen the parts and wants
  the *whole* loop on one governed foundation. In five minutes you take Tessera's **West renewal
  exposure** from a number on a screen to a **governed, human-approved, audited action** — touching
  Databricks and Domo at every step but never forking governance. Don't go deep on any single tab;
  this is the **predict → explain → score → reason → act → record** money shot. Open full-screen,
  persona = **Executive Sponsor**, app freshly reloaded so the KPIs sit at baseline.
- **Golden path (≈5 min, rapid — keep moving):**
  1. **Predict** *(Forecast Home, ~40s).* "Monday's number has a headwind." Point at **Revenue at
     Risk** and the **West hotspot** (51.7 vs ~40); the **Insight Rail** isolates it to West and flags
     `INC-0001`. "Six Unity Catalog gold views, read live by Domo — zero copy. That's the *what*."
  2. **Explain** *(Genie, ~60s).* Click the seeded chip *"Why did renewal risk increase for West
     enterprise accounts?"* → a **cited** root cause tied to `INC-0001` (affected accounts, SLA
     breaches, revenue at risk), generated SQL, and a chart. Tap **Inspect** for one beat: "governed
     call, on the same metrics — that's the *why*, in English."
  3. **Score** *(ML Predictions, ~45s).* Run prediction on the exposed West account → **~33% churn
     (Medium)**. Flash the **payload panel** (cURL / Python / SQL): "an MLflow model on Databricks
     Model Serving, scored server-side — a data scientist can reproduce this exact governed call."
  4. **Reason — agent ⇄ agent** *(Agent Action Queue → Inspect agent, ~75s — the showpiece).* On the
     pending action click **Inspect agent** → watch it reason live (dots: "querying Genie, scoring
     renewal risk…") → a Genie-grounded recommendation + rationale. "A **Domo agent** decided to
     consult a **Databricks Agent Bricks Supervisor**, which reasoned over governed data via Genie —
     two agents, two platforms, one metric layer."
  5. **Act + record** *(Approve & execute → Approvals, ~75s).* Click **Approve & execute** → the
     **Action Journey** timeline lights up across both planes and honestly parks at **Awaiting
     approval · listening**. Switch to **Approvals → Approve** → the timeline completes all-green,
     **Protected Revenue ticks up**, and status is **written back to a Unity Catalog Delta table**
     (`agent_action_writeback`).
  6. **Prove it's real** *(one click, ~20s).* Hit **Writeback table ↗** → the **Pending + Approved**
     rows for that exact action in Catalog Explorer. "Not a mockup — a governed record in the
     lakehouse, queryable by Genie. Full circle."
- **Bottom line:** *"In five minutes Tessera went from a forecast headwind to a governed, approved,
  audited save — **predict, explain, and act** on one foundation. **Databricks governs the
  intelligence and the record; Domo delivers the experience and the action; and governance never
  forks.** Everything you just watched was live — every step had a 'go to source.'"*

---

## Booth cheat-sheet (which vignette for which visitor)

| Visitor | Lead with | Then |
| --- | --- | --- |
| Exec / CRO | V1 → V10 | V5 (agent) |
| RevOps / CS leader | V1 → V2 → V5 → V6 | V7 |
| Data scientist / ML | V3 → V4 | V7 |
| Security / platform | V4 (gateway) → V9 | V8 |
| Data governance | V8 → V9 | V2 |
| "Show me it's real" skeptic | any **Go to source** click | V6 writeback table |

**Reset between visits:** reload the app (KPI bump + action queue reset to baseline). Live
endpoints stay warm if you ran one in the last few minutes; otherwise the first ML/agent call
shows the run-log while it warms — narrate that as "scale-to-zero, pay only when used."
