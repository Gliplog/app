# Components and views

Part of the `front-end` skill.

## Shared components

| Component                                             | Use                                                                                                                                                                                                                   |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `common/PresetPicker.vue`                             | Number input as preset chips plus a Custom field; chips are buttons with `aria-pressed`                                                                                                                               |
| `common/SourceBadge.vue`                              | Shows where a number came from (label, trial, standard, model)                                                                                                                                                        |
| `common/SourceList.vue`                               | A list of sources, each with its badge and a link                                                                                                                                                                     |
| `common/StatTile.vue`                                 | Compact reading tile (label, value, optional note, optional link) used in Today's Latest grid and Progress's `progressStats` summary                                                                                  |
| `today/DueCard.vue`                                   | Scheduled medicine card on Today: countdown slot, due text, last-dose detail, link to medicine page, primary log button                                                                                               |
| `today/SystemList.vue`                                | "In your system" list on Today with amount now, percent of peak, inline trace SVG, and links to each medicine's page                                                                                                  |
| `common/ListPager.vue`, `SortToggle.vue`              | Range caption and `v-pagination` (hidden on one page); newest or oldest first toggle                                                                                                                                  |
| `common/AppLogo.vue`                                  | The brand: mark (`src/assets/brand/gliplog-mark.svg`) plus the two-tone wordmark                                                                                                                                      |
| `common/AppSnackbar.vue`, `AppConfirm.vue`            | Render the notify and confirm stores; mounted once in `App.vue`                                                                                                                                                       |
| `common/UpdatePrompt.vue`                             | Service-worker update and offline-ready notices                                                                                                                                                                       |
| `common/DisclaimerDialog.vue`                         | First-run acknowledgement: a journal, not medical advice                                                                                                                                                              |
| `journal/MedicationDialog.vue`                        | Add or edit a medication: product, interval, compounded vial strength, own half-life (Save only; Stop/Delete live on `MedicationView`)                                                                                |
| `journal/LogHost.vue`                                 | Mounted once in `App.vue`: the Log button, the sheet, and every log dialog                                                                                                                                            |
| `journal/LogButton.vue`, `journal/LogSheet.vue`       | Floating Log button and bottom sheet listing every loggable kind                                                                                                                                                      |
| `journal/EntriesTimeline.vue`                         | Every logged thing by day, with kind filters; a row opens its dialog through the log store                                                                                                                            |
| `journal/EntryRow.vue`, `journal/EntryKindFilter.vue` | Shared entry row (opens its dialog through the log store) and kind filter chip group used by both timeline and calendar                                                                                               |
| `journal/EntriesCalendar.vue`, `journal/DayPanel.vue` | A month of days, marked where anything was logged or is scheduled; built on `v-date-picker`, paired with a day panel showing that day's entries, photos and scheduled items                                           |
| `journal/LogDoseDialog.vue`                           | Log or edit a dose: label strengths, syringe units for a vial, site rotation                                                                                                                                          |
| `journal/LogWeightDialog.vue`                         | Log or edit a weigh-in in kg or lb                                                                                                                                                                                    |
| `journal/LogSymptomDialog.vue`                        | Log one or more side effects at one strength, or edit one entry                                                                                                                                                       |
| `journal/LogGlucoseDialog.vue`                        | Log or edit an HbA1c result or a glucose reading (with when in the day)                                                                                                                                               |
| `journal/LogVitalsDialog.vue`                         | Log or edit blood pressure (systolic over diastolic) or resting heart rate                                                                                                                                            |
| `journal/MedicationDialog.vue`                        | Add or edit a medication: product, interval, compounded vial strength, own half-life (Save only; Stop/Delete live on `MedicationView`)                                                                                |
| `journal/SymptomSummaryCard.vue`                      | Side effects by period, strength and days after a dose (no longer opens PDF export; Export PDF lives in Progress's header)                                                                                            |
| `charts/CohortChart.vue`                              | One medicine's trial readouts merged over weeks (band and points), your line                                                                                                                                          |
| `charts/CohortSection.vue`                            | Progress cohort section: medication, measure and population switches, trial cards                                                                                                                                     |
| `charts/TrendCard.vue`, `charts/DoseLegend.vue`       | A body measure over time with range chips (`domain/range.ts`). On weight and BMI the line takes the colour of the dose in use and a pill marks each change (`domain/doseBands.ts`); `DoseLegend` lists the strengths. |
| `charts/bodyChart.ts`                                 | The body-measure chart option, shared by `BodyChart` and share images                                                                                                                                                 |
| `share/ShareImageDialog.vue`                          | Preview and share an image card (content or a render function); privacy in its slot                                                                                                                                   |
| `share/ShareTrendDialog.vue`, `ShareLevelsDialog.vue` | Image cards for a trend (numbers, photos, doses opt-in) and estimated levels                                                                                                                                          |
| `report/ExportReportDialog.vue`                       | Choose a period and the parts to include, and export the journal PDF                                                                                                                                                  |
| `photos/PhotosCard.vue`                               | Progress photos: take or choose one, a paged grid newest first, Compare                                                                                                                                               |
| `photos/PhotoDialog.vue`                              | Save a new photo (pose, when, notes) or view, edit and delete one                                                                                                                                                     |
| `photos/PhotoCompareDialog.vue`                       | Two photos side by side with dates and nearest weigh-ins (within three days)                                                                                                                                          |
| `reminders/AddReminderDialog.vue`                     | Add reminder: Notify me or Add calendar invite, each pushed in place with a back arrow                                                                                                                                |
| `reminders/NotifyMePanel.vue`                         | Notify me: explain, then ask; on when allowed; blocked opens Android settings, rechecks                                                                                                                               |
| `reminders/CalendarInviteForm.vue`                    | A schedule as a calendar file or a Google, Outlook or Microsoft 365 link                                                                                                                                              |
| `reminders/ReminderControls.vue`                      | A reminder that is on: time of day, the day before, when the next one comes                                                                                                                                           |
| `charts/photoPins.ts`                                 | A photo drawn as a map-style pin whose tip marks its date and weight on a line                                                                                                                                        |
| `share/ShareCollageDialog.vue`                        | Collage of one pose's photos, picked evenly over a chosen span; post or story shape                                                                                                                                   |
| `share/collageCard.ts`, `share/cardCanvas.ts`         | Collage drawing; backdrop, brand row, footer and tokens shared with the trend card                                                                                                                                    |
| `charts/GlycemicComparison.vue`                       | Your HbA1c or fasting glucose change beside one trial's arms, with starting values                                                                                                                                    |
| `charts/BodyChart.vue`                                | Weight or BMI over time with labelled dashed guides (goal, WHO bands)                                                                                                                                                 |
| `charts/TrialComparison.vue`                          | Your change beside one trial's endpoint arms as labelled bars, with source and caveats                                                                                                                                |
| `charts/PkPanel.vue`                                  | Chooses catalog or user-supplied PK, shows sources and caveats, or why no curve exists                                                                                                                                |
| `charts/PkChart.vue`                                  | ECharts curve of logged doses, "Now" marker                                                                                                                                                                           |
| `charts/levelsChart.ts`                               | The curve's model and ECharts option                                                                                                                                                                                  |

## Views

- `views/TodayView.vue`, `views/MedicationsView.vue`, `views/MedicationView.vue`, `views/ProgressView.vue`, `views/EntriesView.vue`, `views/SettingsView.vue`, `views/HealthView.vue` (apps only).

## Patterns

- To log or edit anything, call `useLogStore().start(kind, context)` or `.edit(entry)`. Never mount a log dialog in a view.
- A new kind of entry is one adapter case in `useEntries.ts`, one row in `logKinds.ts`, and its dialog.
- Dialogs reset their form from props each time they open, so abandoned edits never leak.
- A view that edits data calls a store action, then `notify.show()`.
- Every number with a source shows a `SourceBadge` or a `SourceList`.
- Today lists what is due, what is in the system and the latest readings. It has no log buttons except one per due card; everything else goes through the Log button.
- One-home rule: the full estimated-level chart (`PkPanel`) lives on the medicine's page (`MedicationView`), pooling every dose of that medicine and route across medications (`journal.levelGroupOf`). Progress no longer renders `PkPanel`; its cohort section starts on `journal.currentMedication`.
- A trend chart is one grid with one value axis. Do not add a second panel under it.
- Share dialogs put their privacy switches in `ShareImageDialog`'s slot, which renders them
  at 48px rows with a plain track and a 14px label so they sit at the buttons' size.
- Trial cards show the two most relevant trials and fold the rest behind a button.
- Lists page in memory, ten to a page (`usePaging`, `domain/listing.ts`), newest first with a
  sort toggle. Charts and totals always use every row, not the page. Stat tiles describe the whole
  record and do not follow the range chips.
- The app bar scrolls away while reading (`useHideOnScroll`) and returns on a scroll up, a tap
  on a non-interactive part of the page, a route change, or focus. Re-tapping the current tab
  scrolls to the top. The bar keeps its layout slot, so content never jumps.
- A unit default comes from `unitDefaultsFor`; never hard-code `kg` or `cm` as a fallback in a
  component.
- A date from a Vuetify date component is converted in `src/services/time.ts` (`dayOfDate`,
  `dateOfDay`, `dayOfIsoDate`); components never construct or read a `Date`.

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
