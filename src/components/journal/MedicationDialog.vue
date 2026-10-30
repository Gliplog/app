<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import { catalog, findProduct } from '@/data'
import type { MedicationRow } from '@/db/database'
import { useJournalStore } from '@/stores/journal'
import { useNotifyStore } from '@/stores/notify'
import { useConfirmStore } from '@/stores/confirm'

/** Add a medication, or edit one; archive and delete close the dialog. */
const props = defineProps<{ medication: MedicationRow | null }>()
const open = defineModel<boolean>({ required: true })

const journal = useJournalStore()
const notify = useNotifyStore()
const confirm = useConfirmStore()
const titleId = useId()
const saving = ref(false)

const OTHER = 'other'

const productItems = [
  ...catalog.products.map((p) => ({
    title: p.name,
    value: p.id,
    props: {
      subtitle: `${p.molecule} · ${p.route === 'tablet' ? 'daily tablet' : 'weekly injection'}${p.kind === 'compounded' ? ' · compounded' : ''}`,
    },
  })),
  { title: 'Something else', value: OTHER, props: { subtitle: 'Name it yourself' } },
]

const form = reactive({
  productId: 'wegovy' as string,
  name: '',
  schedule: 'weekly' as 'daily' | 'weekly' | 'custom',
  customDays: '',
  concentration: '',
  halfLife: '',
  tmax: '',
  notes: '',
})

const product = computed(() => findProduct(form.productId === OTHER ? null : form.productId))

function scheduleFor(days: number): 'daily' | 'weekly' | 'custom' {
  return days === 1 ? 'daily' : days === 7 ? 'weekly' : 'custom'
}

// Reset from props each time the dialog opens, so an abandoned edit never leaks into the next.
watch(open, (isOpen) => {
  if (!isOpen) return
  const m = props.medication
  form.productId = m ? (m.productId ?? OTHER) : 'wegovy'
  form.name = m && !m.productId ? m.name : ''
  form.schedule = scheduleFor(m?.intervalDays ?? 7)
  form.customDays = m && scheduleFor(m.intervalDays) === 'custom' ? String(m.intervalDays) : ''
  form.concentration = m?.concentrationMgPerMl ? String(m.concentrationMgPerMl) : ''
  form.halfLife = m?.pkOverride ? String(m.pkOverride.halfLifeHours) : ''
  form.tmax = m?.pkOverride ? String(m.pkOverride.tmaxHours) : ''
  form.notes = m?.notes ?? ''
})

/*
 * Choosing a product brings its label interval. This runs only on the user's choice, never from
 * a watcher, so opening an existing medication keeps the interval the user saved.
 */
function chooseProduct(id: string | null) {
  if (!id) return
  form.productId = id
  const p = findProduct(id)
  if (p) form.schedule = scheduleFor(p.intervalDays)
}

const positive = (text: string) => {
  const n = Number.parseFloat(text)
  return Number.isFinite(n) && n > 0 ? n : null
}

const intervalDays = computed(() => {
  if (form.schedule === 'daily') return 1
  if (form.schedule === 'weekly') return 7
  const n = Number(form.customDays)
  return Number.isInteger(n) && n >= 1 && n <= 60 ? n : null
})

const isOther = computed(() => form.productId === OTHER)
const showsConcentration = computed(() => product.value?.kind === 'compounded' || isOther.value)

const errors = computed(() => ({
  name: isOther.value && !form.name.trim() ? 'Enter a name' : undefined,
  customDays:
    form.schedule === 'custom' && intervalDays.value === null ? 'Whole days, 1 to 60' : undefined,
  concentration:
    form.concentration && positive(form.concentration) === null
      ? 'Enter a number greater than 0'
      : undefined,
  pk:
    isOther.value &&
    (form.halfLife || form.tmax) &&
    (positive(form.halfLife) === null || positive(form.tmax) === null)
      ? 'Enter both, in hours, or leave both empty'
      : undefined,
}))

const valid = computed(() => Object.values(errors.value).every((e) => e === undefined))

async function save() {
  if (!valid.value || intervalDays.value === null) return
  saving.value = true
  const halfLife = positive(form.halfLife)
  const tmax = positive(form.tmax)
  const input = {
    productId: isOther.value ? null : form.productId,
    name: isOther.value ? form.name.trim() : (product.value?.name ?? form.name),
    intervalDays: intervalDays.value,
    concentrationMgPerMl: showsConcentration.value ? positive(form.concentration) : null,
    pkOverride:
      isOther.value && halfLife && tmax ? { halfLifeHours: halfLife, tmaxHours: tmax } : null,
    notes: form.notes.trim(),
  }
  try {
    if (props.medication) {
      await journal.updateMedication(props.medication.id, input)
      notify.show('Medication updated', 'success')
    } else {
      await journal.addMedication({ ...input, status: 'active' })
      notify.show('Medication added', 'success')
    }
    open.value = false
  } catch {
    notify.show("Couldn't save. Try again.", 'error')
  } finally {
    saving.value = false
  }
}

