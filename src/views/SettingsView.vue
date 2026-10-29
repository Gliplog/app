<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { db, repository } from '@/db'
import {
  backupFileName,
  BackupFormatError,
  exportBackup,
  parseBackup,
  restoreBackup,
} from '@/db/backup'
import { ADULT_AGE, ageOn } from '@/domain/body'
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
import {
  GENDER_LABELS,
  GENDERS,
  useSettingsStore,
  type Gender,
  type ThemePreference,
} from '@/stores/settings'
import { useJournalStore } from '@/stores/journal'
import { useNotifyStore } from '@/stores/notify'
import { useConfirmStore } from '@/stores/confirm'
import { useStoragePersistence } from '@/composables/useStoragePersistence'
import { useInstallPrompt } from '@/composables/useInstallPrompt'
import { saveFile } from '@/services/fileTransfer'
import {
  calendarMonth,
  daysBetween,
  formatBirthMonth,
  formatDateTime,
  monthNames,
  systemClock,
} from '@/services/time'
import {
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
const notify = useNotifyStore()
const confirm = useConfirmStore()
const theme = useTheme()
const storage = useStoragePersistence()
const install = useInstallPrompt()
// Android file providers often label a .json backup as a generic type, which would grey it out
// in the native picker; parseBackup rejects anything that is not a backup.
const backupAccept = __NATIVE__ ? undefined : 'application/json,.json'
const fileInput = ref<HTMLInputElement | null>(null)
const busy = ref(false)

const version = __APP_VERSION__
const PRIVACY_URL = 'https://tidebook.github.io/privacy.html'

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

const months = monthNames().map((title, i) => ({ title, value: i + 1 }))
const genderItems = GENDERS.map((g) => ({ title: GENDER_LABELS[g], value: g }))

/*
 * The profile form holds what the user is typing; Save writes only valid values. It is filled
 * from the store whenever the store or the display units change.
 */
const form = reactive({
  cm: '',
  feet: '',
  inches: '',
  birthMonth: null as number | null,
  birthYear: '',
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
  const [y, m] = p.birthMonth ? p.birthMonth.split('-') : []
  form.birthYear = y ?? ''
  form.birthMonth = m ? Number(m) : null
  form.gender = p.gender
  form.genderText = p.genderText
  form.goal = p.goalKg ? String(roundTo(fromKg(p.goalKg, settings.weightUnit), 1)) : ''
}
watch(() => [settings.profile, settings.weightUnit, settings.loaded], fillForm, {
  immediate: true,
})

const thisYear = calendarMonth(systemClock().getTime()).year

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
  const year = num(form.birthYear)
  let birthMonth: string | null = null
  let birthError: string | undefined
  if (year !== null || form.birthMonth !== null) {
    if (
      year !== null &&
      Number.isInteger(year) &&
      year >= 1900 &&
      year <= thisYear &&
      form.birthMonth
    )
      birthMonth = `${year}-${String(form.birthMonth).padStart(2, '0')}`
    else birthError = 'Choose a month and a year'
  }
  const goalValue = num(form.goal)
  let goalKg: number | null = null
  let goalError: string | undefined
  if (goalValue !== null) {
    const kg = toKg(goalValue, settings.weightUnit)
    if (kg >= 20 && kg <= 400) goalKg = kg
    else goalError = 'Enter a weight you can reach on a scale'
  }
  return { heightCm, heightError, birthMonth, birthError, goalKg, goalError }
})

const age = computed(() =>
  parsed.value.birthMonth
    ? ageOn(parsed.value.birthMonth, calendarMonth(systemClock().getTime()))
    : null,
)

const profileValid = computed(
  () => !parsed.value.heightError && !parsed.value.birthError && !parsed.value.goalError,
)

async function saveProfile() {
  if (!profileValid.value) return
  const p = parsed.value
  await settings.updateProfile({
    heightCm: p.heightCm,
    birthMonth: p.birthMonth,
    gender: form.gender,
    genderText: form.gender === 'self' ? form.genderText.trim() : '',
    goalKg: p.goalKg,
  })
  notify.show('Profile saved', 'success')
}

const backupAge = computed(() =>
  settings.lastBackupAt ? daysBetween(settings.lastBackupAt, systemClock()) : null,
)
const hasData = computed(() => journal.doses.length > 0 || journal.weights.length > 0)
const backupStale = computed(
  () => hasData.value && (backupAge.value === null || backupAge.value > 14),
)

