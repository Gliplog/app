<script setup lang="ts">
import { computed } from 'vue'
import type { PkProfile } from '@/domain/catalog'
import type { DoseEvent, PkParameters } from '@/domain/pk'
import { formatAmount } from '@/domain/units'
import { useNow } from '@/composables/useNow'
import { formatHours } from '@/services/time'
import SourceList from '@/components/common/SourceList.vue'
import ProjectionChart from './ProjectionChart.vue'

/**
 * Projected levels inside the medication form, updating as the schedule changes. The form holds
 * no dose, so the chart repeats the last logged one, or reads in percent before any is logged.
 */
const props = defineProps<{
  /** The catalog profile, or undefined for a medication outside the catalog. */
  profile: PkProfile | undefined
  /** The user's own values for a medication outside the catalog. */
  override: PkParameters | null
  intervalHours: number
  intervalLabel: string
  /** Logged doses of this medicine in mg, oldest first. */
  history: DoseEvent[]
}>()

const now = useNow()

const params = computed<PkParameters | null>(() => props.profile?.pk ?? props.override ?? null)
const userSupplied = computed(() => !props.profile && props.override !== null)
const lastDose = computed(() => props.history[props.history.length - 1]?.amount ?? null)
</script>

<template>
  <section v-if="params" class="projection-panel gl-stack" aria-label="Projected levels">
    <div>
      <p class="gl-eyebrow">Projected levels</p>
      <p class="text-body-small gl-muted">
        <template v-if="lastDose !== null">
          At {{ formatAmount(lastDose, 'mg') }} {{ intervalLabel }}.
        </template>
        <template v-else>Percent of steady peak. Log a dose to see mg.</template>
      </p>
    </div>
    <div class="d-flex flex-wrap ga-2 align-center">
      <span class="gl-badge gl-badge--brand gl-num"
        >half-life {{ formatHours(params.halfLifeHours) }}</span
      >
      <span class="gl-badge gl-badge--brand gl-num">peak {{ formatHours(params.tmaxHours) }}</span>
      <span v-if="userSupplied" class="gl-badge gl-badge--notice">
        <span class="gl-badge__dot" />Your own values
      </span>
    </div>
    <ProjectionChart
      :params="params"
      :interval-hours="intervalHours"
      :amount="lastDose"
      :history="history"
      unit-label="mg"
      :now="now"
    />
    <p class="text-body-small gl-muted">Estimate from a simple model of published data.</p>
    <SourceList v-if="profile?.pk" :sources="profile.pk.sources" :note="profile.pk.notes" />
  </section>
  <p v-else-if="profile?.pkUnavailableReason" class="text-body-small gl-muted">
    {{ profile.pkUnavailableReason }}
  </p>
</template>

<style scoped>
.projection-panel {
  padding: 16px;
  border-radius: var(--gl-radius-md);
  background-color: var(--gl-brand-softer);
}
</style>
