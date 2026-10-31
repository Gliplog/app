<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { db, repository } from '@/db'
import {
  backupFileName,
  BackupFormatError,
  exportBackup,
  exportBackupArchive,
  readBackupFile,
  restoreBackup,
} from '@/db/backup'
import { ADULT_AGE } from '@/domain/body'
import {
  cmToFeetInches,
  feetInchesToCm,
  formatHeight,
  fromKg,
  roundTo,
  toKg,
  type HeightUnit,
  type WeightUnit,
} from '@/domain/units'
import type { A1cUnit, GlucoseUnit } from '@/domain/glucose'
import {
  GENDER_LABELS,
  GENDERS,
  useSettingsStore,
  type Gender,
  type ThemePreference,
} from '@/stores/settings'
import { useJournalStore } from '@/stores/journal'
import { usePhotosStore } from '@/stores/photos'
import { useNotifyStore } from '@/stores/notify'
import { useConfirmStore } from '@/stores/confirm'
import { useStoragePersistence } from '@/composables/useStoragePersistence'
import { useInstallPrompt } from '@/composables/useInstallPrompt'
import { remindersSupported } from '@/composables/useReminderSync'
import AddReminderDialog from '@/components/reminders/AddReminderDialog.vue'
import { toTimeValue } from '@/domain/reminders'
import { describeInterval } from '@/domain/calendar'
import {
  checkNotificationAccess,
  openNotificationSettings,
  requestNotificationAccess,
  type NotificationAccess,
} from '@/services/reminders/notificationAccess'
import { nativeApps, notificationSettingsSteps } from '@/services/platform'
import type { MedicationRow } from '@/db/database'
import { saveFile } from '@/services/fileTransfer'
import { daysBetween, formatDateTime, systemClock } from '@/services/time'
import {
  mdiBellOutline,
  mdiCellphoneArrowDown,
  mdiCheckCircleOutline,
  mdiCloudOffOutline,
  mdiDeleteOutline,
  mdiDownload,
  mdiShieldLockOutline,
  mdiTrayArrowUp,
} from '@/plugins/icons'

const settings = useSettingsStore()
const journal = useJournalStore()
const photos = usePhotosStore()
const notify = useNotifyStore()
const confirm = useConfirmStore()
const theme = useTheme()
const storage = useStoragePersistence()
const install = useInstallPrompt()
// Android file providers often label a backup as a generic type, which would grey it out in
// the native picker; readBackupFile rejects anything that is not a backup.
const backupAccept = __NATIVE__ ? undefined : 'application/json,.json,application/zip,.zip'
const includePhotos = ref(true)
const fileInput = ref<HTMLInputElement | null>(null)
const busy = ref(false)

const version = __APP_VERSION__
const PRIVACY_URL = 'https://gliplog.com/privacy.html'
const SOURCE_URL = 'https://github.com/Gliplog/app'

const themeModel = computed({
  get: () => settings.theme,
  set: (value: ThemePreference) => {
    void settings.setTheme(value)
    theme.change(value)
  },
})

const weightUnitModel = computed({
  get: () => settings.weightUnit,
  set: (value: WeightUnit) => void settings.setWeightUnit(value),
})

const heightUnitModel = computed({
  get: () => settings.heightUnit,
  set: (value: HeightUnit) => void settings.setHeightUnit(value),
})

const glucoseUnitModel = computed({
  get: () => settings.glucoseUnit,
  set: (value: GlucoseUnit) => void settings.setGlucoseUnit(value),
})

const a1cUnitModel = computed({
  get: () => settings.a1cUnit,
  set: (value: A1cUnit) => void settings.setA1cUnit(value),
})

const genderItems = GENDERS.map((g) => ({ title: GENDER_LABELS[g], value: g }))

/*
 * The profile form holds what the user is typing; Save writes only valid values. It is filled
 * from the store whenever the store or the display units change.
 */
const form = reactive({
  cm: '',
  feet: '',
  inches: '',
  gender: 'unspecified' as Gender,
  genderText: '',
  goal: '',
})

