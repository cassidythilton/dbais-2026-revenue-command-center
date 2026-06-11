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
predicts the exposure, explains the root cause, and drives a **governed, human-approved
retention play** — all on one governed Databricks foundation, with **no data copied** into Domo.

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
  The Insight Rail says the dip is isolated to West and tied to `INC-0001`.
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
  accounts this month?"* → cited root cause (incident-linked), generated SQL, and a chart built
  from the returned rows. Open **Inspect** to show it's governed, on-behalf-of the user.
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
- **Databricks (+ Domo):** A **Databricks Agent Bricks Multi-Agent Supervisor** (the *Pattern 4
  Retention Supervisor*) reasons over the gold views **via Genie**. A **Domo AI agent tile inside
  a governed Domo Workflow** calls it through Code Engine — **a Domo agent calling a Databricks
  agent.**
- **Golden path:** On a pending action, click **Inspect agent** → watch it reason live (the dots
  pulse: "querying Genie, scoring renewal risk…") → a Genie-grounded recommendation with rationale
  and what-to-watch renders in-app.
- **Go to source:** In the inspector footer: **Open agent ↗**, **Activity log (MLflow) ↗** (every
  agent decision is traced), **Writeback table ↗**.
- **Tie-in:** "The agent recommends; a human still signs off — that's Vignette 6."

## Vignette 6 — "Human-in-the-loop, written to the lakehouse" (Workflow + writeback)

- **Tab:** Forecast Home → **Approve & execute** → Approvals tab · **~5 min**
- **Backdrop:** Revenue-impacting actions need a human sign-off and a permanent, auditable record.
- **Databricks (+ Domo):** A **live, governed Domo Workflow** (Renewal Risk Retention) routes a
  human-approval task; on approval its service task writes status **back to a Unity Catalog Delta
  table** (`agent_action_writeback`) — same governed lakehouse as the metrics, queryable by Genie.
- **Golden path:** Click **Approve & execute** → the row shows a live "▶ workflow · listening for
  approval" chip (it auto-updates — no manual refresh). Switch to **Approvals**, click **Approve**
  → the workflow resumes, **Protected Revenue ticks up**, the row flips to Executed.
- **Go to source:** **View in Databricks ↗** → the writeback table's Sample Data (the Pending +
  Approved rows for that action). **Open task ↗** keeps the live workflow-run view.
- **Tie-in:** "Insight → reasoning → human approval → governed record. That's the full Pattern 4
  loop. The agent that recommended it was Vignette 5."

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
- **Backdrop:** The data-governance lead: "AI is only as good as the governed metadata behind it."
- **Databricks (+ Domo):** **Unity Catalog** is the source of truth for column comments, tags, and
  synonyms — the metadata that makes Genie and the model reliable. The app compares **UC-prepared
  %** vs **Domo AI Readiness synced %**, syncs metadata UC→Domo per column/dataset, and offers a
  **governed "edit UC context"** path in the inspector drawer (deliberate, confirm-gated).
- **Golden path:** Pick a dataset → see the UC-vs-Domo meters → sync a column → open the UC
  inspector to edit context as a governed source-system change.
- **Go to source:** The **Databricks table** and the **Domo AI Readiness** page.
- **Tie-in:** "This governed metadata is *why* Genie's answers (V2) and the agent's reasoning (V5)
  can be trusted."

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

## Vignette 10 — "The 90-second executive close" (the full loop)

- **Tabs:** Forecast Home → Genie → ML → Agent → Approvals · **~5 min, rapid**
- **Backdrop:** For an exec who only has a minute: prove the whole loop on one governed foundation.
- **Golden path (fast):** Forecast headwind isolated to **West** → ask **Genie** *why* (incident
  `INC-0001`) → **score** an exposed account on Model Serving → **Inspect** the Databricks agent's
  recommendation → **Approve & execute** → **Protected Revenue** ticks up and the status is
  **written back to Unity Catalog**, fully audited.
- **The line:** *"Predict, explain, and act — Databricks governs the intelligence and the record,
  Domo delivers the experience and the action, and governance never forks."*

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
