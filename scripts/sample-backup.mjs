/*
 * A made-up 20-week Wegovy course, never real records, as a Gliplog backup file. The site and
 * store screenshot scripts restore it through Settings, the same path a user takes. Dates are
 * relative to now, so "next dose in 2 days" stays true whenever a script runs.
 */
const DAY = 86_400_000
const now = Date.now()
const iso = (ms) => new Date(ms).toISOString()
/** A local time of day `daysAgo` days back, so entries read like a real routine. */
const at = (daysAgo, hour) => {
  const d = new Date(now - daysAgo * DAY)
  d.setHours(hour, 7, 0, 0)
  return d.getTime()
}
const created = iso(now - 150 * DAY)

/** A weekly course stepping up the label's titration every four weeks, last dose 5 days ago. */
export function sampleBackup() {
  const firstDoseDaysAgo = 19 * 7 + 5
  const steps = [0.25, 0.5, 1, 1.7, 2.4]
  const sites = ['abdomen-left', 'abdomen-right', 'thigh-left', 'thigh-right']
  const doses = Array.from({ length: 20 }, (_, i) => ({
    id: `d${i}`,
    medicationId: 'm1',
    takenAt: iso(at(firstDoseDaysAgo - i * 7, 19)),
    doseMg: steps[Math.floor(i / 4)],
    site: sites[i % 4],
    notes: '',
    createdAt: created,
  }))
  // A baseline the day before the first dose, then weekly weigh-ins easing towards 92.6 kg.
  const weights = Array.from({ length: 21 }, (_, i) => {
    const daysAgo = i === 0 ? firstDoseDaysAgo + 1 : Math.max(1, firstDoseDaysAgo - i * 7 + 3)
    const kg = i === 20 ? 92.6 : 92.6 + 11.4 * Math.exp(-i / 9) + (i % 3 === 1 ? 0.3 : 0)
    return {
      id: `w${i}`,
      measuredAt: iso(at(daysAgo, 7)),
      kg: Math.round(kg * 10) / 10,
      enteredUnit: 'kg',
      notes: '',
      createdAt: created,
    }
  })
  const symptoms = [
    [130, 'nausea', 'mild'],
    [123, 'nausea', 'moderate'],
    [95, 'constipation', 'mild'],
    [40, 'tiredness', 'mild'],
    [4, 'nausea', 'mild'],
  ].map(([daysAgo, symptom, severity], i) => ({
    id: `s${i}`,
    occurredAt: iso(at(daysAgo, 12)),
    symptom,
    otherText: '',
    severity,
    notes: '',
    createdAt: created,
  }))
  const glucose = [
    { kind: 'a1c', daysAgo: firstDoseDaysAgo + 3, value: 6.1, enteredUnit: '%', context: null },
    { kind: 'a1c', daysAgo: 10, value: 5.6, enteredUnit: '%', context: null },
    { kind: 'glucose', daysAgo: 2, value: 96, enteredUnit: 'mg/dL', context: 'fasting' },
  ].map(({ daysAgo, ...g }, i) => ({
    id: `g${i}`,
    ...g,
    measuredAt: iso(at(daysAgo, 8)),
    notes: '',
    createdAt: created,
  }))
  return {
    format: 'gliplog-backup',
    version: 2,
    exportedAt: iso(now),
    medications: [
      {
        id: 'm1',
        productId: 'wegovy',
        name: 'Wegovy',
        intervalDays: 7,
        concentrationMgPerMl: null,
        pkOverride: null,
        status: 'active',
        notes: '',
        createdAt: created,
        updatedAt: created,
      },
    ],
    doses,
    weights,
    symptoms,
    glucose,
    // Restore replaces settings too: keep the notice accepted and the install hint away.
    settings: [
      {
        key: 'profile',
        value: {
          heightCm: 172,
          goalKg: 85,
        },
      },
      { key: 'disclaimerAcceptedAt', value: iso(now) },
      { key: 'installHintDismissed', value: true },
      { key: 'lastBackupAt', value: iso(now) },
    ],
  }
}
