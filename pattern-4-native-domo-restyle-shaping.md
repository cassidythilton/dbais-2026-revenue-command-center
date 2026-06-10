---
shaping: true
---

# Native-Domo Restyle — Shaping

Bring the Revenue Command Center's look & feel closer to a **native Domo** aesthetic
(per `analyzer.html` + `domo-styleguide.mdc`) while preserving its current elegance and the
collaborative **Databricks** design. Shaping only — no build until a shape is picked.

## Frame

- **Source** (user): "i really like the design and overall look feel … i'd like to maintain
  its elegance and excellence but bring it closer to a 'native domo' look and feel (while
  maintaining the collaborative databricks design). See analyzer.html and
  domo-styleguide.mdc … tease apart the finer details and requirements of this delicate
  task. Note, there's a separate agent working on Live Domo Agent Catalyst / Workflow and
  Unity AI Gateway/OBO separately."
- **Problem**: The app today reads as a polished, *branded cockpit* — rounded cards (12px),
  soft layered shadows, Domo-blue-tinted surfaces, gradients. Beautiful, but a notch more
  "designed dashboard" than the flat, hairline, dense, neutral **Domo Analyzer** surface.
- **Outcome**: The app feels like it belongs inside Domo (analyzer-grade flatness,
  hairlines, Open Sans + mono, restrained color, business-user density) — without losing
  its current refinement or the Databricks co-brand.

## What "native Domo" means here (extracted from analyzer.html)

| Trait | Analyzer reference | App today |
|------|--------------------|-----------|
| Surfaces | Flat white, **1px hairline** borders (`rgba(0,0,0,.1/.15)`), little/no drop shadow | Rounded 12px cards + layered soft shadows |
| Radius | Small (3–6px) | 9–12px |
| Type | Open Sans (700 titles / light subs / 400 body) **+ Roboto Mono** for technical strings | Open Sans + SF Mono; weights vary |
| Neutrals | Monochrome `rgba(0,0,0,x)` + Domo neutrals | Domo neutrals (already aligned) |
| Accent | Restrained blue icons; **black** primary buttons / underline active tabs; sparing cyan band | Domo Blue dominant; softened Databricks red for UC; pill tabs |
| Density | Tight (12px workhorse, 24px rows, count-badge section heads, chevrons) | "Dainty" but airier |
| Components | Light blue/green pill chips, summary big-number rows, flat inputs, section heads w/ count badges | Cards, gradient hero, gauge (already analyzer-like) |

Note: the analyzer's collaborative accent was **Snowflake cyan**; our equivalent is the
**Databricks** red/lakehouse — kept as the sparing collaboration accent.

