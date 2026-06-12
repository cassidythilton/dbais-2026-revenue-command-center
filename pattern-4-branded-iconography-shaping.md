---
shaping: true
---

# Pattern 4 — Branded Iconography System — Shaping

## Source (verbatim)

> i have all the perfectly branded logos and icons that we need for this app to really pop for a
> databricks audience (see attached). i would like to incorporate these into the most appropriate
> areas of the app. does this merit a shaping exercise? … svg so you can recolor and resize as you need.

> the direct usage of the [Domo+Databricks] image looks terrible. how can we remedy?

## Problem

The app uses hand-drawn inline SVG glyphs everywhere (How It Works architecture tiles, the Action
Journey timeline, lineage cards, ML/Genie/AI-Readiness tabs). For a Databricks audience they read as
generic. We now have official Databricks product SVGs + a Domo+Databricks lockup and want them in the
right places — without breaking legibility (light tiles vs dark plane headers) or brand integrity, and
with a clean fallback where no brand asset exists yet.

## Outcome

The app "pops" for a Databricks crowd: real product marks appear exactly where they mean something,
crisp at every size, legible on light and dark, with a reusable mechanism and a graceful glyph fallback
for concepts that have no brand asset.

---

## Asset inventory (`pattern4-agent-portal/public/brand/`)

| File | Mark | Notes |
|------|------|-------|
| `unity-catalog-logo.svg` | Unity Catalog | full-color red gradient, ~square (58×59), transparent |
| `delta-lake-logo.svg` | Delta Lake | full-color official icon |
| `mlflow-logo.svg` | MLflow | full-color official icon |
| `dbx-sql-logo.svg` | Databricks SQL | full-color official icon |
| `spark-logo.svg` | Apache Spark | full-color official icon |
| `domo-databricks-logo.svg` | Domo + Databricks lockup | 2:1 horizontal; Databricks `#B93125` + Domo `#99CCEE`; transparent |
| `dbx-domo-logo.png` | (old raster) | superseded by the SVG; remove from use |

**Key properties:** these are **full-color** marks (red/peach gradients) — best used *as-is* on light
surfaces; they are not single-fill `currentColor` icons, so "recolor to blood red" = per-icon gradient
edits (avoid unless needed). The set is **partial** — see Gaps.

---

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | Incorporate the official Databricks SVGs (+ Domo lockup) into the most appropriate areas, replacing generic inline glyphs where a real product mark exists. | Core goal |
| R1 | **Right mark → right concept** — Unity Catalog, Delta Lake, MLflow, Databricks SQL, Spark, and the Domo+Databricks lockup map only to the areas that mean that thing; no mismatches. | Must-have |
| R2 | **Legible on every surface** it lands on — light tiles/discs AND the dark plane headers in How It Works; crisp from ~16px to ~48px. | Must-have |
| R3 | **Brand integrity** — full-color official icons used as-is (correct aspect, transparent, no distortion/arbitrary re-tint). | Must-have |
| R4 | **Reusable mechanism + graceful fallback** — a small concept→asset registry + marker component; concepts with no brand asset keep today's inline glyph so partial coverage looks intentional. | Must-have |
| R5 | **Fix the Agent ⇄ Agent marker** — the lockup is a wide 2:1 mark with a low-contrast Domo blue; it needs a treatment that fits its placement (round node vs header/footer). | Must-have |
| R6 | **No regressions, UI-only, no CE release** — assets served from `public/brand/`, mirrored to `dist/public/brand/`; validated + lints clean. | Must-have |
| R7 | **Name the gaps** — list concepts with no brand asset yet so more can be exported (or the glyph stays). | Must-have |

---

## Icon → area map (the meat)

