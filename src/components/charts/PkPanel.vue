<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PkProfile } from '@/domain/catalog'
import { lookbackHoursFor, type DoseEvent, type PkParameters } from '@/domain/pk'
import { formatHours } from '@/services/time'
import SourceList from '@/components/common/SourceList.vue'
import PkChart from './PkChart.vue'
import ShareLevelsDialog from '@/components/share/ShareLevelsDialog.vue'
import { mdiShareVariantOutline } from '@/plugins/icons'

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

const shareOpen = ref(false)
const shareInput = computed(() =>
  params.value
    ? {
        params: params.value,
        doses: props.doses,
        preview: null,
        unitLabel: 'mg',
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
          unit-label="mg"
          :now="now"
          :lookback-hours="lookbackHours"
        />
        <p class="text-body-small gl-muted">
          Estimated amount in your body, from a simple model of published data.
        </p>
        <SourceList v-if="profile?.pk" :sources="profile.pk.sources" :note="profile.pk.notes" />
      </template>
      <v-alert v-else type="info" variant="tonal" density="comfortable">
        {{
          profile?.pkUnavailableReason ??
          'No published data for this medicine. Add a half-life to see an estimate.'
        }}
      </v-alert>
    </v-card-text>
    <ShareLevelsDialog
      v-if="shareInput"
      v-model="shareOpen"
      :input="shareInput"
      :name="profile?.name ?? title ?? 'Estimated levels'"
      :source-text="userSupplied ? 'your own values' : 'the prescribing label'"
    />
  </v-card>
</template>
