<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { defaultComparison, nearestWeight, photoGap, POSE_LABELS } from '@/domain/photos'
import { formatWeight, formatWeightChange } from '@/domain/units'
import { useJournalStore } from '@/stores/journal'
import { usePhotosStore } from '@/stores/photos'
import { useSettingsStore } from '@/stores/settings'
import { formatDate, toEpochMs } from '@/services/time'

/** Two progress photos side by side, each with its date and the weigh-in logged nearest it. */
const open = defineModel<boolean>({ required: true })

const journal = useJournalStore()
const photosStore = usePhotosStore()
const settings = useSettingsStore()
const titleId = useId()

const beforeId = ref<string | null>(null)
const afterId = ref<string | null>(null)
const showWeights = ref(true)
const urls = ref<Record<'before' | 'after', string | null>>({ before: null, after: null })

const items = computed(() =>
  photosStore.photos.map((p) => ({
    title: `${formatDate(p.takenAt)} · ${POSE_LABELS[p.pose]}`,
    value: p.id,
  })),
)

watch(open, (isOpen) => {
  if (!isOpen) return
  const pair = defaultComparison(
    photosStore.photos.map((p) => ({ ...p, at: toEpochMs(p.takenAt) })),
  )
  const all = photosStore.photos
  beforeId.value = pair?.before.id ?? all[all.length - 1]?.id ?? null
  afterId.value = pair?.after.id ?? all[0]?.id ?? null
})

/*
 * Each side reads its full image when its choice changes and revokes the one it replaces. A
 * read that finishes after the choice moved on is discarded.
 */
function follow(side: 'before' | 'after', id: () => string | null) {
  watch([id, open], async ([photoId, isOpen]) => {
    const old = urls.value[side]
    urls.value[side] = null
    if (old) URL.revokeObjectURL(old)
    if (!photoId || !isOpen) return
    const url = await photosStore.imageUrl(photoId)
    if (id() === photoId && open.value) urls.value[side] = url
    else if (url) URL.revokeObjectURL(url)
  })
}
follow('before', () => beforeId.value)
follow('after', () => afterId.value)

onBeforeUnmount(() => {
  Object.values(urls.value).forEach((url) => url && URL.revokeObjectURL(url))
})

const weights = computed(() =>
  journal.weights.map((w) => ({ at: toEpochMs(w.measuredAt), kg: w.kg })),
)

function sideOf(id: string | null) {
  const photo = photosStore.photos.find((p) => p.id === id)
  if (!photo) return null
  const at = toEpochMs(photo.takenAt)
  return { photo, at, weight: nearestWeight(weights.value, at) }
}

const before = computed(() => sideOf(beforeId.value))
const after = computed(() => sideOf(afterId.value))

const sides = computed(() =>
  (['before', 'after'] as const).map((key) => {
    const data = key === 'before' ? before.value : after.value
    return {
      key,
      label: key === 'before' ? 'Photo on the left' : 'Photo on the right',
      id: key === 'before' ? beforeId.value : afterId.value,
      data,
      url: urls.value[key],
      alt: data ? `Progress photo from ${formatDate(data.at)}` : '',
    }
  }),
)

function choose(side: 'before' | 'after', id: string | null) {
  if (side === 'before') beforeId.value = id
  else afterId.value = id
}

const summary = computed(() => {
  const b = before.value
  const a = after.value
  if (!b || !a) return null
  const gap = photoGap(b, a)
  const apart =
    gap.weeks !== null
      ? `${gap.weeks} weeks apart`
      : `${gap.days} day${gap.days === 1 ? '' : 's'} apart`
  if (!showWeights.value || gap.changeKg === null) return apart
  return `${apart} · ${formatWeightChange(gap.changeKg, settings.weightUnit)} between your weigh-ins`
})
</script>

<template>
  <v-dialog v-model="open" max-width="880" scrollable :aria-labelledby="titleId">
    <v-card>
      <v-card-item>
        <p class="gl-eyebrow">Progress photos</p>
        <v-card-title :id="titleId">Compare</v-card-title>
      </v-card-item>
      <v-card-text class="gl-stack">
        <div class="pair">
          <figure v-for="side in sides" :key="side.key" class="gl-stack gl-stack--tight">
            <v-select
              :model-value="side.id"
              :items="items"
              :label="side.label"
              @update:model-value="choose(side.key, $event)"
            />
            <div class="frame">
              <img v-if="side.url" :src="side.url" :alt="side.alt" />
            </div>
            <figcaption v-if="side.data" class="text-body-small">
              <span class="gl-num">{{ formatDate(side.data.at) }}</span>
              <span v-if="showWeights && side.data.weight" class="gl-muted">
                · your weigh-in on {{ formatDate(side.data.weight.at) }}:
                <span class="gl-num">{{
                  formatWeight(side.data.weight.kg, settings.weightUnit)
                }}</span>
              </span>
            </figcaption>
          </figure>
        </div>
        <p v-if="summary" class="gl-muted">{{ summary }}</p>
        <v-switch v-model="showWeights" label="Show weights" color="primary" hide-details />
        <p class="text-body-small gl-faint">
          A weight shows when you logged one within three days of the photo.
        </p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

figure {
  margin: 0;
  min-width: 0;
}

.frame {
  aspect-ratio: 3 / 4;
  border-radius: var(--gl-radius-md);
  overflow: hidden;
  background: var(--gl-surface-sunk);
}

.frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
