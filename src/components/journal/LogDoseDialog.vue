<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import { INJECTION_SITES, type DoseRow, type InjectionSite } from '@/db/database'
import { syringeReading } from '@/domain/schedule'
import { formatDose, roundTo } from '@/domain/units'
import { useJournalStore } from '@/stores/journal'
import { useNotifyStore } from '@/stores/notify'
import { useConfirmStore } from '@/stores/confirm'
import { fromLocalInputValue, nowIso, toLocalInputValue } from '@/services/time'
import PresetPicker from '@/components/common/PresetPicker.vue'
import SyringeGraphic from './SyringeGraphic.vue'
import { SITE_LABELS } from './siteLabels'

/** Log a dose, or edit or delete a logged one. */
const props = defineProps<{
  dose: DoseRow | null
  /** Medication to start with when logging a new dose. */
  medicationId?: string
}>()
const open = defineModel<boolean>({ required: true })

const journal = useJournalStore()
const notify = useNotifyStore()
const confirm = useConfirmStore()
const titleId = useId()
const saving = ref(false)

const form = reactive({
  medicationId: '',
  doseMg: null as number | null,
  takenAt: '',
  site: null as InjectionSite | null,
  notes: '',
})

const medication = computed(() => journal.medicationById(form.medicationId))
const product = computed(() => journal.productOf(medication.value))
const isInjection = computed(() => product.value?.route !== 'tablet')

const medicationItems = computed(() => {
  const list = journal.activeMedications.slice()
  const current = medication.value
  if (current && !list.includes(current)) list.push(current)
  return list.map((m) => ({ title: m.name, value: m.id }))
})

/** Label strengths for catalog products; for anything else, the doses already logged. */
const presets = computed(() => {
  if (product.value) return product.value.strengths.values
  const logged = journal.dosesFor(form.medicationId).map((d) => d.doseMg)
  return [...new Set(logged)].sort((a, b) => a - b).slice(0, 6)
})

// Reset from props each time the dialog opens, so an abandoned edit never leaks into the next.
watch(open, (isOpen) => {
  if (!isOpen) return
  const d = props.dose
  form.medicationId = d?.medicationId ?? props.medicationId ?? journal.currentMedication?.id ?? ''
  const last = journal.lastDoseOf(form.medicationId)
  form.doseMg = d?.doseMg ?? last?.doseMg ?? null
  form.takenAt = toLocalInputValue(d?.takenAt ?? nowIso())
  form.site = d?.site ?? null
  form.notes = d?.notes ?? ''
})

/** The site after the last one used, so rotating is one tap; the user can pick any. */
const suggestedSite = computed<InjectionSite | null>(() => {
  const last = journal.doses.find((d) => d.site && d.id !== props.dose?.id)?.site
  if (!last) return null
  return INJECTION_SITES[(INJECTION_SITES.indexOf(last) + 1) % INJECTION_SITES.length]!
})

const reading = computed(() => {
  const c = medication.value?.concentrationMgPerMl
  return c && form.doseMg ? syringeReading(form.doseMg, c) : null
})

const valid = computed(() => !!medication.value && form.doseMg !== null && !!form.takenAt)

async function save() {
  if (!valid.value || form.doseMg === null) return
  saving.value = true
  const input = {
    medicationId: form.medicationId,
    doseMg: form.doseMg,
    takenAt: fromLocalInputValue(form.takenAt),
    site: isInjection.value ? form.site : null,
    notes: form.notes.trim(),
  }
  try {
    if (props.dose) await journal.updateDose(props.dose.id, input)
    else await journal.addDose(input)
    notify.show(props.dose ? 'Dose updated' : `${formatDose(input.doseMg)} logged`, 'success')
    open.value = false
  } catch {
    notify.show("Couldn't save. Try again.", 'error')
  } finally {
    saving.value = false
  }
}

async function remove() {
  const d = props.dose
  if (!d) return
  const ok = await confirm.ask({
    title: 'Delete this dose?',
    text: `${formatDose(d.doseMg)} of ${medication.value?.name ?? 'a medication'}. This can't be undone.`,
    confirmText: 'Delete',
    destructive: true,
  })
  if (!ok) return
  await journal.deleteDose(d.id)
  notify.show('Dose deleted', 'success')
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="560" scrollable :aria-labelledby="titleId">
    <v-card>
      <v-card-item>
        <p class="tb-eyebrow">{{ dose ? 'Edit dose' : 'Log a dose' }}</p>
        <v-card-title :id="titleId">{{ medication?.name ?? 'Dose' }}</v-card-title>
      </v-card-item>
      <v-card-text class="tb-stack">
        <v-select
          v-if="medicationItems.length > 1"
          v-model="form.medicationId"
          :items="medicationItems"
          label="Medication"
        />
        <PresetPicker
          v-model="form.doseMg"
          label="Dose"
          :presets="presets"
          unit-label="mg"
          input-id="dose-custom"
        />
        <div v-if="reading" class="tb-inset reading">
          <SyringeGraphic :units="reading.units" />
          <div class="reading__text" aria-live="polite">
            <span class="tb-num text-title-large">{{ roundTo(reading.units, 1) }} units</span>
            <span class="tb-muted text-body-small">
              {{ roundTo(reading.ml, 3) }} mL on a U-100 syringe, at
              {{ medication?.concentrationMgPerMl }} mg/mL
            </span>
          </div>
        </div>
        <v-text-field v-model="form.takenAt" label="When" type="datetime-local" />
        <fieldset v-if="isInjection" class="sites">
          <legend class="tb-label">Where (optional)</legend>
          <v-chip-group v-model="form.site" column color="primary">
            <v-chip
              v-for="site in INJECTION_SITES"
              :key="site"
              :value="site"
              :aria-pressed="form.site === site"
              tag="button"
              filter
            >
              {{ SITE_LABELS[site] }}
            </v-chip>
          </v-chip-group>
          <p v-if="suggestedSite && !dose" class="text-body-small tb-faint">
            Next in rotation: {{ SITE_LABELS[suggestedSite] }}
          </p>
        </fieldset>
        <v-textarea v-model="form.notes" label="Notes (optional)" />
        <template v-if="dose">
          <v-divider />
          <div>
            <v-btn variant="text" color="error" @click="remove">Delete dose</v-btn>
          </div>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :disabled="!valid" :loading="saving" @click="save">
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.reading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reading__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sites {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
</style>
