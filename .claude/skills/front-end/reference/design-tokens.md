# Design tokens

Part of the `front-end` skill.

The palette is adapted from the Cognitive Companion design system: warm paper surfaces, a
sea-teal primary, terracotta accent, warm ink text, soft daylight shadows, calm motion. Gliplog
adds a warm-dark variant and a glass layer: the app bar, bottom navigation, rail, dialogs,
sheets, menus and snackbars are frosted (`backdrop-filter`) over a soft two-tone backdrop, and
cards are translucent paper with a lit top edge. Glass falls back to `--gl-surface` where
`backdrop-filter` is unsupported or the OS asks for reduced transparency.

## Files

| File                     | Holds                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| `public/layers.css`      | Cascade layer order, linked before any bundled CSS                                                     |
| `src/styles/tokens.css`  | Primitives (`--stone-*`, `--teal-*`, `--terra-*`), fonts, radii, motion; semantic tokens per theme     |
| `src/styles/theme.css`   | Global element styles and Vuetify overrides (`gl-theme` layer); utility classes (`gl-utilities` layer) |
| `src/plugins/vuetify.ts` | Vuetify `light` and `dark` theme colours mirroring the tokens                                          |

## Semantic tokens (both themes)

| Group        | Tokens                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Surfaces     | `--gl-bg`, `--gl-surface`, `--gl-surface-2`, `--gl-surface-sunk`                                                                 |
| Text         | `--gl-text-1` (primary), `--gl-text-2` (secondary), `--gl-text-3` (tertiary)                                                     |
| Brand        | `--gl-brand`, `--gl-brand-strong`, `--gl-brand-soft`, `--gl-brand-softer`, `--gl-accent`, `--gl-accent-soft`, `--gl-accent-line` |
| Lines        | `--gl-divider`, `--gl-divider-strong`                                                                                            |
| Status pairs | `--gl-{good,notice,alert,info}-{fg,bg}`                                                                                          |
| Shadows      | `--gl-shadow-{sm,md,lg,inset}`                                                                                                   |
| Glass        | `--gl-glass`, `--gl-glass-strong`, `--gl-glass-card`, `--gl-glass-{line,edge,sheen,shadow}`, `--gl-backdrop-{1,2}`               |
| Chart        | `--gl-chart-{logged,preview,trial,placebo,grid,axis,now}`                                                                        |
| Syringe      | `--gl-syringe-{barrel,ink,fill,fill-deep,glint,plunger}`                                                                         |

Theme-independent: `--gl-font`, `--gl-font-display`, `--gl-font-mono`, `--gl-radius-*`, `--gl-glass-blur`,
`--gl-dur-*`, `--gl-focus-ring`, `--gl-shadow-focus`, `--gl-touch`.

## Utility classes

| Class                                                   | Use                                          |
| ------------------------------------------------------- | -------------------------------------------- |
| `gl-page`                                               | Page container with responsive gutters       |
| `gl-eyebrow`                                            | Small tracked terracotta label above a title |
| `gl-display`                                            | Heading weight and tracking                  |
| `gl-muted`, `gl-faint`                                  | Secondary and tertiary text                  |
| `gl-num`, `gl-mono`                                     | Tabular figures                              |
| `gl-inset`                                              | Grouped panel inside a card                  |
| `gl-card-soft`, `gl-card-accent`                        | Teal or terracotta tinted card               |
| `gl-badge` + `gl-badge--{brand,good,notice,alert,info}` | Calm status pill; add `gl-badge__dot`        |

## Adding a colour

1. Add the token to both `.v-theme--light` and `.v-theme--dark` in `tokens.css`.
2. If it is text, add the pair to `scripts/check-contrast.mjs`. The checker reads only solid
   hex tokens; glass fills stay at 72% opacity or more so text keeps its contrast on them. The
   backdrop tint lowers light-mode contrast at the top left: `--gl-text-3` drops to about
   4.1:1 there, so faint text belongs inside cards, never on the bare page.
3. Write `-webkit-backdrop-filter` before `backdrop-filter`: the CSS minifier merges the pair
   and keeps the last one, and Chromium ignores the prefixed form.
4. If it is a chart series, validate the palette with the dataviz palette checker against both
   surfaces (lightness band, chroma, colour-blind separation) before use.
