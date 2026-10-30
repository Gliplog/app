<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { COLLAGE_COUNTS, weekLabel, type CollageFormat } from '@/domain/collage'
import {
  nearestWeight,
  photoGap,
  PHOTO_POSES,
  POSE_LABELS,
  spreadEvenly,
  type PhotoPose,
} from '@/domain/photos'
import { formatPercentChange } from '@/domain/units'
import { useChartColors } from '@/composables/useChartColors'
import { formatDate, formatDateTime, nowIso, toEpochMs } from '@/services/time'
import { useJournalStore } from '@/stores/journal'
import { usePhotosStore } from '@/stores/photos'
import ShareImageDialog from './ShareImageDialog.vue'
import { renderCollage } from './collageCard'

/**
 * Share progress photos as one collage. Photos of one pose, picked evenly across the span the
 * user chooses, cropped into equal tiles and labelled with their date or week on the
 * medication, in a post or story shape. Weight change is off by default.
 */
const open = defineModel<boolean>({ required: true })

const journal = useJournalStore()
const photosStore = usePhotosStore()
const { colors } = useChartColors()
const ids = {
  pose: useId(),
  count: useId(),
  labels: useId(),
  format: useId(),
}

const pose = ref<PhotoPose>('front')
const count = ref<number>(4)
const fromId = ref<string | null>(null)
const toId = ref<string | null>(null)
const labels = ref<'dates' | 'weeks'>('dates')
const format = ref<CollageFormat>('post')
const showChange = ref(false)

/** Oldest first, with their time as a number. */
const all = computed(() =>
  [...photosStore.photos].reverse().map((p) => ({ ...p, at: toEpochMs(p.takenAt) })),
)
/** Poses with at least two photos: a collage of one is not a collage. */
const poses = computed(() =>
  PHOTO_POSES.filter((p) => all.value.filter((photo) => photo.pose === p).length >= 2),
)
const ofPose = computed(() => all.value.filter((p) => p.pose === pose.value))

watch(open, (isOpen) => {
  if (!isOpen) return
  const latest = all.value[all.value.length - 1]
  pose.value =
    latest && poses.value.includes(latest.pose) ? latest.pose : (poses.value[0] ?? 'front')
  showChange.value = false
  resetRange()
})

function resetRange() {
  const list = ofPose.value
  fromId.value = list[0]?.id ?? null
  toId.value = list[list.length - 1]?.id ?? null
  count.value = Math.min(4, Math.max(2, list.length))
}
watch(pose, resetRange)

const rangeItems = computed(() =>
  ofPose.value.map((p) => ({ title: formatDate(p.at), value: p.id })),
)
const inRange = computed(() => {
  const list = ofPose.value
  const a = list.findIndex((p) => p.id === fromId.value)
  const b = list.findIndex((p) => p.id === toId.value)
  if (a < 0 || b < 0) return list
  return list.slice(Math.min(a, b), Math.max(a, b) + 1)
})
const counts = computed(() => COLLAGE_COUNTS.filter((n) => n <= Math.max(2, inRange.value.length)))
watch(counts, (list) => {
  if (!list.includes(count.value as never)) count.value = list[list.length - 1] ?? 2
})
const chosen = computed(() => spreadEvenly(inRange.value, count.value))

const firstDoseAt = computed(() => {
  const oldest = journal.doses[journal.doses.length - 1]
  return oldest ? toEpochMs(oldest.takenAt) : null
})

/** The change between the weigh-ins nearest the first and last photo, as a percent. */
const change = computed(() => {
  const list = chosen.value
  const weights = journal.weights.map((w) => ({ at: toEpochMs(w.measuredAt), kg: w.kg }))
  const a = list[0] && nearestWeight(weights, list[0].at)
  const b = list[list.length - 1] && nearestWeight(weights, list[list.length - 1]!.at)
  if (!a || !b || a === b) return null
  return ((b.kg - a.kg) / a.kg) * 100
})

/*
 * Full-size images for the chosen photos, read once each while the dialog is open and released
 * when it closes. The thumbnails would look soft at tile size.
 */
const urls = new Map<string, string>()
async function imageUrl(id: string): Promise<string> {
  const known = urls.get(id)
  if (known) return known
  const url = await photosStore.imageUrl(id)
  if (!url) throw new Error('Photo missing')
  urls.set(id, url)
  return url
}
watch(open, (isOpen) => {
  if (isOpen) return
  urls.forEach((url) => URL.revokeObjectURL(url))
  urls.clear()
})

