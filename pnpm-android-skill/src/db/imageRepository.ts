import { db } from './schema'
import type { DeckImage } from '@/lib/zodSchemas'

export async function createImage(image: DeckImage): Promise<string> {
  try {
    await db.images.add(image)
    return image.id
  } catch (err) {
    throw new Error(`Failed to save image: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function bulkCreateImages(images: DeckImage[]): Promise<void> {
  if (!images || images.length === 0) return
  try {
    await db.images.bulkAdd(images)
  } catch (err) {
    console.warn('[imageRepository] bulkAdd fallback:', err)
    for (const img of images) {
      await db.images.put(img).catch(() => {})
    }
  }
}

export async function getImagesByDeck(deckId: string): Promise<DeckImage[]> {
  try {
    return await db.images.where('deckId').equals(deckId).reverse().sortBy('createdAt')
  } catch (err) {
    throw new Error(`Failed to get deck images: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function getImage(id: string): Promise<DeckImage | undefined> {
  try {
    return await db.images.get(id)
  } catch (err) {
    throw new Error(`Failed to get image: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function updateImage(id: string, partial: Partial<DeckImage>): Promise<void> {
  try {
    await db.images.update(id, partial)
  } catch (err) {
    throw new Error(`Failed to update image: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function deleteImage(id: string): Promise<void> {
  try {
    await db.images.delete(id)
  } catch (err) {
    throw new Error(`Failed to delete image: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function bulkDeleteImages(ids: string[]): Promise<void> {
  try {
    await db.images.bulkDelete(ids)
  } catch (err) {
    throw new Error(`Failed to delete images: ${err instanceof Error ? err.message : String(err)}`)
  }
}
