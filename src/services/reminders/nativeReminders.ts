import { registerPlugin } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { PlannedReminder } from '@/domain/reminders'
import { toDate } from '@/services/time'

const CHANNEL_ID = 'doses'

export interface ScheduledReminder extends PlannedReminder {
  title: string
  body: string
}

/** The app's own plugin: NotificationSettingsPlugin.java on Android, .swift on iOS. */
const NotificationSettings = registerPlugin<{ open(): Promise<void> }>('NotificationSettings')

export type NativeNotificationAccess = 'granted' | 'denied' | 'prompt'

/*
 * Android reports "prompt-with-rationale" after one refusal: asking again still shows the system
 * dialog, so it counts as prompt. Only "denied" means the dialog will not appear again, which on
 * iOS is the case after the first refusal.
 */
function toAccess(display: string): NativeNotificationAccess {
  return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt'
}

/** Whether the system lets Gliplog post notifications now, without asking. */
export async function checkAccess(): Promise<NativeNotificationAccess> {
  return toAccess((await LocalNotifications.checkPermissions()).display)
}

/** Shows the system's notification permission dialog when it still can. */
export async function requestAccess(): Promise<NativeNotificationAccess> {
  return toAccess((await LocalNotifications.requestPermissions()).display)
}

export async function openSettings(): Promise<void> {
  await NotificationSettings.open()
}

/**
 * Replace every pending reminder with `reminders`. The whole set is rebuilt each time, so ids
 * only need to be unique within one call, and a deleted medication's reminders simply vanish.
 * On Android alarms are inexact (it may shift them by minutes to save battery): a dose reminder
 * does not need to-the-minute timing, and exact alarms need a permission Gliplog does not ask
 * for. iOS delivers at the time given.
 */
export async function scheduleReminders(reminders: ScheduledReminder[]): Promise<void> {
  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length) {
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((n) => ({ id: n.id })),
    })
  }
  if (!reminders.length) return
  // Channels exist only on Android; iOS rejects the call. Private visibility: a secure lock
  // screen shows that Gliplog has a notification, not its text.
  if (__PLATFORM__ === 'android') {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Dose reminders',
      description: 'When a dose you log is due again',
      importance: 4,
      visibility: 0,
    })
  }
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
