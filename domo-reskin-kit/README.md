# Domo Reskin Kit

Everything your coding agent needs to reskin an app to match the Domo design
system — same look, feel, branding, typography, and iconography. This is the
generic, Domo-only kit (no partner co-branding).

## How to use it

1. Drop this `domo-reskin-kit/` folder into your app's repo (or somewhere your
   agent can read it).
2. Open `RESKIN-PROMPT.md`, fill in the two bracketed lines (your app name +
   path), and paste the whole prompt block into your coding agent.
3. Let it read the references and pull the real assets, then review its plan.

## What's inside

```
domo-reskin-kit/
├── README.md                   ← you are here
├── RESKIN-PROMPT.md            ← the prompt to paste into your agent
├── references/
│   ├── domo-styleguide.mdc     ← official Domo brand rules (highest authority)
│   ├── design-tokens.css       ← canonical :root tokens — copy into your app
│   ├── styles.css              ← full component CSS (the pattern library)
│   ├── reference-dashboard.html← the design system applied end-to-end (match this bar)
│   └── analyzer.html           ← native Domo Analyzer chrome (look/feel reference)
├── assets/
│   ├── logos/                  ← Domo mark + app icon
│   └── brand/                  ← approved Domo product SVGs (Workflows, PDP, etc.)
└── screenshots/                ← (optional) drop rendered reference screens here
```

## The one rule that matters most

**No emojis. Ever.** Icons are either inline line/typeface SVG icons (the style
used in `styles.css` and `reference-dashboard.html`) or the approved Domo brand
SVGs in `assets/brand/`. This is spelled out in detail in `RESKIN-PROMPT.md` —
don't strip it out.

## Brand quick reference

- Domo Blue `#99CCEE` is dominant. Orange `#FF9922` is secondary. All other
  accents (violet `#776CB0`, sage `#ADD4C1`) are used sparingly and must never
  overpower Domo Blue.
- Neutrals: `#F1F6FA`, `#DCE4EA`, `#B7C1CB`, `#68737F`, `#3F454D`.
- Typography: Open Sans (Bold for titles, Light for subtitles, Regular for body)
  for UI; Roboto Mono for code/IDs/numbers.
- Flat panels, hairline borders, small radii, elevation only for overlays.

Full details live in `references/domo-styleguide.mdc` and
`references/design-tokens.css`.
