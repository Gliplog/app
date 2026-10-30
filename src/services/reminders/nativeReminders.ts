import { LocalNotifications } from '@capacitor/local-notifications'
import type { PlannedReminder } from '@/domain/reminders'
import { toDate } from '@/services/time'

const CHANNEL_ID = 'doses'

export interface ScheduledReminder extends PlannedReminder {
  title: string
  body: string
}

/** Whether Android lets Gliplog post notifications now, without asking. */
export async function notificationsAllowed(): Promise<boolean> {
  return (await LocalNotifications.checkPermissions()).display === 'granted'
}

/** Whether Android lets Gliplog post notifications, asking the user if it has not yet. */
export async function requestNotificationPermission(): Promise<boolean> {
  const status = await LocalNotifications.checkPermissions()
  if (status.display === 'granted') return true
  return (await LocalNotifications.requestPermissions()).display === 'granted'
}

/**
 * Replace every pending reminder with `reminders`. The whole set is rebuilt each time, so ids
 * only need to be unique within one call, and a deleted medication's reminders simply vanish.
 * Alarms are inexact (Android may shift them by minutes to save battery): a dose reminder does
 * not need to-the-minute timing, and exact alarms need a permission Gliplog does not ask for.
 */
export async function scheduleReminders(reminders: ScheduledReminder[]): Promise<void> {
  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length) {
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((n) => ({ id: n.id })),
    })
  }
  if (!reminders.length) return
  // Private visibility: a secure lock screen shows that Gliplog has a notification, not its text.
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Dose reminders',
    description: 'When a dose you log is due again',
    importance: 4,
    visibility: 0,
  })
  await LocalNotifications.schedule({
    notifications: reminders.map((r, i) => ({
      id: i + 1,
      title: r.title,
      body: r.body,
      channelId: CHANNEL_ID,
      schedule: { at: toDate(r.at), allowWhileIdle: true },
      isExactNotification: false,
      extra: { medicationId: r.medicationId },
    })),
  })
}

/**
 * Call `handler` with the medication a tapped reminder is for. The plugin holds a tap that
 * launched the app until a listener attaches, so registering after startup still sees it.
 */
export async function onReminderTap(handler: (medicationId: string) => void): Promise<void> {
  await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const id: unknown = (action.notification.extra as { medicationId?: unknown } | undefined)
      ?.medicationId
    if (typeof id === 'string') handler(id)
  })
}
