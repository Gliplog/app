<script setup lang="ts">
import { computed } from 'vue'
import { useNotifyStore } from '@/stores/notify'

const notify = useNotifyStore()
const open = computed({
  get: () => notify.current !== null,
  set: (v: boolean) => {
    if (!v) notify.dismiss()
  },
})
const color = computed(() => (notify.current?.tone === 'error' ? 'error' : undefined))
</script>

<template>
  <v-snackbar
    :key="notify.current?.id"
    v-model="open"
    :color="color"
    :timeout="notify.current?.tone === 'error' ? 8000 : 3500"
    location="bottom"
    class="app-snackbar"
  >
    {{ notify.current?.text }}
    <template #actions>
      <v-btn variant="text" @click="notify.dismiss()">Close</v-btn>
    </template>
  </v-snackbar>
</template>

<style scoped>
/* Clear the bottom navigation and the iOS home indicator. */
.app-snackbar {
  margin-bottom: calc(64px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom)));
}
</style>
