<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SourceRef } from '@/domain/catalog'
import { lookbackHoursFor, type DoseEvent, type PkParameters } from '@/domain/pk'
import { formatHours } from '@/services/time'
import MoreInfo from '@/components/common/MoreInfo.vue'
import SourceList from '@/components/common/SourceList.vue'
import PkChart from './PkChart.vue'
import ShareLevelsDialog from '@/components/share/ShareLevelsDialog.vue'
import { mdiShareVariantOutline } from '@/plugins/icons'

interface PkSource {
  name: string
  pk: (PkParameters & { notes: string; sources: SourceRef[] }) | null
  pkUnavailableReason?: string
}

const props = defineProps<{
  /** Catalog entry reduced to `{ name, pk, pkUnavailableReason }`, or undefined outside it. */
  source: PkSource | undefined
  /** User-supplied values; take precedence over the catalog. */
  override: PkParameters | null
  doses: DoseEvent[]
  preview: DoseEvent | null
  unitLabel: string
  now: number
  title?: string
  /** One line under the badges, such as which medications or vials the doses came from. */
  caption?: string
}>()

const params = computed<PkParameters | null>(() => props.override ?? props.source?.pk ?? null)
const userSupplied = computed(() => props.override !== null)
const lookbackHours = computed(() => (params.value ? lookbackHoursFor(params.value) : undefined))

const shareOpen = ref(false)
const shareInput = computed(() =>
  params.value
    ? {
        params: params.value,
        doses: props.doses,
        preview: null,
        unitLabel: props.unitLabel,
        now: props.now,
        lookbackHours: lookbackHours.value,
      }
    : null,
)
</script>

<template>
  <v-card>
    <v-card-item>
      <p class="gl-eyebrow">Estimated levels</p>
      <v-card-title class="text-wrap">{{ title ?? 'Amount in the body over time' }}</v-card-title>
      <template v-if="shareInput && doses.length && !preview" #append>
        <v-btn
          :icon="mdiShareVariantOutline"
          variant="text"
          aria-label="Share estimated levels as an image"
          @click="shareOpen = true"
        />
      </template>
    </v-card-item>
    <v-card-text class="gl-stack">
      <template v-if="params">
        <div class="d-flex flex-wrap ga-2 align-center">
          <span class="gl-badge gl-badge--brand gl-num"
            >half-life {{ formatHours(params.halfLifeHours) }}</span
          >
          <span class="gl-badge gl-badge--brand gl-num"
            >peak {{ formatHours(params.tmaxHours) }}</span
          >
          <span v-if="userSupplied" class="gl-badge gl-badge--notice">
            <span class="gl-badge__dot" />Your own values
          </span>
        </div>
        <p v-if="caption" class="text-body-small gl-muted">{{ caption }}</p>
        <PkChart
          :params="params"
          :doses="doses"
          :preview="preview"
          :unit-label="unitLabel"
          :now="now"
          :lookback-hours="lookbackHours"
        />
        <MoreInfo>
          <p class="text-body-small gl-muted">
            Estimated amount in your body, from a simple model of published data.
          </p>
          <SourceList
            v-if="!userSupplied && source?.pk"
            flat
            :sources="source.pk.sources"
            :note="source.pk.notes"
          />
        </MoreInfo>
      </template>
      <v-alert v-else type="info" variant="tonal" density="comfortable">
        {{
          source?.pkUnavailableReason ??
          'No published data for this medicine. Add a half-life to see an estimate.'
        }}
      </v-alert>
    </v-card-text>
    <ShareLevelsDialog
      v-if="shareInput"
      v-model="shareOpen"
      :input="shareInput"
      :name="source?.name ?? title ?? 'Estimated levels'"
      :source-text="userSupplied ? 'your own values' : 'the prescribing label'"
    />
  </v-card>
</template>
