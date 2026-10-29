import { defineStore } from 'pinia'
import { ref } from 'vue'

export type NotifyTone = 'success' | 'info' | 'warning' | 'error'

export interface Notice {
  id: number
  text: string
  tone: NotifyTone
}

/** The single notification queue; AppSnackbar renders it. Never mount a local v-snackbar. */
export const useNotifyStore = defineStore('notify', () => {
  const current = ref<Notice | null>(null)
  let nextId = 1

  function show(text: string, tone: NotifyTone = 'info') {
    current.value = { id: nextId++, text, tone }
  }

  function dismiss() {
    current.value = null
  }

  return { current, show, dismiss }
})
