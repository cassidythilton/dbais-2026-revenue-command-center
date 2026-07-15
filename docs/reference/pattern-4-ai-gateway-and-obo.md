# Pattern 4 — Unity AI Gateway + OBO (Track 2, Shape B)

Governs the Databricks-side AI tool calls through **Unity AI Gateway**, with a documented
on-behalf-of (OBO) identity path. Live in workspace `https://dbc-0516e56c-ba3e.cloud.databricks.com`
(CLI profile `pattern4`). This is the engineering source of truth for the gateway work; the
build plan and demo runbook reference it.

---

## 1. What is live (verified)

### A. Model endpoint — `pattern4-renewal-risk` (custom HGB regressor v6)

AI Gateway enabled via `serving-endpoints put-ai-gateway` (was `ai_gateway: null`):

```json
{
  "usage_tracking_config": { "enabled": true },
  "inference_table_config": {
    "enabled": true,
    "catalog_name": "databricks_raptor",
    "schema_name": "pattern4_agent_automation",
    "table_name_prefix": "p4_renewal_risk_inference"
  },
  "rate_limits": [ { "calls": 120, "key": "endpoint", "renewal_period": "minute" } ]
}
```

- **Usage tracking** → system tables (`system.serving.*`).
- **Inference table** → payload logging to `databricks_raptor.pattern4_agent_automation.p4_renewal_risk_inference_*`.
- **Rate limit** → 120 calls/min at the endpoint key.
- **No app/CE contract change** — same `/serving-endpoints/pattern4-renewal-risk/invocations`;
  `pattern4ce.runModelInference` is unchanged.
- **Guardrails N/A** here: the model returns a number, so safety/PII content filters do not apply.

### B. LLM reasoning endpoint — `pattern4-reasoning-gateway` (NEW, guardrailed)

An **external-model** endpoint wrapping a foundation model (`databricks-claude-sonnet-4-5`)
via provider `databricks-model-serving`, so we own the AI Gateway config (incl. guardrails)
without mutating a shared system endpoint. Pay-per-token (no idle GPU cost).

```json
{
  "name": "pattern4-reasoning-gateway",
  "config": { "served_entities": [ {
    "name": "p4-reasoning",
    "external_model": {
      "name": "databricks-claude-sonnet-4-5",
      "provider": "databricks-model-serving",
      "task": "llm/v1/chat",
      "databricks_model_serving_config": {
        "databricks_workspace_url": "https://dbc-0516e56c-ba3e.cloud.databricks.com",
        "databricks_api_token": "{{secrets/pattern4/dbx_pat}}"
      }
    }
  } ] },
  "ai_gateway": {
    "usage_tracking_config": { "enabled": true },
    "inference_table_config": { "enabled": true, "catalog_name": "databricks_raptor",
      "schema_name": "pattern4_agent_automation", "table_name_prefix": "p4_reasoning_inference" },
    "rate_limits": [ { "calls": 60, "key": "endpoint", "renewal_period": "minute" } ],
    "guardrails": {
      "input":  { "safety": true, "pii": { "behavior": "BLOCK" } },
      "output": { "safety": true, "pii": { "behavior": "MASK" } }
    }
  }
}
```

- **Guardrails** are real here (text endpoint): input safety + PII **BLOCK**, output safety + PII **MASK**.
- The provider token is a **Databricks secret reference** (`{{secrets/pattern4/dbx_pat}}`,
  scope `pattern4`, key `dbx_pat`) — raw tokens are rejected by the API and never committed.
- **App call path (live):** `pattern4ce.askReasoningModel(prompt, persona)` →
  `POST /serving-endpoints/pattern4-reasoning-gateway/invocations`. Surfaced in the app as the
  **"AI rationale ↗"** action on a pending agent action, badged *"⛨ Unity AI Gateway · guardrails on"*.
- Smoke-tested: a renewal-risk triage prompt returns a concise governed recommendation + token usage.

### C. Genie

Genie is **not** a serving endpoint, so it cannot sit behind a serving-endpoint gateway.
Its governance is **Unity Catalog + Genie space permissions**. The reasoning/guardrail layer
above is the gateway-governed text path; Genie remains governed by UC.

---

## 2. OBO (on-behalf-of) — honest status + supported route

**Today:** all Databricks calls from the app run **server-side through Code Engine
(`pattern4ce`) as a single governed identity** — the workspace PAT / service principal. Every
call is audited (usage tables + inference tables), rate-limited, and guardrailed, but as **one
identity**, not per-end-user.

**Why true per-user OBO is not wired (the real blocker):** the app is an **embedded Domo
pro-code app**. The end user authenticates to **Domo** (Domo SSO identity); there is **no
Databricks user identity** in that session to propagate. The Code Engine bridge holds a
server-side credential, not the caller's Databricks token.

**Supported route to real OBO (not faked):**
1. **Databricks U2M OAuth** — have the end user authenticate to Databricks (OAuth user-to-machine);
   the app/CE forwards the user's short-lived token so model/Genie calls run *as that user*,
   enforcing UC row filters and AI Gateway per-user usage/limits.
2. **Token / identity federation** — federate the Domo identity to a Databricks identity (SCIM-
   provisioned + workspace identity federation), then exchange for a scoped Databricks token.
3. **Per-user rate-limit key** — once a user identity flows through, set AI Gateway
   `rate_limits[].key = "user"` so limits/usage are tracked per principal instead of per endpoint.

Until (1)/(2) is in place, the demo's honest claim is: *"governed + audited through Unity AI
Gateway as a single service identity; per-user OBO is a documented, supported next step."*

---

## 3. How to verify / audit (demo proof points)

- **Endpoint config:** `~/bin/databricks serving-endpoints get pattern4-renewal-risk -p pattern4`
  and `... get pattern4-reasoning-gateway -p pattern4` → see the `ai_gateway` block.
- **Inference tables** (payload audit), once traffic flows:
  - `SELECT * FROM databricks_raptor.pattern4_agent_automation.p4_renewal_risk_inference_payload LIMIT 50`
  - `SELECT * FROM databricks_raptor.pattern4_agent_automation.p4_reasoning_inference_payload LIMIT 50`
  (table name suffix may be `_payload`; list with `SHOW TABLES IN ... LIKE 'p4_*_inference*'`.)
- **Usage tracking:** `system.serving` system tables (per-endpoint request/token counts).
- **In-app:** How It Works → **Unity AI Gateway** stage (now "live"); Agent Action Queue →
  **AI rationale ↗** (guardrailed reasoning, badged as governed).

---

## 4. Reproduce

- Model gateway: `serving-endpoints put-ai-gateway pattern4-renewal-risk --json <Section 1A>`.
- LLM gateway: create secret (`secrets create-scope pattern4`; `secrets put-secret pattern4 dbx_pat`),
  then `serving-endpoints create --json <Section 1B>`.
- CE: `pattern4ce.askReasoningModel` is in the FULL `codeengine/functions.js` and **released in `pattern4ce` v1.0.14** (verified: signature matches the manifest; body references `pattern4-reasoning-gateway`).