async function exportData() {
  busy.value = true
  try {
    const backup = await exportBackup(db)
    const result = await saveFile(
      backupFileName(backup.exportedAt),
      JSON.stringify(backup, null, 2),
    )
    if (result !== 'cancelled') {
      await settings.markBackedUp(backup.exportedAt)
      notify.show('Backup saved', 'success')
    }
  } finally {
    busy.value = false
  }
}

const describe = (doses: number, weights: number) =>
  `${doses} dose${doses === 1 ? '' : 's'} and ${weights} weigh-in${weights === 1 ? '' : 's'}`

async function importData(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const backup = parseBackup(await file.text())
    const ok = await confirm.ask({
      title: 'Replace everything on this device?',
      text: `Your ${describe(journal.doses.length, journal.weights.length)} will be replaced with ${describe(backup.doses.length, backup.weights.length)} from the backup.`,
      confirmText: 'Restore backup',
      destructive: true,
    })
    if (!ok) return
    await restoreBackup(db, backup)
    await Promise.all([journal.load(), settings.load()])
    theme.change(settings.theme)
    notify.show('Backup restored', 'success')
  } catch (e) {
    notify.show(e instanceof BackupFormatError ? e.message : "Couldn't read that file.", 'error')
  }
}

async function eraseEverything() {
  const ok = await confirm.ask({
    title: 'Erase everything?',
    text: `This deletes your profile, medications, ${describe(journal.doses.length, journal.weights.length)} from this device. Save a backup first if you may want them again.`,
    confirmText: 'Erase everything',
    destructive: true,
  })
  if (!ok) return
  await repository.eraseAll()
  await Promise.all([journal.load(), settings.load()])
  theme.change(settings.theme)
  notify.show('Everything erased', 'success')
}

async function promptInstall() {
  if (await install.actions.promptInstall()) notify.show('Tidebook installed', 'success')
}

const formatMb = (bytes: number | null) =>
  bytes === null ? '?' : `${(bytes / 1_048_576).toFixed(1)} MB`
</script>

