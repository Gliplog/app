/** What differs between the two apps in files they otherwise share. */
export const brand = {
  /** The wordmark's two halves, drawn in two tones by AppLogo and share cards. */
  wordmark: ['Glip', 'log'] as const,
  /** Health apps: what never leaves the app. */
  staysInApp: 'Doses, side effects, HbA1c and photos stay in Gliplog.',
  /** Primary action on a Today due card. */
  logDoseLabel: 'Log dose',
  /** Secondary navigation button on a Today due card. */
  dueOpenLabel: 'Medication',
  /** Singular noun for a dose or draw in shared copy. */
  doseNoun: 'dose',
  /** Source note under the side-effects summary card. */
  symptomSourceNote: 'From the labels’ clinical trials.',
} as const
