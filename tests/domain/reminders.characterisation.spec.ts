import { describe, expect, it } from 'vitest'
import { dueDaysFor } from '@/domain/reminderDays'
import {
  planReminders,
  type AtLocalTime,
  type MedicationReminder,
  type ReminderKind,
} from '@/domain/reminders'

const MIN = 60_000
const H = 60 * MIN
const DAY = 24 * H

// A UTC "local" day keeps the arithmetic obvious; the real one lives in services/time.ts.
const utcAt: AtLocalTime = (ms, offset, hour, minute) =>
  Math.floor(ms / DAY) * DAY + offset * DAY + hour * H + minute * MIN

function plan(input: {
  dueAt: number | null
  intervalDays: number
  reminder: MedicationReminder
  now: number
}): { kind: ReminderKind; at: number }[] {
  return planReminders({
    subjectId: 'm',
    ...dueDaysFor(input),
    rule: input.reminder,
    now: input.now,
    atLocalTime: utcAt,
  }).map(({ kind, at }) => ({ kind, at }))
}

interface CharacterisationCase {
  label: string
  intervalDays: number
  dueAt: number | null
  now: number
  reminder: MedicationReminder
  expected: { kind: ReminderKind; at: number }[]
}

const CASES: readonly CharacterisationCase[] = [
  {
    label: 'interval=0, due=null, reminder=off',
    intervalDays: 0,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=null, reminder=on at 09:00',
    intervalDays: 0,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=null, reminder=on at 20:15 with dayBefore',
    intervalDays: 0,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=null, reminder=on at 00:00',
    intervalDays: 0,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=null, reminder=on at 23:45',
    intervalDays: 0,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=3 days ahead, reminder=off',
    intervalDays: 0,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=3 days ahead, reminder=on at 09:00',
    intervalDays: 0,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=3 days ahead, reminder=on at 20:15 with dayBefore',
    intervalDays: 0,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=3 days ahead, reminder=on at 00:00',
    intervalDays: 0,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=3 days ahead, reminder=on at 23:45',
    intervalDays: 0,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=tomorrow, reminder=off',
    intervalDays: 0,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=tomorrow, reminder=on at 09:00',
    intervalDays: 0,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=tomorrow, reminder=on at 20:15 with dayBefore',
    intervalDays: 0,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=tomorrow, reminder=on at 00:00',
    intervalDays: 0,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=tomorrow, reminder=on at 23:45',
    intervalDays: 0,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=today, later than the reminder time, reminder=off',
    intervalDays: 0,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=today, later than the reminder time, reminder=on at 09:00',
    intervalDays: 0,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label:
      'interval=0, due=today, later than the reminder time, reminder=on at 20:15 with dayBefore',
    intervalDays: 0,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=today, later than the reminder time, reminder=on at 00:00',
    intervalDays: 0,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=today, later than the reminder time, reminder=on at 23:45',
    intervalDays: 0,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=today, earlier, reminder=off',
    intervalDays: 0,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=today, earlier, reminder=on at 09:00',
    intervalDays: 0,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=today, earlier, reminder=on at 20:15 with dayBefore',
    intervalDays: 0,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=today, earlier, reminder=on at 00:00',
    intervalDays: 0,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=today, earlier, reminder=on at 23:45',
    intervalDays: 0,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=yesterday, reminder=off',
    intervalDays: 0,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=yesterday, reminder=on at 09:00',
    intervalDays: 0,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=yesterday, reminder=on at 20:15 with dayBefore',
    intervalDays: 0,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=yesterday, reminder=on at 00:00',
    intervalDays: 0,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=yesterday, reminder=on at 23:45',
    intervalDays: 0,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=5 days ago, reminder=off',
    intervalDays: 0,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=5 days ago, reminder=on at 09:00',
    intervalDays: 0,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=5 days ago, reminder=on at 20:15 with dayBefore',
    intervalDays: 0,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=5 days ago, reminder=on at 00:00',
    intervalDays: 0,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=5 days ago, reminder=on at 23:45',
    intervalDays: 0,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=40 days ago, reminder=off',
    intervalDays: 0,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=40 days ago, reminder=on at 09:00',
    intervalDays: 0,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=40 days ago, reminder=on at 20:15 with dayBefore',
    intervalDays: 0,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=40 days ago, reminder=on at 00:00',
    intervalDays: 0,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=0, due=40 days ago, reminder=on at 23:45',
    intervalDays: 0,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=1, due=null, reminder=off',
    intervalDays: 1,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=1, due=null, reminder=on at 09:00',
    intervalDays: 1,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=1, due=null, reminder=on at 20:15 with dayBefore',
    intervalDays: 1,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=1, due=null, reminder=on at 00:00',
    intervalDays: 1,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=1, due=null, reminder=on at 23:45',
    intervalDays: 1,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=1, due=3 days ahead, reminder=off',
    intervalDays: 1,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=1, due=3 days ahead, reminder=on at 09:00',
    intervalDays: 1,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8931600000,
      },
      {
        kind: 'due',
        at: 9018000000,
      },
      {
        kind: 'due',
        at: 9104400000,
      },
      {
        kind: 'due',
        at: 9190800000,
      },
      {
        kind: 'due',
        at: 9277200000,
      },
      {
        kind: 'due',
        at: 9363600000,
      },
      {
        kind: 'due',
        at: 9450000000,
      },
    ],
  },
  {
    label: 'interval=1, due=3 days ahead, reminder=on at 20:15 with dayBefore',
    intervalDays: 1,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'due',
        at: 8972100000,
      },
      {
        kind: 'due',
        at: 9058500000,
      },
      {
        kind: 'due',
        at: 9144900000,
      },
      {
        kind: 'due',
        at: 9231300000,
      },
      {
        kind: 'due',
        at: 9317700000,
      },
      {
        kind: 'due',
        at: 9404100000,
      },
      {
        kind: 'due',
        at: 9490500000,
      },
    ],
  },
  {
    label: 'interval=1, due=3 days ahead, reminder=on at 00:00',
    intervalDays: 1,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8899200000,
      },
      {
        kind: 'due',
        at: 8985600000,
      },
      {
        kind: 'due',
        at: 9072000000,
      },
      {
        kind: 'due',
        at: 9158400000,
      },
      {
        kind: 'due',
        at: 9244800000,
      },
      {
        kind: 'due',
        at: 9331200000,
      },
      {
        kind: 'due',
        at: 9417600000,
      },
    ],
  },
  {
    label: 'interval=1, due=3 days ahead, reminder=on at 23:45',
    intervalDays: 1,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8984700000,
      },
      {
        kind: 'due',
        at: 9071100000,
      },
      {
        kind: 'due',
        at: 9157500000,
      },
      {
        kind: 'due',
        at: 9243900000,
      },
      {
        kind: 'due',
        at: 9330300000,
      },
      {
        kind: 'due',
        at: 9416700000,
      },
      {
        kind: 'due',
        at: 9503100000,
      },
    ],
  },
  {
    label: 'interval=1, due=tomorrow, reminder=off',
    intervalDays: 1,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=1, due=tomorrow, reminder=on at 09:00',
    intervalDays: 1,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8758800000,
      },
      {
        kind: 'due',
        at: 8845200000,
      },
      {
        kind: 'due',
        at: 8931600000,
      },
      {
        kind: 'due',
        at: 9018000000,
      },
      {
        kind: 'due',
        at: 9104400000,
      },
      {
        kind: 'due',
        at: 9190800000,
      },
      {
        kind: 'due',
        at: 9277200000,
      },
    ],
  },
  {
    label: 'interval=1, due=tomorrow, reminder=on at 20:15 with dayBefore',
    intervalDays: 1,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'due',
        at: 8799300000,
      },
      {
        kind: 'due',
        at: 8885700000,
      },
      {
        kind: 'due',
        at: 8972100000,
      },
      {
        kind: 'due',
        at: 9058500000,
      },
      {
        kind: 'due',
        at: 9144900000,
      },
      {
        kind: 'due',
        at: 9231300000,
      },
      {
        kind: 'due',
        at: 9317700000,
      },
    ],
  },
  {
    label: 'interval=1, due=tomorrow, reminder=on at 00:00',
    intervalDays: 1,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8726400000,
      },
      {
        kind: 'due',
        at: 8812800000,
      },
      {
        kind: 'due',
        at: 8899200000,
      },
      {
        kind: 'due',
        at: 8985600000,
      },
      {
        kind: 'due',
        at: 9072000000,
      },
      {
        kind: 'due',
        at: 9158400000,
      },
      {
        kind: 'due',
        at: 9244800000,
      },
    ],
  },
  {
    label: 'interval=1, due=tomorrow, reminder=on at 23:45',
    intervalDays: 1,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8811900000,
      },
      {
        kind: 'due',
        at: 8898300000,
      },
      {
        kind: 'due',
        at: 8984700000,
      },
      {
        kind: 'due',
        at: 9071100000,
      },
      {
        kind: 'due',
        at: 9157500000,
      },
      {
        kind: 'due',
        at: 9243900000,
      },
      {
        kind: 'due',
        at: 9330300000,
      },
    ],
  },
  {
    label: 'interval=1, due=today, later than the reminder time, reminder=off',
    intervalDays: 1,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=1, due=today, later than the reminder time, reminder=on at 09:00',
    intervalDays: 1,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8758800000,
      },
      {
        kind: 'due',
        at: 8845200000,
      },
      {
        kind: 'due',
        at: 8931600000,
      },
      {
        kind: 'due',
        at: 9018000000,
      },
      {
        kind: 'due',
        at: 9104400000,
      },
      {
        kind: 'due',
        at: 9190800000,
      },
      {
        kind: 'due',
        at: 9277200000,
      },
    ],
  },
  {
    label:
      'interval=1, due=today, later than the reminder time, reminder=on at 20:15 with dayBefore',
    intervalDays: 1,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'due',
        at: 8799300000,
      },
      {
        kind: 'due',
        at: 8885700000,
      },
      {
        kind: 'due',
        at: 8972100000,
      },
      {
        kind: 'due',
        at: 9058500000,
      },
      {
        kind: 'due',
        at: 9144900000,
      },
      {
        kind: 'due',
        at: 9231300000,
      },
      {
        kind: 'due',
        at: 9317700000,
      },
    ],
  },
  {
    label: 'interval=1, due=today, later than the reminder time, reminder=on at 00:00',
    intervalDays: 1,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8726400000,
      },
      {
        kind: 'due',
        at: 8812800000,
      },
      {
        kind: 'due',
        at: 8899200000,
      },
      {
        kind: 'due',
        at: 8985600000,
      },
      {
        kind: 'due',
        at: 9072000000,
      },
      {
        kind: 'due',
        at: 9158400000,
      },
      {
        kind: 'due',
        at: 9244800000,
      },
    ],
  },
  {
    label: 'interval=1, due=today, later than the reminder time, reminder=on at 23:45',
    intervalDays: 1,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8811900000,
      },
      {
        kind: 'due',
        at: 8898300000,
      },
      {
        kind: 'due',
        at: 8984700000,
      },
      {
        kind: 'due',
        at: 9071100000,
      },
      {
        kind: 'due',
        at: 9157500000,
      },
      {
        kind: 'due',
        at: 9243900000,
      },
      {
        kind: 'due',
        at: 9330300000,
      },
    ],
  },
  {
    label: 'interval=1, due=today, earlier, reminder=off',
    intervalDays: 1,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=1, due=today, earlier, reminder=on at 09:00',
    intervalDays: 1,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8672400000,
      },
      {
        kind: 'due',
        at: 8758800000,
      },
      {
        kind: 'due',
        at: 8845200000,
      },
      {
        kind: 'due',
        at: 8931600000,
      },
      {
        kind: 'due',
        at: 9018000000,
      },
      {
        kind: 'due',
        at: 9104400000,
      },
      {
        kind: 'due',
        at: 9190800000,
      },
    ],
  },
  {
    label: 'interval=1, due=today, earlier, reminder=on at 20:15 with dayBefore',
    intervalDays: 1,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'due',
        at: 8712900000,
      },
      {
        kind: 'due',
        at: 8799300000,
      },
      {
        kind: 'due',
        at: 8885700000,
      },
      {
        kind: 'due',
        at: 8972100000,
      },
      {
        kind: 'due',
        at: 9058500000,
      },
      {
        kind: 'due',
        at: 9144900000,
      },
      {
        kind: 'due',
        at: 9231300000,
      },
    ],
  },
  {
    label: 'interval=1, due=today, earlier, reminder=on at 00:00',
    intervalDays: 1,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8726400000,
      },
      {
        kind: 'due',
        at: 8812800000,
      },
      {
        kind: 'due',
        at: 8899200000,
      },
      {
        kind: 'due',
        at: 8985600000,
      },
      {
        kind: 'due',
        at: 9072000000,
      },
      {
        kind: 'due',
        at: 9158400000,
      },
      {
        kind: 'due',
        at: 9244800000,
      },
    ],
  },
  {
    label: 'interval=1, due=today, earlier, reminder=on at 23:45',
    intervalDays: 1,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8725500000,
      },
      {
        kind: 'due',
        at: 8811900000,
      },
      {
        kind: 'due',
        at: 8898300000,
      },
      {
        kind: 'due',
        at: 8984700000,
      },
      {
        kind: 'due',
        at: 9071100000,
      },
      {
        kind: 'due',
        at: 9157500000,
      },
      {
        kind: 'due',
        at: 9243900000,
      },
    ],
  },
  {
    label: 'interval=1, due=yesterday, reminder=off',
    intervalDays: 1,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=1, due=yesterday, reminder=on at 09:00',
    intervalDays: 1,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8758800000,
      },
      {
        kind: 'due',
        at: 8845200000,
      },
      {
        kind: 'due',
        at: 8931600000,
      },
      {
        kind: 'due',
        at: 9018000000,
      },
      {
        kind: 'due',
        at: 9104400000,
      },
      {
        kind: 'due',
        at: 9190800000,
      },
      {
        kind: 'due',
        at: 9277200000,
      },
    ],
  },
  {
    label: 'interval=1, due=yesterday, reminder=on at 20:15 with dayBefore',
    intervalDays: 1,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'due',
        at: 8712900000,
      },
      {
        kind: 'due',
        at: 8799300000,
      },
      {
        kind: 'due',
        at: 8885700000,
      },
      {
        kind: 'due',
        at: 8972100000,
      },
      {
        kind: 'due',
        at: 9058500000,
      },
      {
        kind: 'due',
        at: 9144900000,
      },
      {
        kind: 'due',
        at: 9231300000,
      },
    ],
  },
  {
    label: 'interval=1, due=yesterday, reminder=on at 00:00',
    intervalDays: 1,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8726400000,
      },
      {
        kind: 'due',
        at: 8812800000,
      },
      {
        kind: 'due',
        at: 8899200000,
      },
      {
        kind: 'due',
        at: 8985600000,
      },
      {
        kind: 'due',
        at: 9072000000,
      },
      {
        kind: 'due',
        at: 9158400000,
      },
      {
        kind: 'due',
        at: 9244800000,
      },
    ],
  },
  {
    label: 'interval=1, due=yesterday, reminder=on at 23:45',
    intervalDays: 1,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8725500000,
      },
      {
        kind: 'due',
        at: 8811900000,
      },
      {
        kind: 'due',
        at: 8898300000,
      },
      {
        kind: 'due',
        at: 8984700000,
      },
      {
        kind: 'due',
        at: 9071100000,
      },
      {
        kind: 'due',
        at: 9157500000,
      },
      {
        kind: 'due',
        at: 9243900000,
      },
    ],
  },
  {
    label: 'interval=1, due=5 days ago, reminder=off',
    intervalDays: 1,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=1, due=5 days ago, reminder=on at 09:00',
    intervalDays: 1,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8758800000,
      },
      {
        kind: 'due',
        at: 8845200000,
      },
      {
        kind: 'due',
        at: 8931600000,
      },
      {
        kind: 'due',
        at: 9018000000,
      },
      {
        kind: 'due',
        at: 9104400000,
      },
      {
        kind: 'due',
        at: 9190800000,
      },
      {
        kind: 'due',
        at: 9277200000,
      },
    ],
  },
  {
    label: 'interval=1, due=5 days ago, reminder=on at 20:15 with dayBefore',
    intervalDays: 1,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'due',
        at: 8712900000,
      },
      {
        kind: 'due',
        at: 8799300000,
      },
      {
        kind: 'due',
        at: 8885700000,
      },
      {
        kind: 'due',
        at: 8972100000,
      },
      {
        kind: 'due',
        at: 9058500000,
      },
      {
        kind: 'due',
        at: 9144900000,
      },
      {
        kind: 'due',
        at: 9231300000,
      },
    ],
  },
  {
    label: 'interval=1, due=5 days ago, reminder=on at 00:00',
    intervalDays: 1,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8726400000,
      },
      {
        kind: 'due',
        at: 8812800000,
      },
      {
        kind: 'due',
        at: 8899200000,
      },
      {
        kind: 'due',
        at: 8985600000,
      },
      {
        kind: 'due',
        at: 9072000000,
      },
      {
        kind: 'due',
        at: 9158400000,
      },
      {
        kind: 'due',
        at: 9244800000,
      },
    ],
  },
  {
    label: 'interval=1, due=5 days ago, reminder=on at 23:45',
    intervalDays: 1,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8725500000,
      },
      {
        kind: 'due',
        at: 8811900000,
      },
      {
        kind: 'due',
        at: 8898300000,
      },
      {
        kind: 'due',
        at: 8984700000,
      },
      {
        kind: 'due',
        at: 9071100000,
      },
      {
        kind: 'due',
        at: 9157500000,
      },
      {
        kind: 'due',
        at: 9243900000,
      },
    ],
  },
  {
    label: 'interval=1, due=40 days ago, reminder=off',
    intervalDays: 1,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=1, due=40 days ago, reminder=on at 09:00',
    intervalDays: 1,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8758800000,
      },
      {
        kind: 'due',
        at: 8845200000,
      },
      {
        kind: 'due',
        at: 8931600000,
      },
      {
        kind: 'due',
        at: 9018000000,
      },
      {
        kind: 'due',
        at: 9104400000,
      },
      {
        kind: 'due',
        at: 9190800000,
      },
      {
        kind: 'due',
        at: 9277200000,
      },
    ],
  },
  {
    label: 'interval=1, due=40 days ago, reminder=on at 20:15 with dayBefore',
    intervalDays: 1,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'due',
        at: 8712900000,
      },
      {
        kind: 'due',
        at: 8799300000,
      },
      {
        kind: 'due',
        at: 8885700000,
      },
      {
        kind: 'due',
        at: 8972100000,
      },
      {
        kind: 'due',
        at: 9058500000,
      },
      {
        kind: 'due',
        at: 9144900000,
      },
      {
        kind: 'due',
        at: 9231300000,
      },
    ],
  },
  {
    label: 'interval=1, due=40 days ago, reminder=on at 00:00',
    intervalDays: 1,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8726400000,
      },
      {
        kind: 'due',
        at: 8812800000,
      },
      {
        kind: 'due',
        at: 8899200000,
      },
      {
        kind: 'due',
        at: 8985600000,
      },
      {
        kind: 'due',
        at: 9072000000,
      },
      {
        kind: 'due',
        at: 9158400000,
      },
      {
        kind: 'due',
        at: 9244800000,
      },
    ],
  },
  {
    label: 'interval=1, due=40 days ago, reminder=on at 23:45',
    intervalDays: 1,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8725500000,
      },
      {
        kind: 'due',
        at: 8811900000,
      },
      {
        kind: 'due',
        at: 8898300000,
      },
      {
        kind: 'due',
        at: 8984700000,
      },
      {
        kind: 'due',
        at: 9071100000,
      },
      {
        kind: 'due',
        at: 9157500000,
      },
      {
        kind: 'due',
        at: 9243900000,
      },
    ],
  },
  {
    label: 'interval=2, due=null, reminder=off',
    intervalDays: 2,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=null, reminder=on at 09:00',
    intervalDays: 2,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=null, reminder=on at 20:15 with dayBefore',
    intervalDays: 2,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=null, reminder=on at 00:00',
    intervalDays: 2,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=null, reminder=on at 23:45',
    intervalDays: 2,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=3 days ahead, reminder=off',
    intervalDays: 2,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=3 days ahead, reminder=on at 09:00',
    intervalDays: 2,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8931600000,
      },
      {
        kind: 'late',
        at: 9018000000,
      },
    ],
  },
  {
    label: 'interval=2, due=3 days ahead, reminder=on at 20:15 with dayBefore',
    intervalDays: 2,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'day-before',
        at: 8885700000,
      },
      {
        kind: 'due',
        at: 8972100000,
      },
      {
        kind: 'late',
        at: 9058500000,
      },
    ],
  },
  {
    label: 'interval=2, due=3 days ahead, reminder=on at 00:00',
    intervalDays: 2,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8899200000,
      },
      {
        kind: 'late',
        at: 8985600000,
      },
    ],
  },
  {
    label: 'interval=2, due=3 days ahead, reminder=on at 23:45',
    intervalDays: 2,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8984700000,
      },
      {
        kind: 'late',
        at: 9071100000,
      },
    ],
  },
  {
    label: 'interval=2, due=tomorrow, reminder=off',
    intervalDays: 2,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=tomorrow, reminder=on at 09:00',
    intervalDays: 2,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8758800000,
      },
      {
        kind: 'late',
        at: 8845200000,
      },
    ],
  },
  {
    label: 'interval=2, due=tomorrow, reminder=on at 20:15 with dayBefore',
    intervalDays: 2,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'day-before',
        at: 8712900000,
      },
      {
        kind: 'due',
        at: 8799300000,
      },
      {
        kind: 'late',
        at: 8885700000,
      },
    ],
  },
  {
    label: 'interval=2, due=tomorrow, reminder=on at 00:00',
    intervalDays: 2,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8726400000,
      },
      {
        kind: 'late',
        at: 8812800000,
      },
    ],
  },
  {
    label: 'interval=2, due=tomorrow, reminder=on at 23:45',
    intervalDays: 2,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8811900000,
      },
      {
        kind: 'late',
        at: 8898300000,
      },
    ],
  },
  {
    label: 'interval=2, due=today, later than the reminder time, reminder=off',
    intervalDays: 2,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=today, later than the reminder time, reminder=on at 09:00',
    intervalDays: 2,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'late',
        at: 8758800000,
      },
    ],
  },
  {
    label:
      'interval=2, due=today, later than the reminder time, reminder=on at 20:15 with dayBefore',
    intervalDays: 2,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'late',
        at: 8799300000,
      },
    ],
  },
  {
    label: 'interval=2, due=today, later than the reminder time, reminder=on at 00:00',
    intervalDays: 2,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'late',
        at: 8726400000,
      },
    ],
  },
  {
    label: 'interval=2, due=today, later than the reminder time, reminder=on at 23:45',
    intervalDays: 2,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'late',
        at: 8811900000,
      },
    ],
  },
  {
    label: 'interval=2, due=today, earlier, reminder=off',
    intervalDays: 2,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=today, earlier, reminder=on at 09:00',
    intervalDays: 2,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8672400000,
      },
      {
        kind: 'late',
        at: 8758800000,
      },
    ],
  },
  {
    label: 'interval=2, due=today, earlier, reminder=on at 20:15 with dayBefore',
    intervalDays: 2,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'due',
        at: 8712900000,
      },
      {
        kind: 'late',
        at: 8799300000,
      },
    ],
  },
  {
    label: 'interval=2, due=today, earlier, reminder=on at 00:00',
    intervalDays: 2,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'late',
        at: 8726400000,
      },
    ],
  },
  {
    label: 'interval=2, due=today, earlier, reminder=on at 23:45',
    intervalDays: 2,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8725500000,
      },
      {
        kind: 'late',
        at: 8811900000,
      },
    ],
  },
  {
    label: 'interval=2, due=yesterday, reminder=off',
    intervalDays: 2,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=yesterday, reminder=on at 09:00',
    intervalDays: 2,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=yesterday, reminder=on at 20:15 with dayBefore',
    intervalDays: 2,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'late',
        at: 8712900000,
      },
    ],
  },
  {
    label: 'interval=2, due=yesterday, reminder=on at 00:00',
    intervalDays: 2,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=yesterday, reminder=on at 23:45',
    intervalDays: 2,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'late',
        at: 8725500000,
      },
    ],
  },
  {
    label: 'interval=2, due=5 days ago, reminder=off',
    intervalDays: 2,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=5 days ago, reminder=on at 09:00',
    intervalDays: 2,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=5 days ago, reminder=on at 20:15 with dayBefore',
    intervalDays: 2,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=5 days ago, reminder=on at 00:00',
    intervalDays: 2,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=5 days ago, reminder=on at 23:45',
    intervalDays: 2,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=40 days ago, reminder=off',
    intervalDays: 2,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=40 days ago, reminder=on at 09:00',
    intervalDays: 2,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=40 days ago, reminder=on at 20:15 with dayBefore',
    intervalDays: 2,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=40 days ago, reminder=on at 00:00',
    intervalDays: 2,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=2, due=40 days ago, reminder=on at 23:45',
    intervalDays: 2,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=null, reminder=off',
    intervalDays: 7,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=null, reminder=on at 09:00',
    intervalDays: 7,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=null, reminder=on at 20:15 with dayBefore',
    intervalDays: 7,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=null, reminder=on at 00:00',
    intervalDays: 7,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=null, reminder=on at 23:45',
    intervalDays: 7,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=3 days ahead, reminder=off',
    intervalDays: 7,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=3 days ahead, reminder=on at 09:00',
    intervalDays: 7,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8931600000,
      },
      {
        kind: 'late',
        at: 9018000000,
      },
    ],
  },
  {
    label: 'interval=7, due=3 days ahead, reminder=on at 20:15 with dayBefore',
    intervalDays: 7,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'day-before',
        at: 8885700000,
      },
      {
        kind: 'due',
        at: 8972100000,
      },
      {
        kind: 'late',
        at: 9058500000,
      },
    ],
  },
  {
    label: 'interval=7, due=3 days ahead, reminder=on at 00:00',
    intervalDays: 7,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8899200000,
      },
      {
        kind: 'late',
        at: 8985600000,
      },
    ],
  },
  {
    label: 'interval=7, due=3 days ahead, reminder=on at 23:45',
    intervalDays: 7,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8984700000,
      },
      {
        kind: 'late',
        at: 9071100000,
      },
    ],
  },
  {
    label: 'interval=7, due=tomorrow, reminder=off',
    intervalDays: 7,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=tomorrow, reminder=on at 09:00',
    intervalDays: 7,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8758800000,
      },
      {
        kind: 'late',
        at: 8845200000,
      },
    ],
  },
  {
    label: 'interval=7, due=tomorrow, reminder=on at 20:15 with dayBefore',
    intervalDays: 7,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'day-before',
        at: 8712900000,
      },
      {
        kind: 'due',
        at: 8799300000,
      },
      {
        kind: 'late',
        at: 8885700000,
      },
    ],
  },
  {
    label: 'interval=7, due=tomorrow, reminder=on at 00:00',
    intervalDays: 7,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8726400000,
      },
      {
        kind: 'late',
        at: 8812800000,
      },
    ],
  },
  {
    label: 'interval=7, due=tomorrow, reminder=on at 23:45',
    intervalDays: 7,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8811900000,
      },
      {
        kind: 'late',
        at: 8898300000,
      },
    ],
  },
  {
    label: 'interval=7, due=today, later than the reminder time, reminder=off',
    intervalDays: 7,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=today, later than the reminder time, reminder=on at 09:00',
    intervalDays: 7,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'late',
        at: 8758800000,
      },
    ],
  },
  {
    label:
      'interval=7, due=today, later than the reminder time, reminder=on at 20:15 with dayBefore',
    intervalDays: 7,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'late',
        at: 8799300000,
      },
    ],
  },
  {
    label: 'interval=7, due=today, later than the reminder time, reminder=on at 00:00',
    intervalDays: 7,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'late',
        at: 8726400000,
      },
    ],
  },
  {
    label: 'interval=7, due=today, later than the reminder time, reminder=on at 23:45',
    intervalDays: 7,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'late',
        at: 8811900000,
      },
    ],
  },
  {
    label: 'interval=7, due=today, earlier, reminder=off',
    intervalDays: 7,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=today, earlier, reminder=on at 09:00',
    intervalDays: 7,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8672400000,
      },
      {
        kind: 'late',
        at: 8758800000,
      },
    ],
  },
  {
    label: 'interval=7, due=today, earlier, reminder=on at 20:15 with dayBefore',
    intervalDays: 7,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'due',
        at: 8712900000,
      },
      {
        kind: 'late',
        at: 8799300000,
      },
    ],
  },
  {
    label: 'interval=7, due=today, earlier, reminder=on at 00:00',
    intervalDays: 7,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'late',
        at: 8726400000,
      },
    ],
  },
  {
    label: 'interval=7, due=today, earlier, reminder=on at 23:45',
    intervalDays: 7,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8725500000,
      },
      {
        kind: 'late',
        at: 8811900000,
      },
    ],
  },
  {
    label: 'interval=7, due=yesterday, reminder=off',
    intervalDays: 7,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=yesterday, reminder=on at 09:00',
    intervalDays: 7,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=yesterday, reminder=on at 20:15 with dayBefore',
    intervalDays: 7,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'late',
        at: 8712900000,
      },
    ],
  },
  {
    label: 'interval=7, due=yesterday, reminder=on at 00:00',
    intervalDays: 7,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=yesterday, reminder=on at 23:45',
    intervalDays: 7,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'late',
        at: 8725500000,
      },
    ],
  },
  {
    label: 'interval=7, due=5 days ago, reminder=off',
    intervalDays: 7,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=5 days ago, reminder=on at 09:00',
    intervalDays: 7,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=5 days ago, reminder=on at 20:15 with dayBefore',
    intervalDays: 7,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=5 days ago, reminder=on at 00:00',
    intervalDays: 7,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=5 days ago, reminder=on at 23:45',
    intervalDays: 7,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=40 days ago, reminder=off',
    intervalDays: 7,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=40 days ago, reminder=on at 09:00',
    intervalDays: 7,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=40 days ago, reminder=on at 20:15 with dayBefore',
    intervalDays: 7,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=40 days ago, reminder=on at 00:00',
    intervalDays: 7,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=7, due=40 days ago, reminder=on at 23:45',
    intervalDays: 7,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=null, reminder=off',
    intervalDays: 10,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=null, reminder=on at 09:00',
    intervalDays: 10,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=null, reminder=on at 20:15 with dayBefore',
    intervalDays: 10,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=null, reminder=on at 00:00',
    intervalDays: 10,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=null, reminder=on at 23:45',
    intervalDays: 10,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=3 days ahead, reminder=off',
    intervalDays: 10,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=3 days ahead, reminder=on at 09:00',
    intervalDays: 10,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8931600000,
      },
      {
        kind: 'late',
        at: 9018000000,
      },
    ],
  },
  {
    label: 'interval=10, due=3 days ahead, reminder=on at 20:15 with dayBefore',
    intervalDays: 10,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'day-before',
        at: 8885700000,
      },
      {
        kind: 'due',
        at: 8972100000,
      },
      {
        kind: 'late',
        at: 9058500000,
      },
    ],
  },
  {
    label: 'interval=10, due=3 days ahead, reminder=on at 00:00',
    intervalDays: 10,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8899200000,
      },
      {
        kind: 'late',
        at: 8985600000,
      },
    ],
  },
  {
    label: 'interval=10, due=3 days ahead, reminder=on at 23:45',
    intervalDays: 10,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8984700000,
      },
      {
        kind: 'late',
        at: 9071100000,
      },
    ],
  },
  {
    label: 'interval=10, due=tomorrow, reminder=off',
    intervalDays: 10,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=tomorrow, reminder=on at 09:00',
    intervalDays: 10,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8758800000,
      },
      {
        kind: 'late',
        at: 8845200000,
      },
    ],
  },
  {
    label: 'interval=10, due=tomorrow, reminder=on at 20:15 with dayBefore',
    intervalDays: 10,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'day-before',
        at: 8712900000,
      },
      {
        kind: 'due',
        at: 8799300000,
      },
      {
        kind: 'late',
        at: 8885700000,
      },
    ],
  },
  {
    label: 'interval=10, due=tomorrow, reminder=on at 00:00',
    intervalDays: 10,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8726400000,
      },
      {
        kind: 'late',
        at: 8812800000,
      },
    ],
  },
  {
    label: 'interval=10, due=tomorrow, reminder=on at 23:45',
    intervalDays: 10,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8811900000,
      },
      {
        kind: 'late',
        at: 8898300000,
      },
    ],
  },
  {
    label: 'interval=10, due=today, later than the reminder time, reminder=off',
    intervalDays: 10,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=today, later than the reminder time, reminder=on at 09:00',
    intervalDays: 10,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'late',
        at: 8758800000,
      },
    ],
  },
  {
    label:
      'interval=10, due=today, later than the reminder time, reminder=on at 20:15 with dayBefore',
    intervalDays: 10,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'late',
        at: 8799300000,
      },
    ],
  },
  {
    label: 'interval=10, due=today, later than the reminder time, reminder=on at 00:00',
    intervalDays: 10,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'late',
        at: 8726400000,
      },
    ],
  },
  {
    label: 'interval=10, due=today, later than the reminder time, reminder=on at 23:45',
    intervalDays: 10,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'late',
        at: 8811900000,
      },
    ],
  },
  {
    label: 'interval=10, due=today, earlier, reminder=off',
    intervalDays: 10,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=today, earlier, reminder=on at 09:00',
    intervalDays: 10,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8672400000,
      },
      {
        kind: 'late',
        at: 8758800000,
      },
    ],
  },
  {
    label: 'interval=10, due=today, earlier, reminder=on at 20:15 with dayBefore',
    intervalDays: 10,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'due',
        at: 8712900000,
      },
      {
        kind: 'late',
        at: 8799300000,
      },
    ],
  },
  {
    label: 'interval=10, due=today, earlier, reminder=on at 00:00',
    intervalDays: 10,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'late',
        at: 8726400000,
      },
    ],
  },
  {
    label: 'interval=10, due=today, earlier, reminder=on at 23:45',
    intervalDays: 10,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8725500000,
      },
      {
        kind: 'late',
        at: 8811900000,
      },
    ],
  },
  {
    label: 'interval=10, due=yesterday, reminder=off',
    intervalDays: 10,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=yesterday, reminder=on at 09:00',
    intervalDays: 10,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=yesterday, reminder=on at 20:15 with dayBefore',
    intervalDays: 10,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'late',
        at: 8712900000,
      },
    ],
  },
  {
    label: 'interval=10, due=yesterday, reminder=on at 00:00',
    intervalDays: 10,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=yesterday, reminder=on at 23:45',
    intervalDays: 10,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'late',
        at: 8725500000,
      },
    ],
  },
  {
    label: 'interval=10, due=5 days ago, reminder=off',
    intervalDays: 10,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=5 days ago, reminder=on at 09:00',
    intervalDays: 10,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=5 days ago, reminder=on at 20:15 with dayBefore',
    intervalDays: 10,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=5 days ago, reminder=on at 00:00',
    intervalDays: 10,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=5 days ago, reminder=on at 23:45',
    intervalDays: 10,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=40 days ago, reminder=off',
    intervalDays: 10,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=40 days ago, reminder=on at 09:00',
    intervalDays: 10,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=40 days ago, reminder=on at 20:15 with dayBefore',
    intervalDays: 10,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=40 days ago, reminder=on at 00:00',
    intervalDays: 10,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=10, due=40 days ago, reminder=on at 23:45',
    intervalDays: 10,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=null, reminder=off',
    intervalDays: 28,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=null, reminder=on at 09:00',
    intervalDays: 28,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=null, reminder=on at 20:15 with dayBefore',
    intervalDays: 28,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=null, reminder=on at 00:00',
    intervalDays: 28,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=null, reminder=on at 23:45',
    intervalDays: 28,
    dueAt: null,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=3 days ahead, reminder=off',
    intervalDays: 28,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=3 days ahead, reminder=on at 09:00',
    intervalDays: 28,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8931600000,
      },
      {
        kind: 'late',
        at: 9018000000,
      },
    ],
  },
  {
    label: 'interval=28, due=3 days ahead, reminder=on at 20:15 with dayBefore',
    intervalDays: 28,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'day-before',
        at: 8885700000,
      },
      {
        kind: 'due',
        at: 8972100000,
      },
      {
        kind: 'late',
        at: 9058500000,
      },
    ],
  },
  {
    label: 'interval=28, due=3 days ahead, reminder=on at 00:00',
    intervalDays: 28,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8899200000,
      },
      {
        kind: 'late',
        at: 8985600000,
      },
    ],
  },
  {
    label: 'interval=28, due=3 days ahead, reminder=on at 23:45',
    intervalDays: 28,
    dueAt: 8942400000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8984700000,
      },
      {
        kind: 'late',
        at: 9071100000,
      },
    ],
  },
  {
    label: 'interval=28, due=tomorrow, reminder=off',
    intervalDays: 28,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=tomorrow, reminder=on at 09:00',
    intervalDays: 28,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8758800000,
      },
      {
        kind: 'late',
        at: 8845200000,
      },
    ],
  },
  {
    label: 'interval=28, due=tomorrow, reminder=on at 20:15 with dayBefore',
    intervalDays: 28,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'day-before',
        at: 8712900000,
      },
      {
        kind: 'due',
        at: 8799300000,
      },
      {
        kind: 'late',
        at: 8885700000,
      },
    ],
  },
  {
    label: 'interval=28, due=tomorrow, reminder=on at 00:00',
    intervalDays: 28,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8726400000,
      },
      {
        kind: 'late',
        at: 8812800000,
      },
    ],
  },
  {
    label: 'interval=28, due=tomorrow, reminder=on at 23:45',
    intervalDays: 28,
    dueAt: 8769600000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8811900000,
      },
      {
        kind: 'late',
        at: 8898300000,
      },
    ],
  },
  {
    label: 'interval=28, due=today, later than the reminder time, reminder=off',
    intervalDays: 28,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=today, later than the reminder time, reminder=on at 09:00',
    intervalDays: 28,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'late',
        at: 8758800000,
      },
    ],
  },
  {
    label:
      'interval=28, due=today, later than the reminder time, reminder=on at 20:15 with dayBefore',
    intervalDays: 28,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'late',
        at: 8799300000,
      },
    ],
  },
  {
    label: 'interval=28, due=today, later than the reminder time, reminder=on at 00:00',
    intervalDays: 28,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'late',
        at: 8726400000,
      },
    ],
  },
  {
    label: 'interval=28, due=today, later than the reminder time, reminder=on at 23:45',
    intervalDays: 28,
    dueAt: 8683200000,
    now: 8725800000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'late',
        at: 8811900000,
      },
    ],
  },
  {
    label: 'interval=28, due=today, earlier, reminder=off',
    intervalDays: 28,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=today, earlier, reminder=on at 09:00',
    intervalDays: 28,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8672400000,
      },
      {
        kind: 'late',
        at: 8758800000,
      },
    ],
  },
  {
    label: 'interval=28, due=today, earlier, reminder=on at 20:15 with dayBefore',
    intervalDays: 28,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'due',
        at: 8712900000,
      },
      {
        kind: 'late',
        at: 8799300000,
      },
    ],
  },
  {
    label: 'interval=28, due=today, earlier, reminder=on at 00:00',
    intervalDays: 28,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'late',
        at: 8726400000,
      },
    ],
  },
  {
    label: 'interval=28, due=today, earlier, reminder=on at 23:45',
    intervalDays: 28,
    dueAt: 8683200000,
    now: 8640000000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'due',
        at: 8725500000,
      },
      {
        kind: 'late',
        at: 8811900000,
      },
    ],
  },
  {
    label: 'interval=28, due=yesterday, reminder=off',
    intervalDays: 28,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=yesterday, reminder=on at 09:00',
    intervalDays: 28,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=yesterday, reminder=on at 20:15 with dayBefore',
    intervalDays: 28,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [
      {
        kind: 'late',
        at: 8712900000,
      },
    ],
  },
  {
    label: 'interval=28, due=yesterday, reminder=on at 00:00',
    intervalDays: 28,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=yesterday, reminder=on at 23:45',
    intervalDays: 28,
    dueAt: 8596800000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [
      {
        kind: 'late',
        at: 8725500000,
      },
    ],
  },
  {
    label: 'interval=28, due=5 days ago, reminder=off',
    intervalDays: 28,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=5 days ago, reminder=on at 09:00',
    intervalDays: 28,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=5 days ago, reminder=on at 20:15 with dayBefore',
    intervalDays: 28,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=5 days ago, reminder=on at 00:00',
    intervalDays: 28,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=5 days ago, reminder=on at 23:45',
    intervalDays: 28,
    dueAt: 8251200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=40 days ago, reminder=off',
    intervalDays: 28,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: false,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=40 days ago, reminder=on at 09:00',
    intervalDays: 28,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 9,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=40 days ago, reminder=on at 20:15 with dayBefore',
    intervalDays: 28,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 20,
      minute: 15,
      dayBefore: true,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=40 days ago, reminder=on at 00:00',
    intervalDays: 28,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 0,
      minute: 0,
      dayBefore: false,
    },
    expected: [],
  },
  {
    label: 'interval=28, due=40 days ago, reminder=on at 23:45',
    intervalDays: 28,
    dueAt: 5227200000,
    now: 8683200000,
    reminder: {
      enabled: true,
      hour: 23,
      minute: 45,
      dayBefore: false,
    },
    expected: [],
  },
]

describe('planReminders characterisation', () => {
  it('covers the 6 x 8 x 5 grid (240 cases)', () => {
    expect(CASES).toHaveLength(240)
  })

  it.each(CASES)('$label', (c) => {
    expect(plan(c)).toEqual(c.expected)
  })
})
