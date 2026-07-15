---
shaping: true
---

# Pattern 4 — Domo PDP ⇄ Databricks Row-Level Security — Shaping

Working shaping doc for re-incorporating the Domo PDP / Databricks row-level
permissions piece from the original build plan. Ground truth for requirements
(R), shapes, parts, spikes, and the fit check.

---

## Frame

### Source (verbatim)

> in the original project plan we had intended on incorporating a domo pdp piece of functionality in the app. i would like to explore this again. the functionality should include databricks row level permissions wherein the databricks row level permissions policy is the source of truth and we replicate the same logic in domo. this would also include a ui where a demo easily shows the functionality at the dataset level. we will use only the "gold" datasets in databricks_raptor.pattern4_agent_automation. reference the original plan and use your own knowledge and your shaping skill to tease apart the requirements of this solution that i have specified above.

Original-plan anchors (verbatim from the build plan):
> UC row filters and Domo PDP should be aligned by shared dimensions such as `tenant_id`, `region`, or user group.
> Genie answers must be scoped to the same entitlement as Domo dashboard data.
> UC row-filter implementation is still pending; entitlement design exists in `dim_user_entitlement` / `gold_portal_user_scope`.

### Problem

Pattern 4's governance story claims "one identity, one governed metric layer" across Databricks and Domo,
but **row-level entitlement is not actually enforced or demonstrated**. Today the only scoping is a
front-end-only "Viewing as" persona dropdown on Forecast Home — it filters the mock/forecast view in the
browser and proves nothing about governance. There is no Databricks row-level policy and no Domo PDP, so a
skeptical governance/security buyer can't see that the **same person sees the same rows** in both planes.

### Outcome

A buyer can pick a **gold dataset**, switch **personas**, and watch the **identical row scope** enforced
on both planes — with **Databricks Unity Catalog as the authoritative row-level policy** and **Domo PDP as a
faithful, replicated mirror** of that same logic (no drift). The app makes this legible at the **dataset
level**: the UC policy, the replicated Domo PDP policy, and a live parity proof per persona.

---

## CURRENT (what exists today)

| Area | State |
|------|-------|
| Entitlement model | `dim_user_entitlement` + `gold_portal_user_scope` exist and encode tiers **ALL** (exec/admin), **REGION** (regional managers), **TENANT** (tenant admins), **OWNER** (account owners), keyed on `region` / `tenant_id` / `account_owner_id`. 10 demo users. |
| Databricks RLS | **None.** No UC `ROW FILTER` is attached to any `gold_*` object (verified via UC tables API — `row_filter: none` on all six). |
| Gold objects | All six `gold_*` are **VIEWs** over silver Delta, not base tables. |
| Scoping columns | Vary per view: renewal-risk & action-queue have `region`+`tenant_id`+`account_owner_id`; exec-health & forecast have `region`+`tenant_id`; incident has `region` only; portal-user-scope *is* the entitlement map. |
| Domo datasets | 5 of 6 gold views are Cloud-Amplifier **federated** datasets in Domo (forecast is not federated). |
| Domo PDP | **None configured.** |
| App scoping | Front-end-only "Viewing as" persona dropdown on Forecast Home (re-scopes the local forecast view; **not** UC- or PDP-enforced). |
| Query identity | The pro-code app calls Databricks/Domo via Code Engine using a **single service-principal token** — not the end user's identity (no OBO). |

---

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | Demonstrate row-level data permissions where the **Databricks UC row-level policy is the source of truth** and the **same scoping logic is replicated into Domo PDP**, over the gold datasets in `databricks_raptor.pattern4_agent_automation`. | Core goal |
| R1 | Author the **canonical row-level policy in Unity Catalog**, driven by the existing entitlement mapping (`dim_user_entitlement` / `gold_portal_user_scope`: `access_level` ALL/REGION/TENANT/OWNER × `region`/`tenant_id`/`account_owner_id`). Reuse the entitlement tables — don't invent a new model. | Must-have |
| R2 | **Replicate the same logic into Domo PDP** on the federated gold datasets so a given persona sees the **same rows** in Domo as Databricks enforces — no metric/scope drift. | Must-have |
| R3 | Replication is **one-way: UC → Domo** (UC authoritative). Re-running replication after a UC policy/entitlement change re-aligns Domo; Domo is never the source of truth. | Must-have |
| R4 | A **dataset-level demo UI**: select a gold dataset, see its UC row-level policy and the replicated Domo PDP policy, and switch personas to watch the scoped result change. | Must-have |
| R5 | **Visible parity proof** — for a selected persona × dataset, show what Databricks returns (row count / sample) vs what Domo PDP returns, demonstrating they match (and a clear "in parity / drift" signal). | Must-have |
| R6 | Handle **heterogeneous scoping columns per gold view** (region/tenant/owner presence varies; incident is region-only; forecast is region+tenant and not federated). The policy adapts per dataset to the columns it has. | Must-have |
| R7 | Persona model mirrors the **existing entitlement tiers** (Exec/Admin = ALL, Regional Manager = region, Tenant Admin = tenant, Account Owner = owned accounts); at least two personas return visibly different scopes. | Must-have |
| R8 | **Honesty about enforcement & identity** — the embedded app uses a service token, not per-user OBO. The UI must be truthful about where row-level access is *live-enforced* (Domo PDP for Domo users; UC row filter for identity-aware queries) vs *simulated* in-app via a persona predicate. No false claim of per-user OBO. | Must-have |

