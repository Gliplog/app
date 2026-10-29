<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { mdiRefresh } from '@/plugins/icons'

/*
 * The service worker waits instead of activating silently, so an update never swaps code
 * under a user mid-calculation. They choose when to reload.
 */
const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({ immediate: true })
</script>

<template>
  <v-snackbar v-model="needRefresh" :timeout="-1" location="top">
    A new version is available.
    <template #actions>
      <v-btn variant="text" :prepend-icon="mdiRefresh" @click="updateServiceWorker(true)"
        >Reload</v-btn
      >
      <v-btn variant="text" @click="needRefresh = false">Later</v-btn>
    </template>
  </v-snackbar>
  <v-snackbar v-model="offlineReady" :timeout="4000" location="top">
    Ready to use offline.
  </v-snackbar>
</template>
