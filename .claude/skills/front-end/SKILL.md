---
name: front-end
description: 'Use when changing gliplog Vue components, views, layout, Vuetify usage, styling, theming, charts, or user-facing copy.'
---

# Front-end

One-line rules; detail lives in `reference/`. Read a reference when its trigger applies:

| Read                         | When                                                   |
| ---------------------------- | ------------------------------------------------------ |
| `reference/design-tokens.md` | Writing any CSS, choosing a colour, theming, dark mode |
| `reference/components.md`    | Building a view, dialog, form, chart, or touch layout  |

## Styling

1. Colours come only from `--gl-*` tokens (`src/styles/tokens.css`) or Vuetify theme colours
   (`primary`, `secondary`, `success`, `warning`, `error`, `info`). No hex, `rgb()`, or Material
   names in components; `npm run check:tokens` enforces it and catches undefined tokens.
2. Two themes, `light` and `dark`, follow the device by default; Settings can pin one. Every new
   token is defined in both theme blocks, and text tokens pass `npm run check:contrast` (WCAG AA).
3. `theme.css` owns the look of app bar, navigation, cards, dialogs, fields, buttons and chips.
   Scoped styles are for layout and for drawing (SVG), never to restyle a Vuetify component.
4. Cascade layers: our theme sits above Vuetify components and below Vuetify utilities
   (`public/layers.css`). No `!important` outside the reduced-motion rule.
5. Typography: Hanken Grotesk throughout; headings (`gl-display` 700, card titles 600) use tight
   tracking. IBM Plex Mono or `gl-num` for figures. Use Vuetify 4 MD3 classes
   (`text-headline-large`). The brand is `AppLogo` (mark plus wordmark), never plain text.

## Layout and interaction

6. Phone first: one column, bottom navigation, 48 px touch targets, inputs at 16 px or larger
   (iOS zooms smaller ones). From 840 px: side rail and two-column views.
7. Respect safe areas (`env(safe-area-inset-*)`) because the app runs standalone on notched
   phones.
8. Presets are `PresetPicker` (chips plus custom entry), not ad-hoc chip groups. Button
   toggles carry `role="group"` and a visible label (`aria-labelledby`).
9. Destructive actions await `useConfirmStore().ask()`; feedback goes through
   `useNotifyStore().show()`; never a local `v-snackbar`.
10. Every chart has a text summary (`aria-label`) and a table view (or, for trial bars, a value
    in text on every row); series identity never relies on colour alone.
11. Charts use ECharts through `echarts/core` with only the parts registered; colours come from
    `useChartColors()`, never literals.

## Voice

12. Plain, warm and neutral: "Log a weight", "Since you started", never "lose", "goal crushed"
    or anything that praises or shames a number. Gains and losses are signed numbers, not
    colours. Trials are a reference, never a target.
13. Never tell the user what dose to take. Strengths and titration are "from the label"; the
    user's own prescriber decides.
14. Inclusive by default: every profile field optional, "Prefer not to say" and a free-text
    gender, no gendered imagery or pink and blue coding.