**Notes / open negotiation on R:**
- R2/R3 assume Domo PDP can be created on **Cloud-Amplifier federated** datasets and (ideally) via API — see Spike X1.
- R1 assumes a UC row-level policy can target **views** (or that we move the policy to base tables / a secure-view pattern) — see Spike X2.
- Candidate trim: is **live** Domo PDP write required (R2 strong form), or is a **generated PDP policy spec + simulated parity** acceptable for the demo (R2 weak form)? This is the main fork between Shapes A and B.

---

## Shapes

### CURRENT: front-end persona dropdown
Browser-only "Viewing as" filter on the forecast. No UC policy, no PDP, no parity. Baseline only.

### A: Live both planes — UC row filter (real) + Domo PDP via API + in-app parity

| Part | Mechanism | Flag |
|------|-----------|:----:|
| **A1** | **UC entitlement policy (source of truth).** A UC SQL UDF `p4_row_visible(region, tenant_id, account_owner_id)` that joins the caller to `dim_user_entitlement` (by `current_user()`), returning true when `access_level='ALL'` or the row's dim matches the caller's entitled region/tenant/owner. Attach as a `ROW FILTER` to each gold object. | ⚠️ (row filter on VIEWs — X2) |
| **A2** | **Per-dataset predicate adapter.** The row filter is bound only to the scoping columns each view actually has (region-only for incident, region+tenant for exec/forecast, all three for renewal/action). | |
| **A3** | **Replicate UC → Domo PDP (live).** A CE function reads the entitlement map + the per-dataset scoping columns and **creates/updates Domo PDP policies** on the 5 federated datasets (one policy per persona/group → filter values). Idempotent re-run = re-align. | ⚠️ (Domo PDP API on federated datasets — X1) |
| **A4** | **Dataset-level UI.** A "Row-Level Security" tab: dataset rail → selected dataset shows the UC policy (UDF + bound columns) and the generated Domo PDP policy, a **Replicate to Domo** action, and a **persona switcher**. | |
| **A5** | **Parity proof (simulated identity).** For persona × dataset, CE runs the UC-filtered query *as that persona's predicate* and the federated-Domo query with the same predicate, returns both row counts + sample, and the UI shows "in parity ✓". Honest banner: in-app parity uses a persona predicate (service token), not OBO. | |

### B: UC source of truth + Domo PDP **spec/preview** (no live PDP write) + in-app parity

