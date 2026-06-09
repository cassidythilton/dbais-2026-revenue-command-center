# Pattern 4 Expansion — Spike Findings (X1, X2, X3)

Resolves the three shaping spikes in `pattern-4-ml-lakebase-experience-expansion-shaping.md`.
All investigation was read-only. Tokens/secrets are deliberately omitted. Date: 2026-06-09.

---

## X1 — Domo AI Services / Databricks ML adapter mechanics

### Key correction
`deal-inspect` does **not** use Databricks for ML — its model stack is **Snowflake Snowpark** (stacking
ensemble, `SP_PREDICT_WIN_PROBABILITY`). It remains the gold reference for the **Code-Engine-mediated
ad hoc inference pattern**, not for the Databricks adapter itself.

### deal-inspect inference pattern (reuse this shape)
- CE function pulls credentials from a Domo Account: `const acct = await sdk.getAccount(ACCOUNT_ID)`.
- Calls the compute REST endpoint with those creds, normalizes to `{ columns, rows }`.
- App calls the CE function via `domo.post('/domo/codeengine/v2/packages/<fn>', args)` and unwraps the result.

### Domo AI Services API surface (discovered live)
- Registry root is **`/api/ml/v1/models`** (NOT `/api/ai/v1/*`, which 404s).
- `POST /api/ml/v1/models` = register; `GET /api/ml/v1/models/{id}` = read; item route also allows POST (likely invoke/score).
- Could not fully read the example model `c8cb6bd7-...` read-only (list requires POST). The exact stored-metadata
  JSON + the AI Services runtime invoke contract are **unconfirmed**; capture from the browser network tab on
  `https://databricks-demo.domo.com/ai-services/models?model=c8cb6bd7-9ce2-4a47-8070-f6b309849e40` to close this.

### Databricks Model Serving invocation contract (verified on `CassidyLightGBM`)
- `POST https://dbc-0516e56c-ba3e.cloud.databricks.com/serving-endpoints/<name>/invocations`
- Header: `Authorization: Bearer <DATABRICKS_PAT>`, `Content-Type: application/json`
- Body (named-column, preferred for tabular): `{ "dataframe_records": [ { "col": val, ... } ] }`
  - split form `{ "dataframe_split": { "columns": [...], "data": [[...]] } }` also valid
  - tensor form `{ "inputs": [[...]] }` / `{ "instances": [[...]] }` (CassidyLightGBM uses 11-float positional)
- Response: `{ "predictions": [ v1, v2, ... ] }` (one per input row).
- `~/bin/databricks serving-endpoints get-open-api <name> -p pattern4` returns the input/output signature.

### DECISION — runtime path for `pattern4ce.runModelInference`
**Code Engine calls Databricks Model Serving directly** (Bearer PAT from the package config), and Domo AI
Services is shown as the **governance/catalog** integration (model registered/visible there). This mirrors the
proven deal-inspect "CE → compute REST" shape and uses the verified serving contract. Train the model with a
**named-column MLflow signature** so the CE payload is clean `dataframe_records`.

### ML target + features (verified columns on `gold_customer_renewal_risk`)
- Target: **binary renewal-risk / churn classifier** → outputs `predicted_churn_probability` (0..1) and a
  derived `revenue_at_risk = churn_prob * annual_recurring_revenue`. Replaces the current heuristic score.
- Features: `segment`, `industry`, `region` (categoricals); `annual_recurring_revenue`, `cases_90d`,
  `sla_breaches_90d`, `negative_cases_90d`, `avg_usage_score_90d`, `usage_drop_days_90d` (numeric);
  derived `days_to_renewal` from `renewal_date`.
- Existing heuristic columns to learn/replace: `renewal_risk_score`, `risk_tier`,
  `predicted_churn_probability`, `revenue_at_risk`, `top_risk_driver`, `recommended_action`.

---

## X2 — Lakebase existing-example mechanics

### Existing Code Engine package `55a6749a-8eff-44d5-a388-99289395fcb6` = `LakebaseQuery`
- One generic function: **`lakebaseQuery(sql: text, params: text)`** → `{ rows, rowCount, fields }`
  (or `{ error, rows:[], rowCount:0 }`). `params` is a JSON-stringified array of bind values (`$1,$2,...`).
- Implementation: bundles **node-postgres (`pg`)**; opens a real Postgres client and runs `client.query(sql, params)`.
- Auth (two-step, in-memory cached): `POST {workspace}/oidc/v1/token` (Basic SP `clientId:clientSecret`,
  `grant_type=client_credentials&scope=all-apis`) → workspace token; `POST {workspace}/api/2.0/postgres/credentials`
  with `{endpoint}` + Bearer → short-lived Lakebase DB token; then `pg.Client({host, port:5432, database,
  user: clientId, password: <dbToken>, ssl:{rejectUnauthorized:true}})`.
- Connects to **`projects/cobra-v1/branches/production/endpoints/primary`**, host
  `ep-fancy-mud-d2xv4rcd.database.us-east-1.cloud.databricks.com`, db `databricks_postgres`.
- **Credentials (SP clientId/secret) are baked into the bundle** — not a Domo Account, not env var.

### Existing app `f0530276-c614-461a-b05d-96d93f06a33e` = "Lakebase Explorer"
- Pro-code React/Vite Domo design; tabbed CRUD over demo tables `clients/projects/tasks`.
- Manifest uses **plural `packagesMapping`** with `{ name: "LakebaseQuery", alias: "lakebaseQuery",
  packageId: "55a6749a-...", version: "1.0.3", params, output }`, `proxyId` = the design id.
