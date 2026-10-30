import { describe, expect, it } from 'vitest'
import {
  calendarTitle,
  describeInterval,
  googleCalendarUrl,
  icsFile,
  outlookCalendarUrl,
  recurrenceRule,
  type CalendarEvent,
} from '@/domain/calendar'

const event: CalendarEvent = {
  uid: 'med-1-20261105@gliplog.com',
  title: 'Dose due',
  description: 'From your schedule in Gliplog; add it again if your dose day changes.',
  start: { year: 2026, month: 11, day: 5, hour: 9, minute: 0 },
  end: { year: 2026, month: 11, day: 5, hour: 9, minute: 15 },
  startUtc: '2026-11-05T09:00:00.000Z',
  endUtc: '2026-11-05T09:15:00.000Z',
  timeZone: 'Europe/London',
  intervalDays: 7,
  createdUtc: '2026-10-30T12:00:00.000Z',
}

describe('recurrenceRule', () => {
  it('writes whole weeks as weekly and anything else as days', () => {
    expect(recurrenceRule(7)).toBe('FREQ=WEEKLY;INTERVAL=1')
    expect(recurrenceRule(14)).toBe('FREQ=WEEKLY;INTERVAL=2')
    expect(recurrenceRule(1)).toBe('FREQ=DAILY;INTERVAL=1')
    expect(recurrenceRule(10)).toBe('FREQ=DAILY;INTERVAL=10')
    expect(() => recurrenceRule(0)).toThrow(RangeError)
  })

  it('describes the interval in words', () => {
    expect(describeInterval(7)).toBe('every week')
    expect(describeInterval(14)).toBe('every 2 weeks')
    expect(describeInterval(1)).toBe('every day')
    expect(describeInterval(3)).toBe('every 3 days')
  })
})

describe('calendar links', () => {
  it('fills a repeating Google Calendar event at local time', () => {
    const url = new URL(googleCalendarUrl(event))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe('Dose due')
    expect(url.searchParams.get('dates')).toBe('20261105T090000/20261105T091500')
    expect(url.searchParams.get('ctz')).toBe('Europe/London')
    expect(url.searchParams.get('recur')).toBe('RRULE:FREQ=WEEKLY;INTERVAL=1')
  })

  it('fills an Outlook event in UTC on the chosen host', () => {
    const url = new URL(outlookCalendarUrl(event, 'outlook.office.com'))
    expect(url.host).toBe('outlook.office.com')
    expect(url.searchParams.get('rru')).toBe('addevent')
    expect(url.searchParams.get('subject')).toBe('Dose due')
    expect(url.searchParams.get('startdt')).toBe('2026-11-05T09:00:00Z')
    expect(url.searchParams.get('enddt')).toBe('2026-11-05T09:15:00Z')
  })

  it('names the medicine only when asked', () => {
    expect(calendarTitle(null)).toBe('Dose due')
    expect(calendarTitle('Wegovy')).toBe('Wegovy dose due')
  })
})

describe('icsFile', () => {
  const ics = icsFile(event)

  it('writes one repeating event with an alert, in floating local time', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('\r\nDTSTART:20261105T090000\r\n')
    expect(ics).toContain('\r\nDTEND:20261105T091500\r\n')
    expect(ics).toContain('\r\nDTSTAMP:20261030T120000Z\r\n')
    expect(ics).toContain('\r\nRRULE:FREQ=WEEKLY;INTERVAL=1\r\n')
    expect(ics).toContain('\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\n')
  })

  it('escapes text and folds long lines', () => {
    expect(ics).toContain('DESCRIPTION:From your schedule in Gliplog\\; add it again')
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
    const unfolded = ics.replace(/\r\n /g, '')
    expect(unfolded).toContain(
      'DESCRIPTION:From your schedule in Gliplog\\; add it again if your dose day changes.',
    )
  })
})