function fillForm() {
  const p = settings.profile
  form.cm = p.heightCm ? String(roundTo(p.heightCm, 1)) : ''
  const fi = p.heightCm ? cmToFeetInches(p.heightCm) : null
  form.feet = fi ? String(fi.feet) : ''
  form.inches = fi ? String(fi.inches) : ''
  form.gender = p.gender
  form.genderText = p.genderText
  form.goal = p.goalKg ? String(roundTo(fromKg(p.goalKg, settings.weightUnit), 1)) : ''
}
watch(() => [settings.profile, settings.weightUnit, settings.loaded], fillForm, {
  immediate: true,
})

const parsed = computed(() => {
  const num = (t: string) => (t.trim() === '' ? null : Number(t))
  let heightCm: number | null = null
  let heightError: string | undefined
  if (settings.heightUnit === 'cm') {
    const cm = num(form.cm)
    if (cm !== null) {
      if (cm >= 50 && cm <= 272) heightCm = cm
      else heightError = 'Between 50 and 272 cm'
    }
  } else {
    const ft = num(form.feet)
    const inch = num(form.inches) ?? 0
    if (ft !== null) {
      const cm = feetInchesToCm({ feet: ft, inches: inch })
      if (Number.isInteger(ft) && inch >= 0 && inch < 12 && cm >= 50 && cm <= 272) heightCm = cm
      else heightError = 'Feet as a whole number, inches 0 to 11.9'
    }
  }
  const goalValue = num(form.goal)
  let goalKg: number | null = null
  let goalError: string | undefined
  if (goalValue !== null) {
    const kg = toKg(goalValue, settings.weightUnit)
    if (kg >= 20 && kg <= 400) goalKg = kg
    else goalError = 'Enter a weight you can reach on a scale'
  }
  return { heightCm, heightError, goalKg, goalError }
})

const profileValid = computed(() => !parsed.value.heightError && !parsed.value.goalError)

async function saveProfile() {
  if (!profileValid.value) return
  const p = parsed.value
  await settings.updateProfile({
    heightCm: p.heightCm,
    gender: form.gender,
    genderText: form.gender === 'self' ? form.genderText.trim() : '',
    goalKg: p.goalKg,
  })
  notify.show('Profile saved', 'success')
}

const backupAge = computed(() =>
  settings.lastBackupAt ? daysBetween(settings.lastBackupAt, systemClock()) : null,
)
const hasData = computed(
  () => journal.doses.length > 0 || journal.weights.length > 0 || photos.photos.length > 0,
)
const backupStale = computed(
  () => hasData.value && (backupAge.value === null || backupAge.value > 14),
)