| App area | Element | Today (glyph) | Proposed mark |
|----------|---------|---------------|---------------|
| How It Works · Databricks plane | "Unity Catalog" tile | `data` | **unity-catalog** |
| How It Works · Databricks plane | "Delta gold views" tile | `dataset` | **delta-lake** |
| How It Works · Databricks plane | "Model Serving + MLflow" tile | `model` | **mlflow** |
| How It Works · Databricks plane | "Genie Space" tile | `genie` | *(glyph — no asset)* |
| How It Works · Databricks plane | "Agent Bricks Supervisor" tile | `agent` | *(glyph — no asset)* |
| How It Works · Databricks plane | "Lakebase" tile | `lakebase` | *(glyph — no asset)* |
| How It Works · Databricks plane | "Unity AI Gateway" tile | `gateway` | *(glyph — no asset)* |
| How It Works · Sources & ingestion | "Synthetic generator (Spark + Faker)" | `data` | **spark** |
| How It Works · Interop | "Cloud Amplifier" / federation | `sync` | **dbx-sql** (federated read against DBSQL) — or glyph |
| How It Works · Domo plane | "Federated DataSets" | `dataset` | **delta-lake** (source) or glyph |
| Governed Data Lineage | UC source-table cards | (dbx mark png) | **unity-catalog** / **delta-lake** |
| ML Predictions tab | model/payload headers | `model` | **mlflow** |
| AI Readiness tab | UC source-of-truth | (varies) | **unity-catalog** |
| Genie tab | workspace header | `genie` | *(glyph — no asset)* |
| Action Journey | step 1 (Databricks rec) / step 6 (UC writeback) | databricks logo | **unity-catalog** (writeback) / keep databricks layers |
| Action Journey | step 5/Model | `model` | **mlflow** |
| Action Journey **header** / app **footer** | "Build with Databricks · Deliver with Domo" | text | **domo-databricks-logo** lockup (its 2:1 shape shines here) |

---

## CURRENT

Single `ICONS` object of inline SVG glyphs, referenced by key across `renderArchitecture`,
`journeyNodeHtml`, lineage, ML, Genie, AI-Readiness. Brand logos are ad-hoc `<img>` tags
(`databricks-logo.png`, `domo-logo.png`) in a few spots. No registry, no light/dark treatment system.

## A: 1:1 swap, full-color, light surfaces only

