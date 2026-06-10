---
shaping: true
---

# Lakebase Ops Redesign — Shaping

Tighten the Lakebase tab into a clear, compelling operational-state experience, connect
it to the ML Predictions flow, and add table editing à la the `lakebase explorer`
reference. Shaping only — no build until a shape is picked.

## Frame

- **Source** (user): "i'm not following the lakebase use case … I just accepted the
  prediction but i don't see anything changing. is this really the lakebase experience we
  need for our audience? if so, need to tighten this up significantly; when i click
  'accept' on the ml predictions tab it should then offer the ability to click into a
  seeded scenario with all inputs already inputted/defined for me to review on the lakebase
  tab. also, on the lakebase tab i want you to incorporate the ability to modify/input
  tables in lakebase e.g. /Users/cassidy.hilton/Cursor Projects/lakebase explorer."
- **Problem**: Today, accepting a prediction silently writes a feedback row — nothing
  visibly changes, so the audience can't see *why Lakebase matters*. The tab reads like a
  backend footnote and you can't actually edit Lakebase rows from it.
- **Outcome**: A presenter accepts a prediction, is offered a **seeded scenario** to
  review on the Lakebase tab (inputs + prediction pre-filled), and can **browse / add /
  edit / delete** rows in the Lakebase tables right there — making "app-owned OLTP state
  next to the lakehouse" tangible.

## Reference UX (`lakebase explorer`)

Per-table view: a toolbar (table name + row count, **Refresh**, **+ Add Row**), a full
table, inline **✎ Edit** / **✕ Delete** per row, a typed **RowForm** (text / number /
date / select), a delete **confirm** dialog, and success/error banners — all CRUD via
Code Engine → `databricks_postgres`.

## Live CE contract today (pattern4ce v1.0.12)

| Table | Available functions | Gap vs full CRUD |
| --- | --- | --- |
| `public.p4_scenario_runs` | listScenarios, createScenario, updateScenario, deleteScenario | none — full CRUD |
| `public.p4_prediction_feedback` | listPredictionFeedback, savePredictionFeedback (insert) | **no edit / no delete** |

Full generic table editing on **both** tables would need new CE functions (e.g.
`updatePredictionFeedback` / `deletePredictionFeedback`, or generic `insertRow/updateRow/
deleteRow`) — which requires a **gated pattern4ce release**.

---

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | Make Lakebase a clear, compelling operational-state layer the user actively creates and revisits — not a backend footnote | Core goal |
| R1 | ML Accept / Adjust / Reject captures the prediction **and** seeds a reviewable scenario (all ML inputs + predicted churn pre-filled) on the Lakebase tab | Must-have |
| R2 | From the ML tab, a clear affordance to jump to the seeded scenario on the Lakebase tab (something visibly changes) | Must-have |
| R3 | The Lakebase tab supports table editing — browse + add + edit + delete rows via a typed form, refresh, confirm — like `lakebase explorer` | Must-have |
| R4 | A crisp "why Lakebase" narrative: app-owned OLTP next to the lakehouse — low-latency, survives sessions, reverse-ETL-ready — distinct from governed analytic gold | Must-have |
| R5 | Honest live/preview state; live writes target `cobra-v1` (`public.p4_scenario_runs` / `public.p4_prediction_feedback`) | Must-have |
| R6 | Visually consistent with the app theme (tables, pills, typed forms, banners) | Must-have |
| R7 | Prefer the released pattern4ce **v1.0.12** contract; any new CE function is a gated release | Constraint |

---

## CURRENT

| Part | Mechanism |
|------|-----------|
| CUR1 | "Lakebase Operational State" header + status meta strip (project/db/tables/access/mode) |
| CUR2 | Scenario Runs table with full CRUD (+ Add Scenario, ✎ edit, ✕ delete) + selected-run JSON detail |
| CUR3 | Prediction Feedback = a read-only list + an explainer card; rows arrive only from ML Accept/Adjust/Reject |
| CUR4 | ML Accept/Adjust/Reject → `savePredictionFeedback` only (no scenario seeded, no visible change, no deep link) |
| CUR5 | No generic row editing of the feedback table; use case explained in prose |

---

## A: Explorer over the two tables — no CE release

