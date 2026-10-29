<script setup lang="ts">
import { computed } from 'vue'
import { useConfirmStore } from '@/stores/confirm'

const confirm = useConfirmStore()
const open = computed({
  get: () => confirm.request !== null,
  set: (v: boolean) => {
    if (!v) confirm.answer(false)
  },
})
</script>

<template>
  <v-dialog v-model="open" max-width="440" persistent>
    <v-card v-if="confirm.request">
      <v-card-item>
        <v-card-title class="text-wrap">{{ confirm.request.title }}</v-card-title>
      </v-card-item>
      <v-card-text>{{ confirm.request.text }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="confirm.answer(false)">Cancel</v-btn>
        <v-btn
          :color="confirm.request.destructive ? 'error' : 'primary'"
          variant="flat"
          @click="confirm.answer(true)"
        >
          {{ confirm.request.confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