| Part | Mechanism |
|------|-----------|
| A1 | Add the brand SVGs to the `ICONS`-style lookup; swap glyph→brand where a concept matches |
| A2 | Use full-color on light tiles/discs; **leave dark plane headers on the existing white glyphs** (don't put red icons on dark) |
| A3 | Agent ⇄ Agent: keep robot glyph; put the lockup in the footer only |

## B: Icon registry + adaptive treatment (recommended)

| Part | Mechanism |
|------|-----------|
| B1 | `BRAND_ICONS` registry: concept-key → `public/brand/*.svg`; a `marker(key, {size})` helper returns a brand `<img>` if present, else the inline glyph (fallback) |
| B2 | **Adaptive surface treatment:** on light surfaces render the full-color SVG directly; on the **dark plane headers**, render it on a small rounded **light chip** so the red mark stays legible (brand-safe, no recolor) |
| B3 | Apply across How It Works tiles, ingestion strip, lineage, ML, AI-Readiness, and Action Journey per the map |
| B4 | Agent ⇄ Agent: round node keeps a clean glyph; the **lockup** goes in the Action Journey header + app footer (horizontal placements that fit 2:1) |
| B5 | Remove the raster `dbx-domo-logo.png` usage; standardize on the SVG lockup |

## C: Unified "brand chip" system

| Part | Mechanism |
|------|-----------|
| C1 | Wrap every architecture/journey marker in a consistent rounded chip (light plate) holding a brand SVG or glyph |
| C2 | One treatment everywhere (light chip) regardless of plane → maximal consistency, bigger visual redesign of the diagram |
| C3 | Same registry + fallback as B |

---

## Fit Check

| Req | Requirement | Status | A | B | C |
|-----|-------------|--------|---|---|---|
| R0 | Incorporate official SVGs into the right areas | Core goal | ✅ | ✅ | ✅ |
| R1 | Right mark → right concept | Must-have | ✅ | ✅ | ✅ |
| R2 | Legible on light AND dark surfaces | Must-have | ❌ | ✅ | ✅ |
| R3 | Brand integrity (full-color, no distortion) | Must-have | ✅ | ✅ | ✅ |
| R4 | Registry + graceful glyph fallback | Must-have | ❌ | ✅ | ✅ |
| R5 | Agent ⇄ Agent marker fixed appropriately | Must-have | ✅ | ✅ | ✅ |
| R6 | UI-only, no CE release, dist mirrored | Must-have | ✅ | ✅ | ✅ |
| R7 | Gaps named | Must-have | ✅ | ✅ | ✅ |

**Notes**
- **A fails R2/R4:** no dark-header treatment (Databricks-plane header stays un-branded) and no registry/fallback structure — partial coverage looks accidental.
- **C** satisfies everything but is a larger redesign of the diagram (re-plating every marker); more change/risk than needed.
- **B** satisfies all requirements with the least disruption: registry + fallback + a light-chip treatment only where the surface is dark.

## Recommendation: **Shape B**

Registry + adaptive treatment + lockup in horizontal placements. Fastest path that stays brand-safe and
consistent, with a clean glyph fallback for the gaps.

---

## Agent ⇄ Agent remedy (sub-decision under R5)

The `domo-databricks-logo.svg` lockup is **2:1 horizontal** with a low-contrast Domo blue (`#99CCEE`) —
it does not fit a 42px round node (why the raster looked like a sticker). Resolution:
- **Round node:** keep a clean single glyph (robot) — or a composed Databricks-mark + Domo-mark if you
  export standalone square marks.
- **Lockup placement:** Action Journey header (beside "Action Journey · …") and/or the app footer
  ("Build with Databricks · Deliver with Domo"), where a wide lockup looks intentional and premium.

---

## Decision (2026-06-11) — Shape B BUILT (round 1)

User picked **Shape B**; gaps fall back to the **platform main logo** (Databricks/Domo), not a glyph.
Implemented (UI-only, no CE release):
- `BRAND_ICONS` registry + `markerHtml(brandKey, glyphKey, imgCls, glyphCls)` helper (brand `<img>` when a
  key resolves, else inline glyph).
- **How It Works · Solution Architecture** tiles + **Sources & ingestion** strip now render brand marks:
  Unity Catalog → `unity-catalog`, Delta gold views / Federated DataSets → `delta-lake`/`domo`,
  Model Serving + MLflow / ML Predictions → `mlflow`, Synthetic generator → `spark`, AI Readiness →
  `unity-catalog`, External lineage → `unity-catalog`; Databricks gaps (Genie, Agent Bricks, Lakebase,
  Unity AI Gateway) → **Databricks** main logo; Domo concepts (Cloud Amplifier, Code Engine, App Studio,
  Workflow, Approvals, AI Agent tile, PDP) → **Domo** main logo. Shared Identity stays a glyph (abstract).
- **Action Journey** nodes: step 1 → Databricks, step 2 → Domo, step 6 → Unity Catalog (per-step brand
  override supported via `s.brand`); the **Agent ⇄ Agent** node uses the **combined Domo + Databricks
  lockup on a neutral gray disc** (the transparent SVG avoids the earlier dark-PNG "sticker" problem; the
  lockup renders wider since it's 2:1); the human steps keep the person glyph.
- **App footer** also carries the `domo-databricks-logo.svg` lockup (its 2:1 shape fits there).
- **MLflow SVG** re-exported by the user (cropping fix) and re-synced to `dist`.
- Assets served from `public/brand/`, mirrored to `dist/public/brand/`. `node --check` + lints clean.
- Trade-off noted to user: Databricks gaps repeat the same main logo on a few tiles; easy to swap to
  distinct glyphs or specific official icons once exported.

## Gaps — assets that would complete the set (export if you want them branded)

Added 2026-06-11 (round 2): **Genie**, **Agent Bricks**, **Lakebase** — mapped to their tiles.

Added 2026-06-11 (round 3): **ai-gateway** (sparkle — used for both Unity AI Gateway tiles and available
as a generic AI mark), **domo-workflows**, **domo-ai-agent**, **domo-pdp**, **domo-pro-code**,
**domo-mcp-integrations**, **domo-cloud-amplifier**. Remapped: Pro-code App → domo-pro-code, Domo Workflow
+ approvals → domo-workflows, AI Agent tile → domo-ai-agent, Domo PDP → domo-pdp, Cloud Amplifier
(plane + ingestion) → domo-cloud-amplifier, Unity AI Gateway (both) → ai-gateway. **Renamed "Code Engine
(pattern4ce)" → "MCP Integrations"** (generic, MCP-direction) with `domo-mcp-integrations`. Journey: rec →
agent-bricks, workflow → domo-workflows.

Now only on a generic fallback (no dedicated mark): **Federated DataSets** + **Approvals · Action Center**
(Domo main logo) and **Shared Identity** (glyph — abstract). Still missing if you want them: **Medallion
architecture**, and standalone square Databricks/Domo marks.
