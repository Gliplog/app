<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import type { WeightRow } from '@/db/database'
import { formatWeight, fromKg, roundTo, toKg, type WeightUnit } from '@/domain/units'
import { useJournalStore } from '@/stores/journal'
import { useSettingsStore } from '@/stores/settings'
import { useNotifyStore } from '@/stores/notify'
import { useConfirmStore } from '@/stores/confirm'
import { fromLocalInputValue, nowIso, toLocalInputValue } from '@/services/time'

/** Log a weigh-in, or edit or delete one. */
const props = defineProps<{ weight: WeightRow | null }>()
const open = defineModel<boolean>({ required: true })

const journal = useJournalStore()
const settings = useSettingsStore()
const notify = useNotifyStore()
const confirm = useConfirmStore()
const titleId = useId()
const saving = ref(false)

const form = reactive({ value: '', unit: 'kg' as WeightUnit, measuredAt: '', notes: '' })

// Reset from props each time the dialog opens, so an abandoned edit never leaks into the next.
watch(open, (isOpen) => {
  if (!isOpen) return
  const w = props.weight
  form.unit = w?.enteredUnit ?? settings.weightUnit
  form.value = w ? String(roundTo(fromKg(w.kg, form.unit), 2)) : ''
  form.measuredAt = toLocalInputValue(w?.measuredAt ?? nowIso())
  form.notes = w?.notes ?? ''
})

/** Kilograms entered, or null. The range covers every adult scale reading without rejecting one. */
const kg = computed(() => {
  const n = Number.parseFloat(form.value)
  if (!Number.isFinite(n) || n <= 0) return null
  const value = toKg(n, form.unit)
  return value >= 20 && value <= 400 ? value : null
})

const error = computed(() =>
  form.value && kg.value === null
    ? `Enter a weight between ${formatWeight(20, form.unit)} and ${formatWeight(400, form.unit)}`
    : undefined,
)

const previous = computed(() => journal.weights.find((w) => w.id !== props.weight?.id))

async function save() {
  if (kg.value === null || !form.measuredAt) return
  saving.value = true
  const input = {
    kg: kg.value,
    enteredUnit: form.unit,
    measuredAt: fromLocalInputValue(form.measuredAt),
    notes: form.notes.trim(),
  }
  try {
    if (props.weight) await journal.updateWeight(props.weight.id, input)
    else await journal.addWeight(input)
    if (form.unit !== settings.weightUnit) await settings.setWeightUnit(form.unit)
    notify.show(props.weight ? 'Weight updated' : 'Weight logged', 'success')
    open.value = false
  } catch {
    notify.show("Couldn't save. Try again.", 'error')
  } finally {
    saving.value = false
  }
}

async function remove() {
  const w = props.weight
  if (!w) return
  const ok = await confirm.ask({
    title: 'Delete this weigh-in?',
    text: `${formatWeight(w.kg, settings.weightUnit)}. This can't be undone.`,
    confirmText: 'Delete',
    destructive: true,
  })
  if (!ok) return
  await journal.deleteWeight(w.id)
  notify.show('Weigh-in deleted', 'success')
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="480" scrollable :aria-labelledby="titleId">
    <v-card>
      <v-card-item>
        <p class="tb-eyebrow">{{ weight ? 'Edit' : 'Log' }}</p>
        <v-card-title :id="titleId">Weigh-in</v-card-title>
      </v-card-item>
      <v-card-text class="tb-stack">
        <div class="d-flex ga-3 align-start">
          <v-text-field
            v-model="form.value"
            label="Weight"
            type="number"
            inputmode="decimal"
            :error-messages="error"
            autofocus
          />
          <v-btn-toggle
            v-model="form.unit"
            role="group"
            mandatory
            density="comfortable"
            aria-label="Unit"
          >
            <v-btn value="kg">kg</v-btn>
            <v-btn value="lb">lb</v-btn>
          </v-btn-toggle>
        </div>
        <p v-if="previous" class="text-body-small tb-faint">
          Last time: {{ formatWeight(previous.kg, form.unit) }}
        </p>
        <v-text-field v-model="form.measuredAt" label="When" type="datetime-local" />
        <v-textarea v-model="form.notes" label="Notes (optional)" />
        <template v-if="weight">
          <v-divider />
          <div>
            <v-btn variant="text" color="error" @click="remove">Delete weigh-in</v-btn>
          </div>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :disabled="kg === null"
          :loading="saving"
          @click="save"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
