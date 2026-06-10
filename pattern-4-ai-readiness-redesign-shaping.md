---
shaping: true
---

# AI Readiness Tab Redesign — Shaping

Scope: a deliberate visual/UX redesign of the AI Readiness tab in the Pattern 4 Revenue
Command Center pro-code app. Functionality is already live and must not change:
column-level + dataset-level Sync/Wipe (UC → Domo) and the governed "edit UC column
context" path all work end-to-end on `pattern4ce` v1.0.12 with the object payload
contract. This shaping covers **layout and interaction only**.

## Frame

- **Source** (user): "control-plane layout: dataset rail + focused detail panel;
  minimalistic pill Sync/Wipe controls with clear enabled/synced/disabled states; a
  single scannable column-by-column comparison table of UC-prepared vs Domo-synced +
  inline actions; honest 'UC prepared vs Domo synced' percentages; deep links to Domo
  /details/ai-readiness and the Databricks table; a distinct governed 'edit UC column
  context' path; visually consistent with the forecast hero/theme. This should emphasize
  unity catalog as the centralized source of truth and cannot be touched."
- **Problem**: The current tab is a dense grid-of-cards (left) + a cramped detail aside
  (right). It buries the column-by-column comparison, mixes the governed UC-edit path in
  with routine Sync/Wipe actions, and does not visually establish Unity Catalog as the
  authoritative source of truth.
- **Outcome**: A calm, scannable "control plane" that reads UC → Domo at a glance, makes
  per-column and per-dataset sync state obvious, and treats editing the UC source as a
  deliberate, governed exception.

## Hard Constraints (apply to every shape, not differentiating)

- **HC1 — CE contract frozen**: live functions stay exactly
  `getUcReadinessState` / `getDomoAiReadiness` / `syncDomoAiReadiness` /
  `wipeDomoAiReadiness` / `updateUcColumnContext` on v1.0.12 with object payloads
  (`desiredState: object`, `columns: object-list`). No new functions, no renamed params,
  no payload-shape changes. This is a front-end-only redesign.
- **HC2 — Honest state**: live Domo readiness always overrides local staged state after a
  successful read; never imply 100% when Domo has only a subset enabled.
- **HC3 — Theme**: Domo Blue dominant, orange secondary, Open Sans, dainty scale, the
  existing pill / card / shadow tokens. Databricks red used sparingly.

---

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | Redesign AI Readiness as a calm "control plane" — visually deliberate, less dense than the current grid-of-cards (visual/UX only) | Core goal |
| R1 | Establish Unity Catalog as the centralized, authoritative source of truth; UC → Domo is the sanctioned sync direction and is framed prominently | Must-have |
| R2 | Layout = a dataset rail/selector + a single focused detail panel | Must-have |
| R3 | Minimalistic pill-style controls for per-column **and** dataset-level Sync / Wipe, with clear enabled / synced / disabled states | Must-have |
| R4 | A single scannable column-by-column comparison table: column name, type, UC-prepared, Domo-synced, inline actions — easy to read across a dataset | Must-have |
| R5 | Honest status framing: "Unity Catalog metadata prepared" % vs "Domo AI Readiness synced" % (HC2) | Must-have |
| R6 | Deep links to the Domo AI Readiness page (`/details/ai-readiness`) and the Databricks table | Must-have |
| R7 | A distinct, governed "edit UC column context" path, visibly separated from "sync to Domo" (editing the source of truth is deliberate, with review/confirm) | Must-have |
| R8 | Visually consistent with the forecast hero and app theme (HC3) | Must-have |

---

## CURRENT: grid-of-cards + detail aside

| Part | Mechanism |
|------|-----------|
| CUR1 | Left column (1.35fr): `readiness-grid` of 5 dataset cards, each with title, context blurb, one UC-progress bar, and 3 metrics (UC cols ready, Domo synced %, UC tags) |
| CUR2 | Right aside (0.65fr): `readiness-detail` with dual UC/Domo score meters, a key-value block, 4 action buttons, and the column comparison table squeezed into the narrow aside |
| CUR3 | Per-column actions: `Sync` / `Wipe` / `Edit UC` mini-buttons inline in each table row; `Edit UC` uses `window.prompt` dialogs |
| CUR4 | Dataset-level: "Stage all column syncs" header button + "Sync all prepared columns" / "Wipe Domo readiness config" in the aside |

