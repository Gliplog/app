import { computed, reactive, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { paginate, PAGE_SIZE, type Page } from '@/domain/listing'

/**
 * Pages through a list that lives in memory. `page` is clamped on read, so deleting the last
 * item of the last page shows the page before it. Call `reset` when the order changes.
 */
export function usePaging<T>(items: MaybeRefOrGetter<readonly T[]>, pageSize = PAGE_SIZE) {
  const state = reactive({ page: 1 })
  const current = computed<Page<T>>(() => paginate(toValue(items), state.page, pageSize))

  // Keep the stored page in range too, so the pager and the slice never disagree.
  watch(
    () => current.value.page,
    (page) => {
      state.page = page
    },
  )

  function reset() {
    state.page = 1
  }

  return { state, current, reset }
}