async function toggleArchive() {
  const m = props.medication
  if (!m) return
  const archiving = m.status === 'active'
  await journal.updateMedication(m.id, { status: archiving ? 'archived' : 'active' })
  notify.show(archiving ? 'Moved to past medications' : 'Back in use', 'success')
  open.value = false
}

async function remove() {
  const m = props.medication
  if (!m) return
  const count = journal.dosesFor(m.id).length
  const ok = await confirm.ask({
    title: `Delete ${m.name}?`,
    text: count
      ? `This also deletes the ${count} dose${count === 1 ? '' : 's'} logged for it. To keep them, stop using it instead.`
      : 'It has no logged doses.',
    confirmText: 'Delete',
    destructive: true,
  })
  if (!ok) return
  await journal.deleteMedication(m.id)
  notify.show('Medication deleted', 'success')
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="560" scrollable :aria-labelledby="titleId">
    <v-card>
      <v-card-item>
        <p class="gl-eyebrow">{{ medication ? 'Edit' : 'Add' }}</p>
        <v-card-title :id="titleId">{{ medication ? medication.name : 'Medication' }}</v-card-title>
      </v-card-item>
      <v-card-text class="gl-stack">
        <v-autocomplete
          :model-value="form.productId"
          :items="productItems"
          label="Medication"
          auto-select-first
          :clearable="false"
          :disabled="!!medication && journal.dosesFor(medication.id).length > 0"
          :hint="
            medication && journal.dosesFor(medication.id).length
              ? 'Logged doses belong to this medication. Add a new one to switch.'
              : undefined
          "
          persistent-hint
          @update:model-value="chooseProduct"
        />
        <p v-if="product" class="text-body-small gl-muted">{{ product.note }}</p>
        <v-text-field
          v-if="isOther"
          v-model="form.name"
          label="Name"
          :error-messages="errors.name"
          autocomplete="off"
        />

        <div>
          <p id="schedule-label" class="gl-label">How often</p>
          <v-btn-toggle
            v-model="form.schedule"
            role="group"
            mandatory
            density="comfortable"
            aria-labelledby="schedule-label"
          >
            <v-btn value="daily">Daily</v-btn>
            <v-btn value="weekly">Weekly</v-btn>
            <v-btn value="custom">Other</v-btn>
          </v-btn-toggle>
        </div>
        <v-text-field
          v-if="form.schedule === 'custom'"
          v-model="form.customDays"
          label="Every"
          suffix="days"
          type="number"
          inputmode="numeric"
          :error-messages="errors.customDays"
        />
        <p class="text-body-small gl-muted">
          Used to show when your next dose is due. Follow your prescriber's schedule.
        </p>

        <template v-if="showsConcentration">
          <v-text-field
            v-model="form.concentration"
            label="Vial strength (optional)"
            suffix="mg/mL"
            type="number"
            inputmode="decimal"
            :error-messages="errors.concentration"
            hint="From your pharmacy label. Doses will also show U-100 syringe units."
            persistent-hint
          />
        </template>

        <template v-if="isOther">
          <p class="gl-label">Your own half-life (optional)</p>
          <div class="d-flex ga-3 align-start">
            <v-text-field
              v-model="form.halfLife"
              label="Half-life"
              suffix="h"
              type="number"
              inputmode="decimal"
              :error-messages="errors.pk"
            />
            <v-text-field
              v-model="form.tmax"
              label="Time to peak"
              suffix="h"
              type="number"
              inputmode="decimal"
              :error="!!errors.pk"
            />
          </div>
          <p class="text-body-small gl-muted">
            Used only for the level chart, which is marked as your values.
          </p>
        </template>

        <v-textarea v-model="form.notes" label="Notes (optional)" />

        <template v-if="medication">
          <v-divider />
          <div class="d-flex flex-wrap ga-2">
            <v-btn variant="text" @click="toggleArchive">
              {{ medication.status === 'active' ? 'I’ve stopped using it' : 'Use it again' }}
            </v-btn>
            <v-btn variant="text" color="error" @click="remove">Delete</v-btn>
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