async function exportData() {
  busy.value = true
  try {
    let result: Awaited<ReturnType<typeof saveFile>>
    let backup
    if (photos.photos.length && includePhotos.value) {
      const archive = await exportBackupArchive(db)
      backup = archive.backup
      result = await saveFile(
        backupFileName(backup.exportedAt, true),
        new Blob([archive.bytes as BlobPart], { type: 'application/zip' }),
      )
    } else {
      backup = await exportBackup(db)
      result = await saveFile(backupFileName(backup.exportedAt), JSON.stringify(backup, null, 2))
    }
    if (result !== 'cancelled') {
      await settings.markBackedUp(backup.exportedAt)
      notify.show('Backup saved', 'success')
    }
  } catch {
    notify.show("Couldn't save the backup. Your device may be out of space.", 'error')
  } finally {
    busy.value = false
  }
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`
const describe = (doses: number, weights: number, photoCount = 0) =>
  photoCount
    ? `${plural(doses, 'dose')}, ${plural(weights, 'weigh-in')} and ${plural(photoCount, 'photo')}`
    : `${plural(doses, 'dose')} and ${plural(weights, 'weigh-in')}`

async function importData(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const { backup, photoFiles } = readBackupFile(new Uint8Array(await file.arrayBuffer()))
    const mine = describe(journal.doses.length, journal.weights.length, photos.photos.length)
    const theirs = describe(backup.doses.length, backup.weights.length, backup.photos.length)
    const losesPhotos = photos.photos.length > 0 && backup.photos.length === 0
    const ok = await confirm.ask({
      title: 'Replace everything on this device?',
      text: `Your ${mine} will be replaced with ${theirs} from the backup.${losesPhotos ? ' This backup has no photos, so your photos will be deleted.' : ''}`,
      confirmText: 'Restore backup',
      destructive: true,
    })
    if (!ok) return
    await restoreBackup(db, backup, photoFiles)
    await Promise.all([journal.load(), settings.load(), photos.load()])
    theme.change(settings.theme)
    notify.show('Backup restored', 'success')
  } catch (e) {
    notify.show(e instanceof BackupFormatError ? e.message : "Couldn't read that file.", 'error')
  }
}

async function eraseEverything() {
  const ok = await confirm.ask({
    title: 'Erase everything?',
    text: `This deletes your profile, medications, ${describe(journal.doses.length, journal.weights.length, photos.photos.length)} from this device. Save a backup first if you might want them.`,
    confirmText: 'Erase everything',
    destructive: true,
  })
  if (!ok) return
  await repository.eraseAll()
  await Promise.all([journal.load(), settings.load(), photos.load()])
  theme.change(settings.theme)
  notify.show('Everything erased', 'success')
}

/*
 * Reminders switched on can still be silenced: after a restore onto a new phone, or when
 * notifications are turned off in the phone's settings. Say so rather than fail quietly, and
 * check again when the user comes back from them.
 */
const access = ref<NotificationAccess | null>(null)
const anyReminderOn = computed(() =>
  journal.activeMedications.some((m) => settings.reminderFor(m.id).enabled),
)
const notificationsBlocked = computed(
  () => anyReminderOn.value && (access.value === 'denied' || access.value === 'prompt'),
)

async function checkNotifications() {
  access.value = anyReminderOn.value ? await checkNotificationAccess() : null
}

function onVisible() {
  if (document.visibilityState === 'visible') void checkNotifications()
}
onMounted(() => {
  void checkNotifications()
  document.addEventListener('visibilitychange', onVisible)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisible))
watch(anyReminderOn, checkNotifications)

async function fixNotifications() {
  if (access.value === 'denied') {
    if (!(await openNotificationSettings())) notify.show(notificationSettingsSteps, 'info')
    return
  }
  access.value = await requestNotificationAccess()
}

const reminderOpen = ref(false)
const reminderFor = ref<MedicationRow | null>(null)

function openReminder(med: MedicationRow) {
  reminderFor.value = med
  reminderOpen.value = true
}

/** What a medication's row says about its reminder. */
function reminderStatus(med: MedicationRow): string {
  const r = settings.reminderFor(med.id)
  if (remindersSupported && r.enabled) return `Notify me at ${toTimeValue(r)}`
  return remindersSupported ? 'No reminder' : `Dose ${describeInterval(med.intervalDays)}`
}

async function promptInstall() {
  if (await install.actions.promptInstall()) notify.show('Gliplog installed', 'success')
}

const formatMb = (bytes: number | null) =>
  bytes === null ? '?' : `${(bytes / 1_048_576).toFixed(1)} MB`
</script>

<template>
  <div class="gl-page settings">
    <header class="mb-4">
      <p class="gl-eyebrow">Preferences</p>
      <h1 class="gl-display text-headline-large">Settings</h1>
    </header>

    <div class="settings-grid">
      <v-card>
        <v-card-item>
          <p class="gl-eyebrow">About you</p>
          <v-card-title>Profile</v-card-title>
        </v-card-item>
        <v-card-text class="gl-stack">
          <div v-if="settings.heightUnit === 'cm'">
            <v-text-field
              v-model="form.cm"
              label="Height"
              suffix="cm"
              type="number"
              inputmode="decimal"
              :error-messages="parsed.heightError"
            />
          </div>
          <div v-else class="d-flex ga-3 align-start">
            <v-text-field
              v-model="form.feet"
              label="Height, feet"
              suffix="ft"
              type="number"
              inputmode="numeric"
              :error-messages="parsed.heightError"
            />
            <v-text-field
              v-model="form.inches"
              label="Inches"
              suffix="in"
              type="number"
              inputmode="decimal"
              :error="!!parsed.heightError"
            />
          </div>
          <v-select v-model="form.gender" :items="genderItems" label="Gender" />
          <v-text-field
            v-if="form.gender === 'self'"
            v-model="form.genderText"
            label="In your words"
            maxlength="60"
            autocomplete="off"
          />
          <p class="text-body-small gl-muted">
            Not used in any calculation. It's here so your record describes you.
          </p>
          <v-text-field
            v-model="form.goal"
            label="Goal weight (optional)"
            :suffix="settings.weightUnit"
            type="number"
            inputmode="decimal"
            :error-messages="parsed.goalError"
          />
          <div class="gl-actions">
            <v-btn color="primary" variant="flat" :disabled="!profileValid" @click="saveProfile">
              Save profile
            </v-btn>
          </div>
          <p v-if="settings.profile.heightCm" class="text-body-small gl-faint">
            Saved height: {{ formatHeight(settings.profile.heightCm, settings.heightUnit) }}
          </p>
        </v-card-text>
      </v-card>

      <v-card>
        <v-card-item>
          <p class="gl-eyebrow">Display</p>
          <v-card-title>Units and appearance</v-card-title>
        </v-card-item>
        <v-card-text class="gl-stack">
          <div>
            <p id="weight-unit-label" class="gl-label">Weight unit</p>
            <v-btn-toggle
              v-model="weightUnitModel"
              role="group"
              mandatory
              density="comfortable"
              aria-labelledby="weight-unit-label"
            >
              <v-btn value="kg">Kilograms</v-btn>
              <v-btn value="lb">Pounds</v-btn>
            </v-btn-toggle>
          </div>
          <div>
            <p id="height-unit-label" class="gl-label">Height unit</p>
            <v-btn-toggle
              v-model="heightUnitModel"
              role="group"
              mandatory
              density="comfortable"
              aria-labelledby="height-unit-label"
            >
              <v-btn value="cm">Centimetres</v-btn>
              <v-btn value="ftin">Feet and inches</v-btn>
            </v-btn-toggle>
          </div>
          <div>
            <p id="glucose-unit-label" class="gl-label">Blood glucose unit</p>
            <v-btn-toggle
              v-model="glucoseUnitModel"
              role="group"
              mandatory
              density="comfortable"
              aria-labelledby="glucose-unit-label"
            >
              <v-btn value="mg/dL">mg/dL</v-btn>
              <v-btn value="mmol/L">mmol/L</v-btn>
            </v-btn-toggle>
          </div>
          <div>
            <p id="a1c-unit-label" class="gl-label">HbA1c unit</p>
            <v-btn-toggle
              v-model="a1cUnitModel"
              role="group"
              mandatory
              density="comfortable"
              aria-labelledby="a1c-unit-label"
            >
              <v-btn value="%">Percent (%)</v-btn>
              <v-btn value="mmol/mol">mmol/mol</v-btn>
            </v-btn-toggle>
          </div>
          <div>
            <p id="theme-label" class="gl-label">Theme</p>
            <v-btn-toggle
              v-model="themeModel"
              role="group"
              mandatory
              density="comfortable"
              aria-labelledby="theme-label"
            >
              <v-btn value="system">System</v-btn>
              <v-btn value="light">Light</v-btn>
              <v-btn value="dark">Dark</v-btn>
            </v-btn-toggle>
          </div>
          <p class="text-body-small gl-muted">
            Switch units any time. Your entries convert automatically.
          </p>
        </v-card-text>
      </v-card>

      <v-card>
        <v-card-item>
          <p class="gl-eyebrow">Reminders</p>
          <v-card-title>Dose reminders</v-card-title>
        </v-card-item>
        <v-card-text v-if="!journal.activeMedications.length" class="gl-stack">
          <p>Add a medication on Today to set a reminder for it.</p>
        </v-card-text>
        <v-card-text v-else class="gl-stack gl-stack--loose">
          <p>
            {{
              remindersSupported
                ? 'Get a notification on the day a dose is due, or add a calendar invite.'
                : `Add a calendar invite, and your calendar will remind you. A web app can't send notifications on its own without a server; ${nativeApps} can.`
            }}
          </p>
          <v-alert v-if="notificationsBlocked" type="warning" variant="tonal" density="compact">
            <p>Notifications are off for Gliplog, so reminders won't appear.</p>
            <div class="gl-actions">
              <v-btn variant="tonal" @click="fixNotifications">
                {{ access === 'denied' ? 'Open settings' : 'Allow notifications' }}
              </v-btn>
            </div>
          </v-alert>
          <ul class="reminder-rows">
            <li v-for="med in journal.activeMedications" :key="med.id" class="reminder-row">
              <div class="reminder-row__text">
                <span class="reminder-row__name">{{ med.name }}</span>
                <span class="text-body-small gl-muted">{{ reminderStatus(med) }}</span>
              </div>
              <v-btn
                variant="tonal"
                :prepend-icon="mdiBellOutline"
                :aria-label="`Add reminder for ${med.name}`"
                @click="openReminder(med)"
              >
                Add reminder
              </v-btn>
            </li>
          </ul>
          <template v-if="remindersSupported">
            <v-divider />
            <div class="gl-stack gl-stack--tight">
              <v-switch
                :model-value="settings.reminders.showNames"
                label="Show medication names in reminders"
                color="primary"
                hide-details
                @update:model-value="settings.setReminderNames(!!$event)"
              />
              <p class="text-body-small gl-muted">When off, reminders just say a dose is due.</p>
            </div>
          </template>
        </v-card-text>
      </v-card>

      <AddReminderDialog v-model="reminderOpen" :medication="reminderFor" />

      <v-card>
        <v-card-item>
          <p class="gl-eyebrow">Your data</p>
          <v-card-title>Backup and restore</v-card-title>
        </v-card-item>
        <v-card-text class="gl-stack">
          <p>
            Your data is only on this device. Clearing site data or uninstalling deletes it, so keep
            a backup.
          </p>
          <v-alert v-if="backupStale" type="warning" variant="tonal" density="compact">
            {{
              settings.lastBackupAt
                ? `Last backup ${backupAge} days ago.`
                : "You haven't made a backup yet."
            }}
          </v-alert>
          <p v-else-if="settings.lastBackupAt" class="gl-muted">
            Last backup {{ formatDateTime(settings.lastBackupAt) }}
          </p>
          <div v-if="photos.photos.length" class="gl-stack gl-stack--tight">
            <v-switch
              v-model="includePhotos"
              :label="`Include ${plural(photos.photos.length, 'photo')}`"
              color="primary"
              hide-details
            />
            <p class="text-body-small gl-muted">
              With photos, the backup is a .zip file. Keep it somewhere private: it holds your
              photos as ordinary images.
            </p>
          </div>
          <div class="d-flex flex-wrap ga-2">
            <v-btn
              color="primary"
              variant="flat"
              :prepend-icon="mdiDownload"
              :loading="busy"
              @click="exportData"
            >
              Save a backup
            </v-btn>
            <v-btn variant="outlined" :prepend-icon="mdiTrayArrowUp" @click="fileInput?.click()">
              Restore from file
            </v-btn>
            <input
              ref="fileInput"
              type="file"
              :accept="backupAccept"
              class="d-none"
              aria-label="Backup file"
              @change="importData"
            />
          </div>
          <p class="text-body-small gl-muted">
            On iPhone and iPad, Safari and the Home Screen app keep separate data. Use a backup to
            move between them.
          </p>
          <v-divider />
          <div>
            <v-btn
              variant="text"
              color="error"
              :prepend-icon="mdiDeleteOutline"
              @click="eraseEverything"
            >
              Erase everything
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

      <v-card>
        <v-card-item>
          <p class="gl-eyebrow">Install</p>
          <v-card-title>Add to Home Screen</v-card-title>
        </v-card-item>
        <v-card-text class="gl-stack">
          <p v-if="install.state.standalone" class="d-flex align-center ga-2">
            <v-icon :icon="mdiCheckCircleOutline" color="success" />
            Installed
          </p>
          <template v-else>
            <p>Install Gliplog to open it full screen and use it offline.</p>
            <v-btn
              v-if="install.canPrompt.value"
              color="primary"
              variant="flat"
              :prepend-icon="mdiCellphoneArrowDown"
              class="align-self-start"
              @click="promptInstall"
            >
              Install Gliplog
            </v-btn>
            <template v-else>
              <!-- Step wording matches the menu labels in each screenshot. -->
              <ol class="install-steps">
                <template v-if="install.state.platform === 'ios-safari'">
                  <li>Tap the <strong>Share</strong> button.</li>
                  <li>
                    Tap <strong>View More</strong> if needed, then choose
                    <strong>Add to Home Screen</strong>.
                  </li>
                  <li>Tap <strong>Add</strong>.</li>
                </template>
                <template v-else-if="install.state.platform === 'ios-chrome'">
                  <li>Tap the <strong>Share</strong> button in the address bar.</li>
                  <li>Scroll down and choose <strong>Add to Home Screen</strong>.</li>
                  <li>Tap <strong>Add</strong>.</li>
                </template>
                <template v-else-if="install.state.platform === 'android-firefox'">
                  <li>Open the Firefox menu (<strong>⋮</strong>).</li>
                  <li>Choose <strong>Add app to Home screen</strong>, then confirm.</li>
                </template>
                <template v-else-if="install.state.platform === 'android-chrome'">
                  <li>Open the Chrome menu (<strong>⋮</strong>).</li>
                  <li>
                    Choose <strong>Install and create shortcut</strong> (or
                    <strong>Add to Home screen</strong>), then confirm.
                  </li>
                </template>
                <template v-else>
                  <li>Open the browser menu.</li>
                  <li>
                    Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                  </li>
                </template>
              </ol>
            </template>
          </template>
        </v-card-text>
      </v-card>

      <v-card>
        <v-card-item>
          <p class="gl-eyebrow">Privacy</p>
          <v-card-title>Nothing leaves this device</v-card-title>
        </v-card-item>
        <v-card-text class="gl-stack">
          <ul class="privacy-list">
            <li>
              <v-icon :icon="mdiShieldLockOutline" size="small" /> No account, server, tracking or
              ads.
            </li>
            <li><v-icon :icon="mdiCloudOffOutline" size="small" /> Works offline.</li>
          </ul>
          <p class="text-body-small gl-muted">
            Storage:
            {{
              storage.state.persisted
                ? 'protected'
                : 'not protected (the browser may clear it when space is low)'
            }}
            <template v-if="storage.state.usageBytes !== null">
              · {{ formatMb(storage.state.usageBytes) }} used
            </template>
          </p>
          <p class="text-body-small">
            <a :href="PRIVACY_URL" target="_blank" rel="noopener noreferrer">Privacy policy</a>
          </p>
        </v-card-text>
      </v-card>

      <v-card>
        <v-card-item>
          <p class="gl-eyebrow">About and terms</p>
          <v-card-title>Gliplog {{ version }}</v-card-title>
        </v-card-item>
        <v-card-text class="about">
          <p>
            Gliplog is a free, private journal for GLP-1 medicine and weight. It shows published
            figures with their sources. It doesn't recommend doses and isn't medical advice or a
            medical device. Ask your prescriber or pharmacist about your treatment.
          </p>
          <p>
            You must be {{ ADULT_AGE }} or older to use Gliplog, or the age of majority where you
            live if that is higher.
          </p>
          <p>
            Trial figures are group averages from US prescribing information. Level charts are
            estimates, not blood levels. Compounded medicines are not FDA-approved.
          </p>
          <p>
            Ozempic, Wegovy and Rybelsus are trademarks of Novo Nordisk A/S. Mounjaro, Zepbound and
            Foundayo are trademarks of Eli Lilly and Company. Brand names are used only to identify
            the medicines. Gliplog is not affiliated with, endorsed by or sponsored by Novo Nordisk,
            Eli Lilly or any other manufacturer or pharmacy.
          </p>
          <p>
            Gliplog is free software under the GNU Affero General Public License, version 3
            (AGPL-3.0). It is provided as is, without warranty of any kind. You are responsible for
            how you use it.
          </p>
          <p class="text-body-small">
            <a :href="SOURCE_URL" target="_blank" rel="noopener noreferrer">Source code</a>
          </p>
        </v-card-text>
      </v-card>
    </div>
  </div>
</template>

<style scoped>
.settings-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
  align-items: start;
}

.install-steps {
  padding-left: 20px;
  margin: 0;
}

.install-steps li + li {
  margin-top: 4px;
}

.privacy-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 6px;
}

.about p + p {
  margin-top: 12px;
}
.reminder-rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reminder-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}

.reminder-row__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.reminder-row__name {
  font-weight: 600;
}
</style>
