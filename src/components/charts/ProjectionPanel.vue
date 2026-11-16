<script setup lang="ts">
import { computed } from 'vue'
import type { SourceRef } from '@/domain/catalog'
import type { DoseEvent, PkParameters } from '@/domain/pk'
import { formatAmount } from '@/domain/units'
import { useNow } from '@/composables/useNow'
import { formatHours } from '@/services/time'
import MoreInfo from '@/components/common/MoreInfo.vue'
import SourceList from '@/components/common/SourceList.vue'
import ProjectionChart from './ProjectionChart.vue'

interface PkSource {
  name: string
  pk: (PkParameters & { notes: string; sources: SourceRef[] }) | null
  pkUnavailableReason?: string
}

/**
 * Projected levels inside a schedule form, updating as the schedule changes. The form holds no
 * dose, so the chart repeats the given one, or reads in percent without it.
 */
const props = defineProps<{
  /** Catalog entry reduced to `{ name, pk, pkUnavailableReason }`, or undefined outside it. */
  source: PkSource | undefined
  /** User-supplied parameters; take precedence over the catalog. */
  override: PkParameters | null
  intervalHours: number
  intervalLabel: string
  /** Repeated dose in `unitLabel`, or null before any is known. */
  amount: number | null
  /** Logged doses in `unitLabel`, oldest first. */
  history: DoseEvent[]
  unitLabel: string
}>()

const now = useNow()

const params = computed<PkParameters | null>(() => props.override ?? props.source?.pk ?? null)
const userSupplied = computed(() => props.override !== null)
</script>

<template>
  <section v-if="params" class="projection-panel gl-stack" aria-label="Projected levels">
    <div>
      <p class="gl-eyebrow">Projected levels</p>
      <p class="text-body-small gl-muted">
        <template v-if="amount !== null">
          At {{ formatAmount(amount, unitLabel) }} {{ intervalLabel }}.
        </template>
        <template v-else>Percent of steady peak. Log a dose to see amounts.</template>
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
      :amount="amount"
      :history="history"
      :unit-label="unitLabel"
      :now="now"
    />
    <MoreInfo>
      <p class="text-body-small gl-muted">Estimate from the half-life and time to peak.</p>
      <SourceList
        v-if="!userSupplied && source?.pk"
        flat
        :sources="source.pk.sources"
        :note="source.pk.notes"
      />
    </MoreInfo>
  </section>
  <p v-else-if="source?.pkUnavailableReason" class="text-body-small gl-muted">
    {{ source.pkUnavailableReason }}
  </p>
</template>

<style scoped>
.projection-panel {
  padding: 16px;
  border-radius: var(--gl-radius-md);
  background-color: var(--gl-brand-softer);
}
</style>