| Part | Mechanism |
|------|-----------|
| A1 | Reframe the tab as a **table explorer**: a sub-selector for `p4_scenario_runs` / `p4_prediction_feedback`, each rendered as a `lakebase-explorer`-style table (row count, Refresh, + Add, inline ✎/✕, typed RowForm, confirm, banners) |
| A2 | Scenario Runs → full CRUD via existing create/update/deleteScenario |
| A3 | Prediction Feedback → list + Add via existing list/savePredictionFeedback; **Edit/Delete shown disabled** with a "needs a CE function" note (contract gap) |
| A4 | ML Accept/Adjust/Reject → `savePredictionFeedback` **and** `createScenario` seeded with the scored inputs (assumptions) + predicted churn (results); a toast "Saved to Lakebase — Review scenario →" deep-links to the tab and selects the new row |
| A5 | "Why Lakebase" explainer band (OLTP vs gold) |

## B: Full generic table CRUD — gated CE release

| Part | Mechanism |
|------|-----------|
| B1 | Add generic CE functions to `pattern4ce` (port `lakebaseQuery`'s `queryTable/insertRow/updateRow/deleteRow`, or table-specific `update/deletePredictionFeedback`); **release a new pattern4ce version** + rebind |
| B2 | Lakebase tab becomes a true generic explorer with **full CRUD parity** on both tables (and trivially extensible to more) |
| B3 | ML → scenario seeding + deep link (= A4) |
| B4 | "Why Lakebase" explainer band (= A5) |

## C: Ship A now + scoped CE follow-on (recommended)

| Part | Mechanism |
|------|-----------|
| C1 | Build **Shape A** now (explorer UX, full scenario CRUD, feedback list+add, ML→scenario seeding + deep link, narrative) — zero CE release |
| C2 | **Stage but do not release** the small CE additions for feedback edit/delete (and optional generic row ops); ship them on your explicit approval to reach full parity |
| C3 | Until that release, feedback Edit/Delete render disabled with a clear "approve CE release to enable" affordance |

---

## Fit Check

| Req | Requirement | Status | A | B | C |
|-----|-------------|--------|---|---|---|
| R0 | Compelling operational-state layer, actively created/revisited | Core goal | ✅ | ✅ | ✅ |
| R1 | ML Accept/Adjust/Reject seeds a reviewable scenario (inputs + prediction) | Must-have | ✅ | ✅ | ✅ |
| R2 | Affordance to jump to the seeded scenario (something visibly changes) | Must-have | ✅ | ✅ | ✅ |
| R3 | Lakebase tab supports browse + add + edit + delete (typed form, refresh, confirm) | Must-have | ❌ | ✅ | ✅ |
| R4 | Crisp "why Lakebase" narrative (OLTP vs governed gold) | Must-have | ✅ | ✅ | ✅ |
| R5 | Honest live/preview state targeting cobra-v1 | Must-have | ✅ | ✅ | ✅ |
| R6 | Visually consistent with the app theme | Must-have | ✅ | ✅ | ✅ |
| R7 | Prefer released v1.0.12; new CE is a gated release | Constraint | ✅ | ❌ | ✅ |

**Notes:**
- A fails R3: the feedback table can't be edited/deleted on v1.0.12 (no CE function), so it isn't full table CRUD.
- B fails R7: full parity requires releasing a new pattern4ce version before it works.
- C satisfies both: ships the full experience now (full CRUD on scenarios + ML seeding + explorer UX) with feedback edit/delete staged behind one approved CE release — so R3 reaches full parity on your "release", with no surprise releases.

---

## Recommendation

**Shape C.** It makes the demo compelling immediately (accept a prediction → a seeded
scenario you can open and review on Lakebase; full add/edit/delete on scenario runs in a
`lakebase-explorer`-style table; a clear "why Lakebase" story) without any unapproved Code
Engine release. The only thing gated behind your "release" is edit/delete on the
prediction-feedback table — staged and ready. Pick **A** if you want zero CE work even as
a follow-on (accepting that feedback rows are add-only), or **B** if you want full generic
CRUD parity now and are happy to approve a pattern4ce release as part of this.

Next step after a pick: breadboard the chosen shape, build front-end (+ staged CE for C),
validate `dist` locally.
