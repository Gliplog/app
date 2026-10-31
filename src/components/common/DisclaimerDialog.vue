<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useNotifyStore } from '@/stores/notify'
import { nowIso } from '@/services/time'
import { ADULT_AGE } from '@/domain/body'

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
        <p class="gl-eyebrow">Before you start</p>
        <v-card-title :id="titleId" class="text-wrap"
          >A private journal, not medical advice</v-card-title
        >
      </v-card-item>
      <v-card-text class="disclaimer">
        <p>
          Gliplog tracks your GLP-1 medicine and weight, and shows published figures with their
          sources. It doesn't recommend doses or replace your prescriber or pharmacist.
        </p>
        <p>Level charts are estimates and trial results are averages. Yours will differ.</p>
        <p>Everything you enter stays on this device. No account, nothing uploaded.</p>
        <p>
          You must be {{ ADULT_AGE }} or older to use Gliplog, or the age of majority where you live
          if that is higher.
        </p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" variant="flat" :loading="saving" @click="accept">
          I'm {{ ADULT_AGE }} or older and understand
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
