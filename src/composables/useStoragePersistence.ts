import { onMounted, reactive } from 'vue'

export interface StorageState {
  supported: boolean
  persisted: boolean | null
  usageBytes: number | null
  quotaBytes: number | null
}

/**
 * Ask the browser to keep this site's data under storage pressure. Safari grants it
 * heuristically (more readily for Home Screen apps) and the grant can lapse, so the request is
 * repeated on every launch. Even when persisted, a backup file is the only real safety net.
 */
export function useStoragePersistence() {
  const state = reactive<StorageState>({
    supported: typeof navigator !== 'undefined' && !!navigator.storage?.persist,
    persisted: null,
    usageBytes: null,
    quotaBytes: null,
  })

  async function refresh() {
    if (!state.supported) return
    try {
      state.persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist())
      const estimate = await navigator.storage.estimate()
      state.usageBytes = estimate.usage ?? null
      state.quotaBytes = estimate.quota ?? null
    } catch {
      state.persisted = false
    }
  }

  onMounted(refresh)

  return { state, actions: { refresh } }
}
