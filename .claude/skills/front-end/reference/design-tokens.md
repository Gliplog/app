# Design tokens

Part of the `front-end` skill.

The palette is adapted from the Cognitive Companion design system: warm paper surfaces, a
sea-teal primary (the tide), terracotta accent, warm ink text, soft daylight shadows, calm motion. Tidebook
adds a warm-dark variant and a glass layer: the app bar, bottom navigation, rail, dialogs,
sheets, menus and snackbars are frosted (`backdrop-filter`) over a soft two-tone backdrop, and
cards are translucent paper with a lit top edge. Glass falls back to `--tb-surface` where
`backdrop-filter` is unsupported or the OS asks for reduced transparency.

## Files

| File                     | Holds                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| `public/layers.css`      | Cascade layer order, linked before any bundled CSS                                                     |
| `src/styles/tokens.css`  | Primitives (`--stone-*`, `--tide-*`, `--terra-*`), fonts, radii, motion; semantic tokens per theme     |
| `src/styles/theme.css`   | Global element styles and Vuetify overrides (`tb-theme` layer); utility classes (`tb-utilities` layer) |
| `src/plugins/vuetify.ts` | Vuetify `light` and `dark` theme colours mirroring the tokens                                          |

## Semantic tokens (both themes)

| Group        | Tokens                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Surfaces     | `--tb-bg`, `--tb-surface`, `--tb-surface-2`, `--tb-surface-sunk`                                                                 |
| Text         | `--tb-text-1` (primary), `--tb-text-2` (secondary), `--tb-text-3` (tertiary)                                                     |
| Brand        | `--tb-brand`, `--tb-brand-strong`, `--tb-brand-soft`, `--tb-brand-softer`, `--tb-accent`, `--tb-accent-soft`, `--tb-accent-line` |
| Lines        | `--tb-divider`, `--tb-divider-strong`                                                                                            |
| Status pairs | `--tb-{good,notice,alert,info}-{fg,bg}`                                                                                          |
| Shadows      | `--tb-shadow-{sm,md,lg,inset}`                                                                                                   |
| Glass        | `--tb-glass`, `--tb-glass-strong`, `--tb-glass-card`, `--tb-glass-{line,edge,sheen,shadow}`, `--tb-backdrop-{1,2}`               |
| Chart        | `--tb-chart-{logged,preview,trial,placebo,grid,axis,now}`                                                                        |
| Syringe      | `--tb-syringe-{barrel,ink,fill,fill-deep,glint,plunger}`                                                                         |

Theme-independent: `--tb-font`, `--tb-font-display`, `--tb-font-mono`, `--tb-radius-*`, `--tb-glass-blur`,
`--tb-dur-*`, `--tb-focus-ring`, `--tb-shadow-focus`, `--tb-touch`.

## Utility classes

| Class                                                   | Use                                          |
| ------------------------------------------------------- | -------------------------------------------- |
| `tb-page`                                               | Page container with responsive gutters       |
| `tb-eyebrow`                                            | Small tracked terracotta label above a title |
| `tb-display`                                            | Heading weight and tracking                  |
| `tb-muted`, `tb-faint`                                  | Secondary and tertiary text                  |
| `tb-num`, `tb-mono`                                     | Tabular figures                              |
| `tb-inset`                                              | Grouped panel inside a card                  |
| `tb-card-soft`, `tb-card-accent`                        | Teal or terracotta tinted card               |
| `tb-badge` + `tb-badge--{brand,good,notice,alert,info}` | Calm status pill; add `tb-badge__dot`        |

## Adding a colour

1. Add the token to both `.v-theme--light` and `.v-theme--dark` in `tokens.css`.
2. If it is text, add the pair to `scripts/check-contrast.mjs`. The checker reads only solid
   hex tokens; glass fills stay at 72% opacity or more so text keeps its contrast on them. The
   backdrop tint lowers light-mode contrast at the top left: `--tb-text-3` drops to about
   4.1:1 there, so faint text belongs inside cards, never on the bare page.
3. Write `-webkit-backdrop-filter` before `backdrop-filter`: the CSS minifier merges the pair
   and keeps the last one, and Chromium ignores the prefixed form.
4. If it is a chart series, validate the palette with the dataviz palette checker against both
   surfaces (lightness band, chroma, colour-blind separation) before use.
