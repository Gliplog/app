import { defineStore } from 'pinia'
import { ref } from 'vue'
import { repository } from '@/db'
import type { PhotoRow } from '@/db/database'
import type { NewPhoto, PhotoChanges } from '@/db/repository'
import type { PreparedPhoto } from '@/services/photos/preparePhoto'

const jpegUrl = (bytes: ArrayBuffer) =>
  URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }))

/**
 * Progress photos. Details and thumbnails stay in memory (a few kilobytes each) as object URLs,
 * replaced on every load; full images are read one at a time with `imageUrl`, and the caller
 * revokes what it gets.
 */
export const usePhotosStore = defineStore('photos', () => {
  /** Newest first. */
  const photos = ref<PhotoRow[]>([])
  const thumbUrls = ref<Record<string, string>>({})
  const loaded = ref(false)

  async function load() {
    const [rows, thumbs] = await Promise.all([
      repository.listPhotos(),
      repository.listPhotoThumbs(),
    ])
    const previous = Object.values(thumbUrls.value)
    thumbUrls.value = Object.fromEntries(thumbs.map((t) => [t.id, jpegUrl(t.bytes)]))
    photos.value = rows
    previous.forEach((url) => URL.revokeObjectURL(url))
    loaded.value = true
  }

  /** An object URL for the full image, or null if it is missing. Revoke it when done. */
  async function imageUrl(id: string): Promise<string | null> {
    const bytes = await repository.getPhotoImage(id)
    return bytes ? jpegUrl(bytes) : null
  }

  async function addPhoto(
    details: Omit<NewPhoto, 'width' | 'height'>,
    prepared: PreparedPhoto,
  ): Promise<PhotoRow> {
    const row = await repository.addPhoto(
      { ...details, width: prepared.width, height: prepared.height },
      prepared.image,
      prepared.thumb,
    )
    await load()
    return row
  }

  async function updatePhoto(id: string, changes: PhotoChanges) {
    await repository.updatePhoto(id, changes)
    await load()
  }

  async function deletePhoto(id: string) {
    await repository.deletePhoto(id)
    await load()
  }

  return { photos, thumbUrls, loaded, load, imageUrl, addPhoto, updatePhoto, deletePhoto }
})
