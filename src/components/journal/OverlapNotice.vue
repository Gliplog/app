<script setup lang="ts">
import { computed } from 'vue'
import type { MedicationRow } from '@/db/database'
import { findOverlap, overlapText } from '@/domain/overlap'
import { useJournalStore } from '@/stores/journal'
import { useSettingsStore } from '@/stores/settings'

/**
 * A dismissable notice when the medications marked as in use are different medicines, most
 * often one left active after a switch. It restates the user's records and offers to open each
 * medication, where "I've stopped using it" lives; it never advises. A dismissal holds until the
 * combination of medicines changes.
 */
const emit = defineEmits<{ review: [med: MedicationRow] }>()

const journal = useJournalStore()
const settings = useSettingsStore()

const overlap = computed(() =>
  findOverlap(
    journal.activeMedications.map((m) => {
      const product = journal.productOf(m)
      return {
        id: m.id,
        name: m.name,
        pkProfile: product?.pkProfile ?? null,
        molecule: product?.molecule ?? null,
        route: product?.route ?? null,
      }
    }),
  ),
)

const shown = computed(
  () =>
    settings.loaded &&
    overlap.value !== null &&
    !settings.dismissedOverlaps.includes(overlap.value.key),
)
const text = computed(() => (overlap.value ? overlapText(overlap.value) : null))
</script>

<template>
  <section
    v-if="shown && text && overlap"
    class="overlap-notice"
    role="status"
    aria-labelledby="overlap-notice-title"
  >
    <p id="overlap-notice-title" class="overlap-notice__title">{{ text.title }}</p>
    <p class="overlap-notice__body">{{ text.body }}</p>
    <div class="gl-actions">
      <v-btn variant="text" @click="settings.dismissOverlap(overlap.key)">Dismiss</v-btn>
      <v-btn
        v-for="med in journal.activeMedications"
        :key="med.id"
        variant="tonal"
        @click="emit('review', med)"
      >
        Review {{ med.name }}
      </v-btn>
    </div>
  </section>
</template>

<style scoped>
/* The notice status pair passes the contrast check; Vuetify's warning tint on cream does not. */
.overlap-notice {
  display: grid;
  gap: 8px;
  padding: 16px;
  border-radius: var(--gl-radius-lg);
  border-inline-start: 4px solid var(--gl-notice-fg);
  background: var(--gl-notice-bg);
  color: var(--gl-text-1);
}

.overlap-notice__title {
  color: var(--gl-notice-fg);
  font-weight: 600;
  font-size: 1.0625rem;
}
</style>
