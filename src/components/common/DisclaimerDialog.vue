<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useNotifyStore } from '@/stores/notify'
import { nowIso } from '@/services/time'

const settings = useSettingsStore()
const notify = useNotifyStore()
const open = computed(() => settings.loaded && settings.disclaimerAcceptedAt === null)
const saving = ref(false)
const titleId = useId()

async function accept() {
  saving.value = true
  try {
    await settings.acceptDisclaimer(nowIso())
  } catch {
    notify.show("Couldn't save. Try again.", 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <v-dialog :model-value="open" max-width="520" persistent :aria-labelledby="titleId">
    <v-card>
      <v-card-item>
        <p class="tb-eyebrow">Before you start</p>
        <v-card-title :id="titleId" class="text-wrap"
          >A private journal, not medical advice</v-card-title
        >
      </v-card-item>
      <v-card-text class="disclaimer">
        <p>
          Tidebook helps you keep track of your GLP-1 medication, your weight and how they change
          over time. It shows published reference figures, each with its source. It doesn't
          recommend doses, and it isn't a substitute for your prescriber or pharmacist.
        </p>
        <p>
          Level charts and trial comparisons are estimates and averages. Your own body, and your own
          results, will differ.
        </p>
        <p>
          Everything you enter stays on this device. There's no account and nothing is uploaded.
        </p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" variant="flat" :loading="saving" @click="accept">
          I understand
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.disclaimer p + p {
  margin-top: 12px;
}
</style>