Pain: comparison table (the real content) lives in the cramped 0.65fr aside; cards waste
the wide column on low-information summaries; UC-edit is mixed in with Sync/Wipe and uses
raw prompts; UC-as-source-of-truth is not visually asserted.

---

## A: Source-of-truth rail + governed ledger (minimal restructure)

Flip the layout: slim dataset **rail** on the left, the column comparison **table** gets
the wide focused panel on the right. Keep inline row actions.

| Part | Mechanism |
|------|-----------|
| A1 | **Slim dataset rail** (left, ~260px): one row per dataset with a tiny dual meter (UC prepared % over Domo synced %) and a synced/partial/off dot; selected row highlighted |
| A2 | **Portfolio header** above the rail: "Unity Catalog · source of truth" lockup + one-line governance statement + overall prepared/synced rollup |
| A3 | **Focused detail panel** (right, wide): compact compare header (two horizontal meters: UC prepared %, Domo synced %), dataset deep-link pills (Domo AI Readiness, Databricks table), and one dataset-level **Sync all / Wipe all** pill pair |
| A4 | **Governed ledger table** fills the panel: row = column name+type, UC pill (Prepared / —), Domo pill (Synced / Not synced), context preview, inline **Sync · Wipe** pills (disabled states honored) |
| A5 | UC edit = a subtle per-row "Edit context" link behind a lock glyph, still using the existing prompt flow |

## B: Split-plane diff view (UC ⟷ Domo)

Make the comparison a true left-to-right **diff**: Unity Catalog plane (governed source)
on the left, Domo AI Readiness plane on the right, a center "sync gutter" per row.

| Part | Mechanism |
|------|-----------|
| B1 | **Horizontal dataset selector** (segmented pills across the top) instead of a rail |
| B2 | **Two-plane diff**: left = UC prepared metadata (context, synonyms, tags) read-mostly; right = Domo synced state; each column is one row spanning both planes |
| B3 | **Center sync gutter** per row: directional `Sync →` / `← Wipe` pill, reinforcing UC→Domo flow |
| B4 | **Drift header band**: "N prepared · M synced · K not yet synced" with the dual % |
| B5 | UC edit lives **inside the UC plane** as a governed inline edit (lock icon) — clearly on the source side |

## C: Hybrid — rail + governed table + UC inspector drawer

Shape A's rail + single governed table, plus a dedicated slide-in **UC inspector drawer**
that becomes the distinct, governed home for the "edit UC source metadata" path.

| Part | Mechanism |
|------|-----------|
| C1 | **Slim dataset rail** (= A1) + **portfolio source-of-truth header** (= A2) |
| C2 | **Focused detail panel** with compact dual-meter compare header, deep-link pills, and dataset-level **Sync all / Wipe all** pills (= A3) |
| C3 | **Single governed comparison table** (= A4): inline **Sync · Wipe** pills only; routine UC→Domo actions live here and stay scannable |
| C4 | **UC inspector drawer**: a column's "Inspect / Edit UC" opens a right-side drawer with full UC context (comment, synonyms, tags, type) and a clearly-labeled **"Update Unity Catalog source metadata"** governed action with an explicit confirm — replaces the raw `window.prompt` flow |
| C5 | Drawer makes the source-of-truth edit a deliberate, confirm-gated exception, visually distinct from Sync/Wipe |

---

## Fit Check