<template>
  <div class="tb-page settings">
    <header class="mb-4">
      <p class="tb-eyebrow">Preferences</p>
      <h1 class="tb-display text-headline-large">Settings</h1>
    </header>

    <div class="settings-grid">
      <v-card>
        <v-card-item>
          <p class="tb-eyebrow">About you</p>
          <v-card-title>Profile</v-card-title>
        </v-card-item>
        <v-card-text class="tb-stack">
          <p class="text-body-medium tb-muted">
            Every field is optional and stays on this device. Height gives you BMI; your birth month
            gives your age.
          </p>
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
              label="Height"
              suffix="ft"
              type="number"
              inputmode="numeric"
              :error-messages="parsed.heightError"
            />
            <v-text-field
              v-model="form.inches"
              label="and"
              suffix="in"
              type="number"
              inputmode="decimal"
              :error="!!parsed.heightError"
            />
          </div>
          <div class="d-flex ga-3 align-start">
            <v-select
              v-model="form.birthMonth"
              :items="months"
              label="Birth month"
              clearable
              :error-messages="parsed.birthError"
            />
            <v-text-field
              v-model="form.birthYear"
              label="Year"
              type="number"
              inputmode="numeric"
              :error="!!parsed.birthError"
            />
          </div>
          <p v-if="age !== null" class="text-body-small tb-muted">
            Age {{ age
            }}<template v-if="parsed.birthMonth">
              (born {{ formatBirthMonth(parsed.birthMonth) }})</template
            >.
            <template v-if="age < ADULT_AGE">
              Adult BMI bands don't apply under {{ ADULT_AGE }}, so Tidebook won't show one.
            </template>
          </p>
          <v-select v-model="form.gender" :items="genderItems" label="Gender" />
          <v-text-field
            v-if="form.gender === 'self'"
            v-model="form.genderText"
            label="In your words"
            maxlength="60"
            autocomplete="off"
          />
          <p class="text-body-small tb-muted">
            Tidebook doesn't use gender in any calculation; BMI bands are the same for everyone.
            It's here so your record describes you, and it never leaves this device.
          </p>
          <v-text-field
            v-model="form.goal"
            label="Goal weight (optional)"
            :suffix="settings.weightUnit"
            type="number"
            inputmode="decimal"
            :error-messages="parsed.goalError"
          />
          <div class="tb-actions">
            <v-btn color="primary" variant="flat" :disabled="!profileValid" @click="saveProfile">
              Save profile
            </v-btn>
          </div>
          <p v-if="settings.profile.heightCm" class="text-body-small tb-faint">
            Saved height: {{ formatHeight(settings.profile.heightCm, settings.heightUnit) }}
          </p>
        </v-card-text>
      </v-card>

      <v-card>
        <v-card-item>
          <p class="tb-eyebrow">Display</p>
          <v-card-title>Units and appearance</v-card-title>
        </v-card-item>
        <v-card-text class="tb-stack">
          <div>
            <p id="weight-unit-label" class="tb-label">Weight unit</p>
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
            <p id="height-unit-label" class="tb-label">Height unit</p>
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
            <p id="theme-label" class="tb-label">Theme</p>
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
          <p class="text-body-small tb-muted">
            Weights are stored exactly as measured, so switching units never rounds them.
          </p>
        </v-card-text>
      </v-card>

      <v-card>
        <v-card-item>
          <p class="tb-eyebrow">Your data</p>
          <v-card-title>Backup and restore</v-card-title>
        </v-card-item>
        <v-card-text class="tb-stack">
          <p>
            Your data is only on this device. Clearing this site's data in the browser, or
            uninstalling, deletes it, so keep a backup.
          </p>
          <v-alert v-if="backupStale" type="warning" variant="tonal" density="compact">
            {{
              settings.lastBackupAt
                ? `Last backup ${backupAge} days ago.`
                : "You haven't made a backup yet."
            }}
          </v-alert>
          <p v-else-if="settings.lastBackupAt" class="tb-muted">
            Last backup {{ formatDateTime(settings.lastBackupAt) }}
          </p>
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
          <p class="text-body-small tb-muted">
            The backup is a plain file you keep. On iPhone and iPad, Safari and the Home Screen app
            store data separately; use a backup to move between them.
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
          <p class="tb-eyebrow">Install</p>
          <v-card-title>Add to Home Screen</v-card-title>
        </v-card-item>
        <v-card-text class="tb-stack">
          <p v-if="install.state.standalone" class="d-flex align-center ga-2">
            <v-icon :icon="mdiCheckCircleOutline" color="success" />
            Installed
          </p>
          <template v-else>
            <p>Install Tidebook to open it full screen and use it offline.</p>
            <v-btn
              v-if="install.canPrompt.value"
              color="primary"
              variant="flat"
              :prepend-icon="mdiCellphoneArrowDown"
              class="align-self-start"
              @click="promptInstall"
            >
              Install Tidebook
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
          <p class="tb-eyebrow">Privacy</p>
          <v-card-title>Nothing leaves this device</v-card-title>
        </v-card-item>
        <v-card-text class="tb-stack">
          <ul class="privacy-list">
            <li>
              <v-icon :icon="mdiShieldLockOutline" size="small" /> No account, server, tracking or
              ads.
            </li>
            <li><v-icon :icon="mdiCloudOffOutline" size="small" /> Works offline.</li>
          </ul>
          <p class="text-body-small tb-muted">
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
          <p class="tb-eyebrow">About and terms</p>
          <v-card-title>Tidebook {{ version }}</v-card-title>
        </v-card-item>
        <v-card-text class="about">
          <p>
            Tidebook is a free, private journal for GLP-1 medication and weight. It does arithmetic
            and shows published reference figures, each with its source. It doesn't recommend doses,
            isn't medical advice, and isn't a medical device. Talk to your prescriber or pharmacist
            about your treatment.
          </p>
          <p>
            Trial figures come from US prescribing information and are averages across groups of
            people. Level charts are model estimates, not blood levels. Compounded medicines are not
            FDA-approved, and trials did not study them.
          </p>
          <p>
            Ozempic, Wegovy and Rybelsus are trademarks of Novo Nordisk A/S. Mounjaro, Zepbound and
            Foundayo are trademarks of Eli Lilly and Company. All brand names are the trademarks of
            their respective owners and are used only to identify the medicines. Tidebook is not
            affiliated with, endorsed by or sponsored by Novo Nordisk, Eli Lilly or any other
            manufacturer or pharmacy.
          </p>
          <p>
            Tidebook is provided as is, without warranty of any kind. You are responsible for how
            you use it.
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
</style>
