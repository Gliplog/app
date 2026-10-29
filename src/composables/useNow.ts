import { onBeforeUnmount, onMounted, ref } from 'vue'
import { systemClock } from '@/services/time'

/** Epoch ms that ticks every `intervalMs`, so "now" markers and countdowns stay current. */
export function useNow(intervalMs = 60_000) {
  const now = ref(systemClock().getTime())
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    timer = setInterval(() => {
      now.value = systemClock().getTime()
    }, intervalMs)
  })
  onBeforeUnmount(() => clearInterval(timer))
  return now
}