| Part | Mechanism | Flag |
|------|-----------|:----:|
| **B1** | UC entitlement policy (= A1). | ⚠️ (X2) |
| **B2** | Per-dataset predicate adapter (= A2). | |
| **B3** | **Generate the Domo PDP policy *spec*** (the exact policies you'd create — persona → column filter values) from the same entitlement map, shown/exported in-app; no dependency on a PDP write API. | |
| **B4** | Dataset-level UI (= A4, but "Replicate" shows/exports the PDP spec instead of writing it). | |
| **B5** | Parity proof (= A5): predicate-simulated, UC-filtered rows vs federated-Domo rows match. | |

### C: A + true per-user OBO enforcement

| Part | Mechanism | Flag |
|------|-----------|:----:|
| **C1–C4** | = A1–A4. | ⚠️ |
| **C5** | **Live per-user enforcement** — the embedded app calls Databricks/Domo **as the end user** (OAuth U2M / token federation / Domo→Databricks OBO), so the UC row filter and Domo PDP enforce on the *real* identity, not a simulated predicate. | ⚠️ (OBO/identity federation — known-hard, X3) |

---

## Spikes (investigate before claiming ✅)

### X1 — Domo PDP on Cloud-Amplifier federated datasets
- **Q:** Can Domo PDP policies be created on **federated** (Cloud Amplifier) datasets, and is there a supported **API** to create/update them (vs UI-only)? What's the policy contract (columns, values, user vs group binding)?
- **Acceptance:** we can describe how (and whether) to create a PDP policy on the 5 federated gold datasets programmatically, and the exact payload.

### X2 — UC row filter on VIEWs (vs base tables / secure view)
- **Q:** Can a UC `ROW FILTER` be attached to a **VIEW**, or must it bind to base tables? If not on views, what's the cleanest source-of-truth pattern for these gold views (row filter on silver base tables, a secure-view WHERE-join on `current_user()`, or rebuild gold as tables)?
- **Acceptance:** we can describe the concrete DDL that makes the UC row-level policy authoritative for each gold dataset.

### X3 — Identity / OBO in the embedded app (only if Shape C)
- **Q:** What's required for the embedded pro-code app to query Databricks/Domo as the **end user** (not the service principal)? (Reuses the prior OBO findings in `pattern-4-ai-gateway-and-obo.md`.)
- **Acceptance:** we can describe the steps + their feasibility for live per-user enforcement.

---

## Macro Fit Check: R × {A, B, C}

(Early-stage shapes with flagged mechanisms, so this uses the macro check: **Addressed?** = does the shape speak to R; **Answered?** = is the concrete mechanism known/spelled out.)

| Req | Requirement | A·Addr | A·Ans | B·Addr | B·Ans | C·Addr | C·Ans |
|-----|-------------|:------:|:-----:|:------:|:-----:|:------:|:-----:|
| R0 | UC source of truth + replicate to Domo PDP, gold datasets | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| R1 | Author canonical UC policy from entitlement tables | ✅ | ⚠️ | ✅ | ⚠️ | ✅ | ⚠️ |
| R2 | Replicate same logic into Domo PDP (same rows) | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| R3 | One-way UC → Domo, re-alignable | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| R4 | Dataset-level demo UI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| R5 | Visible parity proof | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| R6 | Heterogeneous scoping columns per view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| R7 | Mirror existing persona tiers; 2+ visibly different | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| R8 | Honesty about enforcement/identity | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |

### Gaps

| Gap | Blocks | Related R | Resolve via |
|-----|--------|-----------|-------------|
| UC row filter on VIEWs unknown | A1/B1/C1 "Answered" | R1 | Spike X2 |
| Domo PDP API on federated datasets unknown | A3 "Answered" (live write) | R2 (strong), R3 | Spike X1 |
| OBO identity for live per-user enforcement | C5 | R8 (true-enforcement form) | Spike X3 |

**Reading it:** All three shapes *address* the goal. **B is the most "answered" today** — it needs only X2 (UC policy mechanics) and avoids the Domo-PDP-write unknown by generating a policy spec + simulated parity. **A** is B plus live PDP writes (needs X1). **C** adds true OBO (needs X3 — historically the hard, deferred piece). For a demo, B (or A if X1 comes back clean) is the pragmatic target; C is the "fully live" aspiration.

---

## Open decisions (to negotiate next)

1. **R2 strong vs weak** — must Domo PDP be **written live** (A/C), or is a **generated PDP policy spec + simulated parity** enough for the demo (B)? *(Recommend: run X1; if PDP-on-federated + API works, do A; else B.)*
2. **UC policy target (X2)** — row filter on views, on silver base tables, or a secure-view pattern? Pick after X2.
3. **Scope of datasets** — all 6 gold views for the UC policy, but Domo PDP only on the **5 federated** (forecast excluded)? Confirm.
4. **Enforcement honesty (R8)** — confirm we present in-app parity as *persona-predicate simulated* (service token) with OBO as the documented next step, unless we commit to Shape C.
5. **Entry order** — proceed to run **Spikes X1 + X2** now (read-only), then re-run the fit check and pick a shape?

---

## Next step

Recommend running **Spike X2 (UC row filter on views)** and **Spike X1 (Domo PDP API on federated datasets)** as read-only investigations, then re-rendering the fit check with resolved mechanisms so we can pick A vs B. No Databricks/Domo writes and no app changes until a shape is selected.