| Req | Requirement | Status | A | B | C |
|-----|-------------|--------|---|---|---|
| R0 | Redesign AI Readiness as a calm "control plane" — visually deliberate, less dense than the current grid-of-cards (visual/UX only) | Core goal | ✅ | ✅ | ✅ |
| R1 | Establish Unity Catalog as the centralized, authoritative source of truth; UC → Domo is the sanctioned sync direction and is framed prominently | Must-have | ✅ | ✅ | ✅ |
| R2 | Layout = a dataset rail/selector + a single focused detail panel | Must-have | ✅ | ❌ | ✅ |
| R3 | Minimalistic pill-style controls for per-column and dataset-level Sync / Wipe, with clear enabled / synced / disabled states | Must-have | ✅ | ✅ | ✅ |
| R4 | A single scannable column-by-column comparison table: column name, type, UC-prepared, Domo-synced, inline actions | Must-have | ✅ | ❌ | ✅ |
| R5 | Honest status framing: "Unity Catalog metadata prepared" % vs "Domo AI Readiness synced" % | Must-have | ✅ | ✅ | ✅ |
| R6 | Deep links to the Domo AI Readiness page and the Databricks table | Must-have | ✅ | ✅ | ✅ |
| R7 | A distinct, governed "edit UC column context" path, visibly separated from "sync to Domo" | Must-have | ❌ | ✅ | ✅ |
| R8 | Visually consistent with the forecast hero and app theme | Must-have | ✅ | ✅ | ✅ |

**Notes:**
- A fails R7: UC edit stays an inline per-row prompt blended with the Sync/Wipe actions — not a distinct, governed, confirm-gated path.
- B fails R2: uses a horizontal segmented selector, not a dataset rail.
- B fails R4: the split-plane diff is two-sided rather than a single scannable comparison table (the scope explicitly asks for one table).
- C passes all; it is A's clean rail + single-table layout plus a dedicated governed UC inspector drawer that satisfies R7 without cluttering the routine sync table.

---

## Recommendation

**Shape C** — it satisfies every requirement: the slim rail + wide single governed table
keep the routine UC→Domo sync calm and scannable (R2, R4), and the UC inspector drawer
makes editing the source of truth a deliberate, confirm-gated, visually distinct path
(R7) while replacing the current raw `window.prompt` UX. Shape A is the lighter-touch
fallback if you'd rather not build a drawer (accepting a weaker UC-edit path). Shape B is
viable if you specifically want a diff aesthetic, but it trades away the requested rail
and single-table layout.

## DECISION: Shape C selected (2026-06-10) — BUILT

User selected **Shape C**. Built front-end-only against the frozen CE contract (HC1).

### Detail C — built affordances

| Affordance | Where | Mechanism |
|------------|-------|-----------|
| Source-of-truth header | `#viewReadiness` head | "Unity Catalog · source of truth" tag (Databricks-red), governance one-liner |
| Portfolio rollup | `#readinessPortfolio` | Overall UC-prepared % + Domo-synced % meters across all 5 datasets (`renderReadinessPortfolio`) |
| Dataset rail | `#readinessRail` | One button per dataset: dual UC/Domo mini-meters + synced/partial/off dot (`renderReadinessRail`, `readinessRailState`) |
| Focused panel | `#readinessDetail` | Dataset header + UC table path, deep-link pills (Domo AI Readiness, Databricks table), dual compare meters, dataset-level Sync-all/Wipe-all pills, single governed column table (`renderReadinessDetail`) |
| Column table | inside panel | name+type, UC `state-pill`, Domo `state-pill`, source context, inline `pill-btn` Sync · Wipe · Inspect (disabled states honored) |
| UC inspector drawer | `#ucDrawer` + `#ucDrawerBackdrop` | Slide-in governed editor: UC path, meta, red governance warning, context/synonyms/AI-enabled fields, "Update Unity Catalog metadata" (calls `updateUcColumnContext`) + confirm/cancel + "Open in Databricks" (`openUcDrawer`/`saveUcColumnContext`/`closeUcDrawer`, Escape + backdrop close) |

### Theme cue

Unity Catalog meters/pills use **Databricks red** (source of truth); Domo AI Readiness
state uses **Domo blue**. This visually encodes UC → Domo direction without words.

### Validation (local, no publish)

- `node --check` clean on `src/app.js` and `dist/src/app.js`; `dist` mirrors `src`.
- All JS-referenced static IDs present in `index.html`.
- Headless Chrome render of `dist/index.html#readiness` confirms the control plane and the
  UC inspector drawer render correctly; no false-100% (portfolio honestly shows UC 90% /
  Domo 0% in mock/preview).
- No linter errors.
