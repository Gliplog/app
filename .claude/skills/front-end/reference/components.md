# Components and views

Part of the `front-end` skill.

## Shared components

| Component                                             | Use                                                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `common/PresetPicker.vue`                             | Number input as preset chips plus a Custom field; chips are buttons with `aria-pressed` |
| `common/SourceBadge.vue`                              | Shows where a number came from (label, trial, standard, model)                          |
| `common/SourceList.vue`                               | A list of sources, each with its badge and a link                                       |
| `common/ListPager.vue`, `SortToggle.vue`              | Range caption and `v-pagination` (hidden on one page); newest or oldest first toggle    |
| `common/AppLogo.vue`                                  | The brand: mark (`src/assets/brand/gliplog-mark.svg`) plus the two-tone wordmark        |
| `common/AppSnackbar.vue`, `AppConfirm.vue`            | Render the notify and confirm stores; mounted once in `App.vue`                         |
| `common/UpdatePrompt.vue`                             | Service-worker update and offline-ready notices                                         |
| `common/DisclaimerDialog.vue`                         | First-run acknowledgement: a journal, not medical advice                                |
| `journal/MedicationDialog.vue`                        | Add or edit a medication: product, interval, compounded vial strength, own half-life    |
| `journal/LogDoseDialog.vue`                           | Log or edit a dose: label strengths, syringe units for a vial, site rotation            |
| `journal/LogWeightDialog.vue`                         | Log or edit a weigh-in in kg or lb                                                      |
| `journal/LogSymptomDialog.vue`                        | Log one or more side effects at one strength, or edit one entry                         |
| `journal/LogGlucoseDialog.vue`                        | Log or edit an HbA1c result or a glucose reading (with when in the day)                 |
| `journal/MedicationStack.vue`                         | Today's stacked medication cards: swipe, arrows, dots or arrow keys; back cards inert   |
| `journal/SymptomSummaryCard.vue`                      | Side effects by period, strength and days after a dose; opens the PDF export            |
| `charts/CohortChart.vue`                              | One medicine's trial readouts merged over weeks (band and points), your line, a table   |
| `charts/CohortSection.vue`                            | Progress cohort section: medication, measure and population switches, trial cards       |
| `charts/TrendCard.vue`                                | Weight, BMI, HbA1c and glucose over time in one card, with a share button               |
| `charts/bodyChart.ts`                                 | The body-measure chart option, shared by `BodyChart` and share images                   |
| `share/ShareImageDialog.vue`                          | Preview and share an image card (content or a render function); privacy in its slot     |
| `share/ShareTrendDialog.vue`, `ShareLevelsDialog.vue` | Image cards for a trend (numbers off by default) and estimated levels                   |
| `report/ExportReportDialog.vue`                       | Choose a period and export the journal PDF                                              |
| `photos/PhotosCard.vue`                               | Progress photos: take or choose one, a paged grid newest first, Compare                 |
| `photos/PhotoDialog.vue`                              | Save a new photo (pose, when, notes) or view, edit and delete one                       |
| `photos/PhotoCompareDialog.vue`                       | Two photos side by side with dates and nearest weigh-ins (within three days)            |
| `reminders/AddReminderDialog.vue`                     | Add reminder: Notify me or Add calendar invite, each pushed in place with a back arrow  |
| `reminders/NotifyMePanel.vue`                         | Notify me: explain, then ask; on when allowed; blocked opens Android settings, rechecks |
| `reminders/CalendarInviteForm.vue`                    | A schedule as a calendar file or a Google, Outlook or Microsoft 365 link                |
| `reminders/MedicationReminderControls.vue`            | A reminder that is on: time of day, the day before, when the next one comes             |
| `charts/photoPins.ts`                                 | A photo drawn as a map-style pin whose tip marks its date and weight on a line          |
| `share/ShareCollageDialog.vue`                        | Collage of one pose's photos, picked evenly over a chosen span; post or story shape     |
| `share/collageCard.ts`, `share/cardCanvas.ts`         | Collage drawing; backdrop, brand row, footer and tokens shared with the trend card      |
| `charts/GlycemicComparison.vue`                       | Your HbA1c or fasting glucose change beside one trial's arms, with starting values      |
| `charts/BodyChart.vue`                                | Weight or BMI over time with labelled dashed guides (goal, WHO bands) and a table view  |
| `charts/TrialComparison.vue`                          | Your change beside one trial's endpoint arms as labelled bars, with source and caveats  |
| `charts/PkPanel.vue`                                  | Chooses catalog or user-supplied PK, shows sources and caveats, or why no curve exists  |
| `charts/PkChart.vue`                                  | ECharts curve of logged doses, "Now" marker, table view                                 |
| `charts/levelsChart.ts`                               | The curve's model and ECharts option                                                    |

## Patterns

- Dialogs reset their form from props each time they open, so abandoned edits never leak.
- A view that edits data calls a store action, then `notify.show()`.
- Every number with a source shows a `SourceBadge` or a `SourceList`.
- Level curves pool every dose of a medicine and route across medications
  (`journal.levelGroups`), so Today and Progress agree. Progress shows one `PkPanel` per group,
  never several medicines on one axis. Today's levels panel follows the front card of the
  medication stack (`journal.focusedMedication`), and Progress starts its cohort switcher there.
- Trial cards show the two most relevant trials and fold the rest behind a button.
- Lists page in memory, ten to a page (`usePaging`, `domain/listing.ts`), newest first with a
  sort toggle. Charts and totals always use every row, not the page.
- The app bar scrolls away while reading (`useHideOnScroll`) and returns on a scroll up, a tap
  on a non-interactive part of the page, a route change, or focus. Re-tapping the current tab
  scrolls to the top. The bar keeps its layout slot, so content never jumps.

## Spacing and alignment

- The container owns spacing. A card body, form or panel is a `.gl-stack` (16px between
  children), `.gl-stack--tight` (8px, a caption and what it describes) or `.gl-stack--loose`
  (24px, sections of one card). Children carry no margin utilities. Scoped CSS is unlayered and
  silently beats every utility class, so `margin: 0` in a component cancels `mt-*` on it.
- Fields default to `hideDetails: 'auto'` (`src/plugins/vuetify.ts`): the message row appears
  only for a hint or an error, so gaps come from the stack. A hint that must always show takes
  `persistent-hint`. Rows that pair fields (dose and unit) use `align-start` so an error under
  one does not shift the other.
- Labels sit above controls, left-aligned with the control's border. Vuetify fields get this
  from `theme.css`; any other control (a preset group, a toggle, a list) takes `.gl-label`,
  which has the same type. Hints and errors share that left edge.
- Action rows line up with the content above. Text-only rows keep Vuetify's padding, so the
  label sits at the content edge; a row with a filled, tonal or outlined button insets that
  button to 16px (24px in dialogs and sheets). `theme.css` does this; components do not pad
  `v-card-actions`.
- A notice with actions puts the message first and an end-aligned `.gl-actions` row below it:
  Dismiss (text), then the action (tonal). Buttons keep the default size for touch targets.
- Everyday actions sit with the content they act on; archive and delete close the page,
  separated by a divider.