---

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | Shift look & feel closer to native Domo (analyzer + styleguide) while preserving current elegance/excellence | Core goal |
| R1 | Adopt native-Domo chrome: flat surfaces, 1px hairline borders, minimal shadow, smaller radii | Must-have |
| R2 | Typography per styleguide/analyzer: Open Sans (bold titles / light subs / regular body) + Roboto Mono for technical strings (UC tables, SQL, IDs, payloads) | Must-have |
| R3 | Color discipline: Domo neutrals base, **Domo Blue (#99CCEE) primary and never overpowered**, Databricks red/lakehouse retained but sparing | Must-have |
| R4 | Tune density/scale toward the analyzer (12px workhorse, count-badge section heads) without hurting business-user readability | Must-have |
| R5 | Restyle only — preserve current IA, layouts, and all functionality (Forecast, ML, Lakebase, UC AI Readiness, Genie, How It Works) | Must-have |
| R6 | Keep the Databricks collaboration visible & elegant (co-brand lockup, lakehouse mark, governed accents) | Must-have |
| R7 | Minimize churn/conflict with the parallel agent (Agent Catalyst/Workflow on the Agent Action Queue; Unity AI Gateway/OBO on Genie/model) — prefer global token/CSS changes; don't restructure those surfaces' markup/logic | Constraint |
| R8 | Front-end only (CSS/markup); no Code Engine release; no publish; validate `dist` locally | Constraint |

---

## CURRENT

Domo-blue-dominant cockpit: `:root` design tokens (Domo blue, neutrals, softened
Databricks red), 12px rounded cards with `--shadow-sm/md/lg`, pill view-tabs, gradient
forecast hero, SF-Mono for code, the Context Length gauge (already analyzer-style). Brand-
compliant and elegant, but flatter/denser than the analyzer.

---

## Component sub-decision — primary accent (pick one)

| Req | Requirement | X-A: Domo Blue primary | X-B: Analyzer black/neutral primary | X-C: Hybrid (flat chrome + Domo-blue accent) |
|-----|-------------|:---:|:---:|:---:|
| R3 | Domo Blue primary, never overpowered | ✅ | ❌ | ✅ |
| native-Domo analyzer feel | ⚠️ partial | ✅ | ✅ |

- X-A keeps everything Domo-blue (most brand-safe, least analyzer-like).
- X-B uses the analyzer's **black** primary buttons + black underline tabs — most "analyzer," but **violates** the brand rule that Domo Blue must never be overpowered.
- **X-C (recommended): neutral/ink analyzer chrome (hairlines, flat panels, underline tabs) with Domo Blue as the primary action + active accent** — analyzer flatness *and* brand compliance.

---

## A: Token refresh (light)

| Part | Mechanism |
|------|-----------|
| A1 | Rework `:root` tokens: hairline border vars, reduce shadow tokens to near-flat, smaller radii (`--r-*`), confirm Domo-neutral mapping |
| A2 | Add **Roboto Mono** (with SF-Mono fallback) and apply to technical strings via existing mono usages |
| A3 | Tighten type weights/sizes to styleguide (bold titles, light subs) globally |
| A4 | Components inherit via variables; no per-component restructuring |

## B: Analyzer component adoption (medium) — recommended

| Part | Mechanism |
|------|-----------|
| B1 | A1–A3 (token + type + mono foundation) |
| B2 | Flatten panels/cards to hairline surfaces (drop layered shadows; 1px borders; smaller radius) |
| B3 | View-tabs → analyzer style (segment/underline active) keeping the full-width bar |
| B4 | Section heads with **count badges + chevrons**; light blue/green pill chips; flat inputs/selects; summary big-number rows where they fit |
| B5 | Buttons → flat; primary = Domo Blue (per X-C); Databricks-red reserved for UC/source-of-truth cues |
| B6 | Keep IA, layouts, charts, gauge, drawers intact (restyle, not re-layout) |

## C: Analyzer-grade system (heavy)

| Part | Mechanism |
|------|-----------|
| C1 | B1–B6 |
| C2 | Deeper structural alignment to the analyzer frame (unified toolbars, shared component kit, consistent left-rail/detail treatments) across all tabs |
| C3 | Highest fidelity to native Domo; touches the most shared files (more coordination/conflict risk with the parallel agent per R7) |

---

## Fit Check

| Req | Requirement | Status | A | B | C |
|-----|-------------|--------|---|---|---|
| R0 | Closer to native Domo while preserving elegance | Core goal | ✅ | ✅ | ✅ |
| R1 | Flat surfaces / hairlines / minimal shadow / smaller radii | Must-have | ⚠️→❌ tokens only | ✅ | ✅ |
| R2 | Open Sans + Roboto Mono for technical strings | Must-have | ✅ | ✅ | ✅ |
| R3 | Domo neutrals + Domo Blue primary (never overpowered) + sparing Databricks red | Must-have | ✅ | ✅ | ✅ |
| R4 | Analyzer density (count-badge section heads, etc.) | Must-have | ❌ | ✅ | ✅ |
| R5 | Restyle only; preserve IA/layout/function | Must-have | ✅ | ✅ | ⚠️ structural risk |
| R6 | Databricks collaboration kept elegant | Must-have | ✅ | ✅ | ✅ |
| R7 | Minimize conflict with the parallel agent | Constraint | ✅ | ✅ | ❌ most churn |
| R8 | Front-end only; no CE release; no publish | Constraint | ✅ | ✅ | ✅ |

**Notes:**
- A fails R1/R4: token-only refinements flatten the palette but don't deliver the analyzer's hairline chrome or count-badge density (no component restyle).
- C risks R5/R7: structural re-frames can disturb IA and collide with the parallel agent's edits to the Agent Action Queue / Genie surfaces.
- B (with accent **X-C**) hits every requirement: analyzer-flat chrome + mono + density, Domo-blue primary (brand-safe), Databricks collaboration intact, mostly global CSS + light markup (low conflict).

---

## Recommendation

**Shape B + accent X-C.** It's the sweet spot: the app gains the native-Domo analyzer feel
(flat hairline surfaces, Open Sans + Roboto Mono, count-badge section heads, flat
inputs/tabs, restrained color) while staying brand-compliant (Domo Blue primary, never
overpowered), keeping the Databricks co-brand, and preserving all IA/layout/function. It's
almost entirely `styles.css` token + component work plus light `index.html` class tweaks —
low risk and low conflict with the parallel Agent Catalyst/Gateway workstream.

Pick **A** for the lightest touch (palette/type only), or **C** for full analyzer fidelity
if you accept structural churn and tighter coordination with the other agent.

### After a pick
Breadboard the concrete token + component changes, then build **incrementally per tab** with
a headless-render check after each, coordinating edits to the shared files (`styles.css`,
`index.html`, `src/app.js`) with the parallel agent (ideally land this restyle in focused
commits so it rebases cleanly against their Agent Catalyst/Gateway changes).
