<script setup lang="ts">
import { onBeforeUnmount, ref, useId, watch } from 'vue'
import { useChartColors } from '@/composables/useChartColors'
import { useNotifyStore } from '@/stores/notify'
import { saveFile } from '@/services/fileTransfer'
import { fileDate, systemClock } from '@/services/time'
import { mdiShareVariantOutline } from '@/plugins/icons'
import { renderShareCard, type ShareCardContent } from './shareCard'

/**
 * Preview an image card and share it: the share sheet on phones (Messages, WhatsApp, Photos),
 * a download elsewhere. The image is drawn on the device and leaves only when the user shares
 * it. Privacy choices go in the default slot; the preview redraws whenever `content` changes.
 */
const props = defineProps<{
  title: string
  /** File name without the date or extension: "gliplog-weight". */
  fileStem: string
  content: ShareCardContent | null
}>()

const open = defineModel<boolean>({ required: true })
const notify = useNotifyStore()
const { colors } = useChartColors()
const titleId = useId()

const image = ref<Blob | null>(null)
const previewUrl = ref<string | null>(null)
const busy = ref(false)

function setPreview(blob: Blob | null) {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  image.value = blob
  previewUrl.value = blob ? URL.createObjectURL(blob) : null
}

/** Only the latest render wins, so quick toggling never shows a stale preview. */
let generation = 0
async function render() {
  const content = props.content
  if (!content) return
  const mine = ++generation
  busy.value = true
  try {
    const blob = await renderShareCard(content, colors.value)
    if (mine === generation) setPreview(blob)
  } catch {
    notify.show("Couldn't create the image.", 'error')
    open.value = false
  } finally {
    if (mine === generation) busy.value = false
  }
}

watch(
  [open, () => props.content],
  () => {
    if (open.value) void render()
    else setPreview(null)
  },
  { deep: true },
)
onBeforeUnmount(() => setPreview(null))

async function share() {
  if (!image.value) return
  const result = await saveFile(
    `${props.fileStem}-${fileDate(systemClock().getTime())}.png`,
    image.value,
  )
  if (result === 'downloaded') notify.show('Image saved', 'success')
  if (result !== 'cancelled') open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="520" scrollable :aria-labelledby="titleId">
    <v-card>
      <v-card-item>
        <v-card-title :id="titleId">{{ title }}</v-card-title>
      </v-card-item>
      <v-card-text class="gl-stack">
        <div class="share-preview">
          <img
            v-if="previewUrl"
            :src="previewUrl"
            alt="Preview of the image to share"
            class="share-preview__img"
          />
          <v-progress-circular v-else indeterminate color="primary" />
        </div>
        <div class="gl-stack gl-stack--tight">
          <slot />
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn
          variant="flat"
          color="primary"
          :prepend-icon="mdiShareVariantOutline"
          :disabled="!image"
          :loading="busy"
          @click="share"
        >
          Share
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.share-preview {
  display: grid;
  place-items: center;
  aspect-ratio: 4 / 5;
  max-height: 52vh;
  margin-inline: auto;
}

.share-preview__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: var(--gl-radius-md);
  box-shadow: var(--gl-glass-shadow);
}
</style>
