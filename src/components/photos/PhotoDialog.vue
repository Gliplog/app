<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, useId, watch } from 'vue'
import type { PhotoRow } from '@/db/database'
import { nearestWeight, PHOTO_POSES, POSE_LABELS, type PhotoPose } from '@/domain/photos'
import { formatWeight } from '@/domain/units'
import type { PreparedPhoto } from '@/services/photos/preparePhoto'
import { useJournalStore } from '@/stores/journal'
import { usePhotosStore } from '@/stores/photos'
import { useSettingsStore } from '@/stores/settings'
import { useNotifyStore } from '@/stores/notify'
import { useConfirmStore } from '@/stores/confirm'
import { formatDate, fromLocalInputValue, toEpochMs, toLocalInputValue } from '@/services/time'

/**
 * Save a new progress photo (`prepared`, taken or chosen a moment ago), or view, edit and
 * delete a saved one (`photo`).
 */
const props = defineProps<{
  photo: PhotoRow | null
  prepared: PreparedPhoto | null
  /** When a new photo was taken, as UTC ISO. */
  takenAt: string
}>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [] }>()

const journal = useJournalStore()
const photosStore = usePhotosStore()
const settings = useSettingsStore()
const notify = useNotifyStore()
const confirm = useConfirmStore()
const titleId = useId()
const poseLabelId = useId()
const saving = ref(false)
const imageUrl = ref<string | null>(null)

const form = reactive({ takenAt: '', pose: 'front' as PhotoPose, notes: '' })

function releaseImage() {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = null
}

// Reset from props each time the dialog opens, so an abandoned edit never leaks into the next.
watch(open, async (isOpen) => {
  releaseImage()
  if (!isOpen) return
  const p = props.photo
  form.takenAt = toLocalInputValue(p?.takenAt ?? props.takenAt)
  form.pose = p?.pose ?? photosStore.photos[0]?.pose ?? 'front'
  form.notes = p?.notes ?? ''
  if (props.prepared) {
    imageUrl.value = URL.createObjectURL(new Blob([props.prepared.image], { type: 'image/jpeg' }))
  } else if (p) {
    const url = await photosStore.imageUrl(p.id)
    // The dialog may have closed, or moved to another photo, while the image was read.
    if (open.value && props.photo?.id === p.id) imageUrl.value = url
    else if (url) URL.revokeObjectURL(url)
  }
})

onBeforeUnmount(releaseImage)

const aspect = computed(() => {
  const size = props.prepared ?? props.photo
  return size ? size.width / size.height : 3 / 4
})

/** The weigh-in logged nearest the photo, shown so the photo reads with its number. */
const nearby = computed(() => {
  if (!form.takenAt) return null
  const at = toEpochMs(fromLocalInputValue(form.takenAt))
  const w = nearestWeight(
    journal.weights.map((row) => ({ at: toEpochMs(row.measuredAt), kg: row.kg })),
    at,
  )
  return w
    ? `Your weigh-in on ${formatDate(w.at)}: ${formatWeight(w.kg, settings.weightUnit)}`
    : null
})

async function save() {
  if (!form.takenAt) return
  saving.value = true
  const details = {
    takenAt: fromLocalInputValue(form.takenAt),
    pose: form.pose,
    notes: form.notes.trim(),
  }
  try {
    if (props.photo) await photosStore.updatePhoto(props.photo.id, details)
    else if (props.prepared) await photosStore.addPhoto(details, props.prepared)
    notify.show(props.photo ? 'Photo updated' : 'Photo saved', 'success')
    emit('saved')
    open.value = false
  } catch {
    notify.show("Couldn't save. Your device may be out of space.", 'error')
  } finally {
    saving.value = false
  }
}

async function remove() {
  const p = props.photo
  if (!p) return
  const ok = await confirm.ask({
    title: 'Delete this photo?',
    text: `${POSE_LABELS[p.pose]} photo from ${formatDate(p.takenAt)}. This can't be undone.`,
    confirmText: 'Delete',
    destructive: true,
  })
  if (!ok) return
  await photosStore.deletePhoto(p.id)
  notify.show('Photo deleted', 'success')
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="520" scrollable :aria-labelledby="titleId">
    <v-card>
      <v-card-item>
        <p class="gl-eyebrow">{{ photo ? formatDate(photo.takenAt) : 'New' }}</p>
        <v-card-title :id="titleId">Progress photo</v-card-title>
      </v-card-item>
      <v-card-text class="gl-stack">
        <div class="frame" :style="{ aspectRatio: aspect }">
          <img v-if="imageUrl" :src="imageUrl" alt="Your progress photo" />
        </div>
        <p v-if="nearby" class="text-body-small gl-muted">{{ nearby }}</p>
        <div>
          <p :id="poseLabelId" class="gl-label">Pose</p>
          <v-btn-toggle
            v-model="form.pose"
            role="group"
            mandatory
            density="comfortable"
            :aria-labelledby="poseLabelId"
          >
            <v-btn v-for="pose in PHOTO_POSES" :key="pose" :value="pose">
              {{ POSE_LABELS[pose] }}
            </v-btn>
          </v-btn-toggle>
        </div>
        <v-text-field v-model="form.takenAt" label="When" type="datetime-local" />
        <v-textarea v-model="form.notes" label="Notes (optional)" rows="2" auto-grow />
        <template v-if="photo">
          <v-divider />
          <div>
            <v-btn variant="text" color="error" @click="remove">Delete photo</v-btn>
          </div>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ photo ? 'Close' : 'Cancel' }}</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :disabled="!form.takenAt"
          :loading="saving"
          @click="save"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.frame {
  width: 100%;
  max-height: 60vh;
  border-radius: var(--gl-radius-md);
  overflow: hidden;
  background: var(--gl-surface-sunk);
  display: flex;
  justify-content: center;
}

.frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
