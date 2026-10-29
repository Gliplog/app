import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ConfirmRequest {
  title: string
  text: string
  confirmText: string
  destructive: boolean
}

/**
 * Promise-based confirmation. Every destructive action (delete, restore over existing data)
 * awaits `ask()` immediately before acting; AppConfirm renders the dialog.
 */
export const useConfirmStore = defineStore('confirm', () => {
  const request = ref<ConfirmRequest | null>(null)
  let resolver: ((ok: boolean) => void) | null = null

  function ask(
    input: Partial<ConfirmRequest> & Pick<ConfirmRequest, 'title' | 'text'>,
  ): Promise<boolean> {
    resolver?.(false)
    request.value = { confirmText: 'Confirm', destructive: false, ...input }
    return new Promise((resolve) => {
      resolver = resolve
    })
  }

  function answer(ok: boolean) {
    resolver?.(ok)
    resolver = null
    request.value = null
  }

  return { request, ask, answer }
})
