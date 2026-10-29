<script setup lang="ts">
import { computed } from 'vue'
import type { PkProfile } from '@/domain/catalog'
import { lookbackHoursFor, type DoseEvent, type PkParameters } from '@/domain/pk'
import { formatHours } from '@/services/time'
import SourceList from '@/components/common/SourceList.vue'
import PkChart from './PkChart.vue'

const props = defineProps<{
  /** The catalog profile for the doses, or undefined for a medication outside the catalog. */
  profile: PkProfile | undefined
  /** The user's own values for a medication outside the catalog. */
  override: PkParameters | null
  doses: DoseEvent[]
  preview: DoseEvent | null
  now: number
  title?: string
  /** One line under the badges, such as which medications the doses came from. */
  caption?: string
}>()

const params = computed<PkParameters | null>(() => props.profile?.pk ?? props.override ?? null)
const userSupplied = computed(() => !props.profile && props.override !== null)
const lookbackHours = computed(() => (params.value ? lookbackHoursFor(params.value) : undefined))
</script>

<template>
  <v-card>
    <v-card-item>
      <p class="tb-eyebrow">Estimated levels</p>
      <v-card-title class="text-wrap">{{ title ?? 'Amount in the body over time' }}</v-card-title>
    </v-card-item>
    <v-card-text class="tb-stack">
      <template v-if="params">
        <div class="d-flex flex-wrap ga-2 align-center">
          <span class="tb-badge tb-badge--brand tb-num"
            >half-life {{ formatHours(params.halfLifeHours) }}</span
          >
          <span class="tb-badge tb-badge--brand tb-num"
            >peak {{ formatHours(params.tmaxHours) }}</span
          >
          <span v-if="userSupplied" class="tb-badge tb-badge--notice">
            <span class="tb-badge__dot" />Your own values
          </span>
        </div>
        <p v-if="caption" class="text-body-small tb-muted">{{ caption }}</p>
        <PkChart
          :params="params"
          :doses="doses"
          :preview="preview"
          unit-label="mg"
          :now="now"
          :lookback-hours="lookbackHours"
        />
        <p class="text-body-small tb-muted">
          An estimate of medicine remaining in the body, based on a simple model from published
          data.
        </p>
        <div v-if="profile?.pk" class="tb-stack tb-stack--tight">
          <p class="text-body-small tb-muted">{{ profile.pk.notes }}</p>
          <SourceList :sources="profile.pk.sources" />
        </div>
      </template>
      <v-alert v-else type="info" variant="tonal" density="comfortable">
        {{
          profile?.pkUnavailableReason ??
          'No published data for this medicine. Add a half-life to see an estimate.'
        }}
      </v-alert>
    </v-card-text>
  </v-card>
</template>