- Client call: `domo.post('/domo/codeengine/v2/packages/lakebaseQuery', { sql, params: JSON.stringify(params) })`,
  then unwrap nested `response`/`output`/`result`/`value` envelopes; helpers `fetchTable/insertRow/updateRow/deleteRow`
  build `$1,$2` parameterized SQL with `RETURNING *`.

### DECISION — reuse cobra-v1
**Reuse `projects/cobra-v1`** (owned by cassidy.hilton@domo.com; autoscale 2–4 CU; scale-to-zero **disabled** so it
is always warm → no cold-start in demos; already wired into the working `LakebaseQuery` package). Do **not** create
a new Lakebase project. Add Pattern 4 tables to the `public` schema.

### DECISION — first Lakebase objects (scenario runs + prediction feedback)
```sql
CREATE TABLE public.p4_scenario_runs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          text        NOT NULL,
  created_by    text        NOT NULL,
  status        text        NOT NULL DEFAULT 'draft',  -- draft|running|complete|archived
  assumptions   jsonb       NOT NULL DEFAULT '{}',     -- input levers
  results       jsonb,                                 -- computed forecast snapshot
  baseline_id   bigint REFERENCES public.p4_scenario_runs(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX p4_scenario_runs_created_at_idx ON public.p4_scenario_runs (created_at DESC);

CREATE TABLE public.p4_prediction_feedback (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prediction_id   text        NOT NULL,
  entity_type     text        NOT NULL,   -- 'account' | 'forecast' ...
  entity_id       text        NOT NULL,
  feedback        text        NOT NULL,   -- accept|reject|adjust
  predicted_value numeric,
  corrected_value numeric,
  comment         text,
  created_by      text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX p4_prediction_feedback_entity_idx ON public.p4_prediction_feedback (entity_type, entity_id);
```

### DECISION — Code Engine wiring for Lakebase
Two viable routes; **leaning toward folding Lakebase into `pattern4ce`** to preserve the single proven
`proxyId: "pattern4ce"` + singular `packageMapping` pattern (avoids mixing manifest styles):
- **Route A (recommended): add to `pattern4ce`** — port the SP-token→`pg` connection block into the package and
  expose typed functions `listScenarios`, `createScenario`, `getScenario`, `savePredictionFeedback` (and a generic
  `lakebaseQuery` if useful). One package, one manifest pattern. SP creds live server-side in the package only.
- **Route B: reuse `LakebaseQuery` directly** via a second plural `packagesMapping` entry — zero new auth wiring,
  but mixes manifest patterns with the existing singular `packageMapping`; verify both coexist before relying on it.

---

## X3 — Genie seeded questions + chart/plot metadata

### Seeded questions (verbatim, space `01f1642295b61d6b8849e106f52fc781`)
Source: `GET /api/2.0/data-rooms/{space_id}/curated-questions` (public `genie get-space` does **not** expose them).
One set, `question_type = SAMPLE_QUESTION`, 5 questions in stored order:
1. `Why did renewal risk increase for West enterprise accounts?`
2. `Which accounts were most affected by incident INC-0001?`
3. `How much revenue is at risk because of SLA breaches?`
4. `Which recommended actions should the regional manager approve first?`
5. `Did approved agent actions reduce revenue at risk after the incident?`

(Per-answer dynamic follow-ups are separate and returned at runtime in a suggested-questions attachment.)

### Chart/visualization metadata — definitive NO
The Genie Conversation API exposes only **SQL + result rows/columns + text**. No chart type, axis mapping, or viz
spec anywhere. A completed message has `attachments[]` of three shapes:
- query attachment: `attachment_id`, `query.{query (SQL), description, statement_id, query_result_metadata:{row_count}, thoughts[]}`
- text attachment: `text.content` (markdown answer)
- suggested-questions attachment: `suggested_questions.questions[]`

The `/query-result/{attachment_id}` endpoint returns a standard SQL Statement Execution response:
`statement_response.manifest.schema.columns[]` (`name`, `type_text`, `type_name`, `position`) + `result.data_array`.
**This is the only source of columns+types+rows for charting.** The current `askGenie` reads SQL/text/row_count
but **discards** `manifest.schema.columns` and `result.data_array` — it must surface them for Domo-side charts.

### DECISION — Domo-side chart reconstruction rules
Classify each column by `type_name`: TEMPORAL (`DATE/TIMESTAMP/TIMESTAMP_NTZ`), NUMERIC
(`DOUBLE/DECIMAL/FLOAT/INT/BIGINT/LONG/SHORT/BYTE`), CATEGORICAL (`STRING/BOOLEAN` / low cardinality).
First match wins:

| # | Columns | Rows | Chart | Mapping |
|---|---------|------|-------|---------|
| 1 | 1 numeric | 1 | KPI | value = [0][0] |
| 2 | 1 temporal + 1 numeric | >1 | Line | x=temporal, y=numeric |
| 3 | 1 temporal + ≥2 numeric | >1 | Multi-series line | x=temporal, y=each numeric |
| 4 | 1 categorical + 1 numeric | ≤~30 | Bar | x=categorical, y=numeric (sort desc) |
| 5 | 1 categorical + 1 numeric | >~30 | Bar top-N + other | cap categories |
| 6 | 1 categorical + ≥2 numeric | any | Grouped/stacked bar | category + series |
| 7 | 2 categorical + 1 numeric | any | Grouped bar / heatmap | cat1 x, cat2 color |
| 8 | 2 numeric | >1 | Scatter | x=num1, y=num2 |
| 9 | single row, multiple numeric | 1 | KPI row | one tile per numeric |
| 10 | else / >~5 mixed cols | any | Table | raw rows |

Format hints: name `~/revenue|arr|amount|risk|margin|price|cost/i` + numeric → currency; `~/rate|pct|percent|score|ratio/i` → %.
Always offer a "view as table" fallback; default to table when ambiguous.