const renderKey = computed(() =>
  JSON.stringify([
    chosen.value.map((p) => p.id),
    labels.value,
    format.value,
    showChange.value,
    colors.value.surface,
  ]),
)

async function render(): Promise<Blob> {
  const list = chosen.value
  const first = list[0]
  const last = list[list.length - 1]
  if (!first || !last) throw new Error('No photos')
  const gap = photoGap({ at: first.at, weight: null }, { at: last.at, weight: null })
  const stats: [string, string][] =
    showChange.value && change.value !== null
      ? [['Weight change', formatPercentChange(change.value)]]
      : []
  const photos = await Promise.all(
    list.map(async (p) => ({
      src: await imageUrl(p.id),
      at: p.at,
      label:
        (labels.value === 'weeks' ? weekLabel(p.at, firstDoseAt.value) : null) ?? formatDate(p.at),
    })),
  )
  return renderCollage(
    {
      format: format.value,
      photos,
      eyebrow: `Progress photos · ${POSE_LABELS[pose.value]}`,
      title:
        gap.weeks !== null ? `${gap.weeks} weeks` : `${gap.days} day${gap.days === 1 ? '' : 's'}`,
      stats,
      caption:
        showChange.value && change.value !== null
          ? 'Weight change between the weigh-ins logged nearest the first and last photo.'
          : 'Progress photos kept in Gliplog, in the order they were taken.',
      from: formatDate(first.at),
      to: formatDate(last.at),
      madeAt: formatDateTime(nowIso()),
    },
    colors.value.font,
  )
}
</script>

<template>
  <ShareImageDialog
    v-model="open"
    title="Share a collage"
    file-stem="gliplog-photos"
    :render="chosen.length >= 2 ? render : null"
    :render-key="renderKey"
    :aspect="format === 'story' ? '9 / 16' : '4 / 5'"
  >
    <div v-if="poses.length > 1">
      <p :id="ids.pose" class="gl-label">Pose</p>
      <v-btn-toggle
        v-model="pose"
        role="group"
        mandatory
        density="comfortable"
        :aria-labelledby="ids.pose"
      >
        <v-btn v-for="p in poses" :key="p" :value="p">{{ POSE_LABELS[p] }}</v-btn>
      </v-btn-toggle>
    </div>
    <div>
      <p :id="ids.count" class="gl-label">Photos</p>
      <v-btn-toggle
        v-model="count"
        role="group"
        mandatory
        density="comfortable"
        :aria-labelledby="ids.count"
      >
        <v-btn v-for="n in counts" :key="n" :value="n">{{ n }}</v-btn>
      </v-btn-toggle>
    </div>
    <div class="range">
      <v-select v-model="fromId" :items="rangeItems" label="From" />
      <v-select v-model="toId" :items="rangeItems" label="To" />
    </div>
    <p class="text-body-small gl-muted">Photos are picked evenly between these dates.</p>
    <div v-if="firstDoseAt !== null">
      <p :id="ids.labels" class="gl-label">Labels</p>
      <v-btn-toggle
        v-model="labels"
        role="group"
        mandatory
        density="comfortable"
        :aria-labelledby="ids.labels"
      >
        <v-btn value="dates">Dates</v-btn>
        <v-btn value="weeks">Weeks on medication</v-btn>
      </v-btn-toggle>
    </div>
    <div>
      <p :id="ids.format" class="gl-label">Shape</p>
      <v-btn-toggle
        v-model="format"
        role="group"
        mandatory
        density="comfortable"
        :aria-labelledby="ids.format"
      >
        <v-btn value="post">Post</v-btn>
        <v-btn value="story">Story</v-btn>
      </v-btn-toggle>
    </div>
    <template v-if="change !== null">
      <v-switch v-model="showChange" label="Show weight change" hide-details />
      <p class="text-body-small gl-muted">
        {{
          showChange
            ? 'The percent change between the weigh-ins nearest the first and last photo.'
            : 'No weights are shown.'
        }}
      </p>
    </template>
    <p class="text-body-small gl-muted">
      The collage is made on this device. Anyone you send it to will see these photos.
    </p>
  </ShareImageDialog>
</template>

<style scoped>
.range {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
</style>
