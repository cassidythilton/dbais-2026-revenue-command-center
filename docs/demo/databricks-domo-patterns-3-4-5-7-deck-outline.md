# Six-Slide Deck Outline — DAIS Patterns: Databricks + Domo

## Purpose

Show four joint Databricks + Domo solution patterns in six slides or fewer, with emphasis on architecture, components, and executive POV.

**Core message:** Databricks creates governed intelligence. Domo operationalizes it through apps, embedded experiences, explanations, workflows, and agents.

**Narrative arc:** **Generate → Deliver → Explain → Act**

---

## Slide 1 — Cover

**Title:** Build with Databricks. Deliver with Domo. Govern Everywhere.

**Subtitle:** Four DAIS patterns for turning Genie, Unity Catalog, and Domo into governed AI delivery.

**Design:** Dark cinematic cover, Domo-blue accent, sparse title, small metadata. Use this as the strongest visual trust signal.

**POV:** Domo does not replace Databricks. Domo activates Databricks by turning governed lakehouse data and AI into business-facing outcomes.

---

## Slide 2 — The Joint Architecture POV

**Title:** Databricks creates governed intelligence. Domo operationalizes it.

**Architecture:** Three-layer stack.

1. **Databricks foundation:** Unity Catalog, metric views, gold tables, Genie, Genie Code, Mosaic AI, Vector Search, SQL Warehouse, Unity AI Gateway.
2. **Governed bridge:** Cloud Amplifier live query, Domo MCP tools, shared identity, UC permissions, Domo PDP, audit.
3. **Domo delivery layer:** Cards, dashboards, App Studio, pro-code apps, Domo Everywhere, AI Chat, Agent Catalyst, Workflows, Code Engine.

**Top POVs:**

- Domo is the governed activation and experience layer for Databricks.
- The joint value is AI delivery, not just better dashboards.
- Governance must follow the workflow from data to app to action.
- More Domo activation creates more Databricks usage: SQL, UC, Genie, model serving, and tool governance.

---

## Slide 3 — Pattern 5: Generate Governed Apps

**Title:** Pattern 5 — Genie Code → Domo dashboards as infrastructure

**10-second positioning:** Genie Code generates the analytic app spec. Domo MCP and skills compile it into production cards, App Studio pages, pro-code apps, datasets, and workflows.

**Architecture flow:**  
Business prompt → Genie Code → UC-backed SQL + chart/layout intent → portable app spec → Domo MCP + skills/rules → Domo cards/App Studio/pro-code/workflows → Cloud Amplifier live Databricks data.

**Databricks components:** Genie Code, Genie Spaces, Unity Catalog, UC metric views, gold tables, SQL Warehouse.

**Domo components:** Domo MCP tools, skills/rules, card APIs, App Studio, pro-code apps, Cloud Amplifier, Beast Modes, manifest mappings, Workflows / Code Engine.

**Top POVs:**

- BI as code: analytic experiences become reproducible and versionable.
- Domo becomes the production compiler for Databricks-generated intent.
- UC remains the semantic source, so metrics do not drift.
- Faster field delivery: prompt to demo-ready app.
- Strongest flagship demo because it proves agentic asset generation.

---

## Slide 4 — Pattern 4: Deliver In One Governed Experience

**Title:** Pattern 4 — Genie everywhere + Domo portals

**10-second positioning:** Embed Genie chat and Domo dashboards in one portal, governed by shared SSO, Unity Catalog access controls, and Domo PDP.

**Architecture flow:**  
User SSO → embedded Genie / Conversation API with OAuth → UC row and column controls → Domo Everywhere dashboards/cards → Domo PDP → same user/tenant experience.

**Databricks components:** Genie embed iframe, Genie Conversation API, Enterprise OAuth / U2M, Unity Catalog permissions, UC ABAC, space-level instructions.

**Domo components:** Domo Everywhere, embedded cards/dashboards, App Studio or custom portal shell, PDP, shared IdP/SSO, optional pro-code chat/navigation panels.

**Top POVs:**

- One business experience, two strengths: ad hoc Genie + curated Domo.
- Identity is the architecture.
- Business users do not need to live in Databricks to benefit from Databricks.
- Works for internal portals, customer portals, and productized analytics.
- Security story is credible because access is enforced in both planes.

---

## Slide 5 — Patterns 7 + 3: Explain, Then Act

**Title:** Explain the insight. Then execute the response.

**Pattern 7: Cross-platform RAG**

**Architecture flow:** UC metric views → Genie structured answer + Domo MCP metadata extraction → Domo card definitions, Beast Modes, docs, runbooks, change logs → Vector Search / knowledge index → cited answer with Domo card links.

**Key components:** Genie, UC metric views, Mosaic AI Vector Search, Domo cards, dataset schemas, Beast Modes, dashboard docs, AI Chat, Domo MCP.

**Pattern 3: Actionable Genie**

**Architecture flow:** Genie detects issue → Unity AI Gateway governs MCP/tool call → Domo Agent Catalyst / Workflow / Code Engine executes → human approval if needed → status/writeback.

**Key components:** Genie Space, Unity AI Gateway, MCP/tool registry, OBO execution, Agent Catalyst, Workflows, Code Engine, Alerts, approvals.

**Top POVs:**

- The copilot must answer with the number and the context behind it.
- Domo content becomes governed knowledge, not just dashboard furniture.
- Domo is the action runtime for Databricks intelligence.
- Unity AI Gateway governs the tool call; Domo governs the business execution.
- This moves customers from AI that informs to AI that operates.

---

## Slide 6 — The Combined DAIS Pattern

**Title:** Generate → Deliver → Explain → Act

**Combined architecture:**

1. **Generate:** Pattern 5 turns Genie Code output into Domo assets.
2. **Deliver:** Pattern 4 embeds those assets with Genie in a governed portal.
3. **Explain:** Pattern 7 adds Domo asset context, runbooks, citations, and metric meaning.
4. **Act:** Pattern 3 triggers governed workflows, approvals, and business execution.

**Recommended demo sequence:**

1. Ask Genie Code to create an executive revenue app.
2. Use Domo MCP + skills to generate the Domo app.
3. Embed the app with Genie in a portal.
4. Ask why a KPI changed and get a cited answer.
5. Trigger a governed Domo workflow to notify, refresh, or escalate.

**Final talk track:** Build with Databricks. Deliver with Domo. Govern everywhere. Genie and Unity Catalog define the intelligence; Domo turns it into business-facing apps, explanations, and action.

