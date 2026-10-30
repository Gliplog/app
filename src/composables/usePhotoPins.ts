import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { drawPin, type PinColors } from '@/components/charts/photoPins'
import { loadImage } from '@/components/share/cardCanvas'
import { usePhotosStore } from '@/stores/photos'

/**
 * Pin images (data URLs) for the progress photos in `ids`, drawn from their thumbnails in the
 * current theme's colours. Each is drawn once per photo and theme; a theme change redraws.
 * A data URL rather than a blob: ECharts keeps the string, and it never needs revoking.
 */
export function usePhotoPins(ids: MaybeRefOrGetter<string[]>, colors: MaybeRefOrGetter<PinColors>) {
  const photos = usePhotosStore()
  const pins = ref<Record<string, string>>({})
  const cache = new Map<string, string>()

  watch(
    [() => toValue(ids), () => toValue(colors), () => photos.thumbUrls],
    async ([list, c, thumbs]) => {
      const theme = `${c.surface}|${c.text}`
      const next: Record<string, string> = {}
      await Promise.all(
        list.map(async (id) => {
          const key = `${id}|${theme}`
          const url = thumbs[id]
          if (!url) return
          let pin = cache.get(key)
          if (!pin) {
            try {
              pin = drawPin(await loadImage(url), c).toDataURL('image/png')
              cache.set(key, pin)
            } catch {
              return
            }
          }
          next[id] = pin
        }),
      )
      pins.value = next
    },
    { immediate: true },
  )

  return { pins }
}
