import { db, type SyncQueueItem } from './schema'
import { createBrowserSupabase } from '@/lib/supabase'

class SyncEngine {
  private isSyncing = false

  async enqueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'status' | 'retryCount'>): Promise<void> {
    await db.syncQueue.add({
      ...item,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
    })

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.processQueue()
    }
  }

  async processQueue(): Promise<void> {
    if (this.isSyncing) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    this.isSyncing = true
    const supabase = createBrowserSupabase()

    try {
      const pendingItems = await db.syncQueue
        .where('status')
        .equals('pending')
        .sortBy('id')

      for (const item of pendingItems) {
        if (!item.id) continue

        await db.syncQueue.update(item.id, { status: 'syncing' })

        try {
          if (item.table === 'decks') {
            if (item.action === 'create' || item.action === 'update') {
              const raw = item.payload || {}
              const sanitized: Record<string, any> = {
                id: raw.id || item.recordId,
                title: raw.title || 'Untitled',
                subject: raw.subject || 'General',
              }
              if (raw.csv_content) sanitized.csv_content = raw.csv_content
              if (raw.json_content) sanitized.json_content = raw.json_content
              if (raw.author_name) sanitized.author_name = raw.author_name
              if (raw.published_at) sanitized.published_at = raw.published_at
              if (raw.download_count !== undefined) sanitized.download_count = raw.download_count
              if (raw.device_id) sanitized.device_id = raw.device_id
              if (raw.folder_id) sanitized.folder_id = raw.folder_id
              if (raw.owner_id) sanitized.owner_id = raw.owner_id

              const { error } = await supabase.from('decks').upsert(sanitized)
              if (error) {
                if (error.code === 'PGRST204' || error.message?.includes('schema cache')) {
                  console.warn(`[SyncEngine] Deleting invalid deck sync payload for item ${item.id}:`, error.message)
                  await db.syncQueue.delete(item.id)
                  continue
                }
                throw error
              }
            } else if (item.action === 'delete') {
              const { error } = await supabase.from('decks').delete().eq('id', item.recordId)
              if (error) throw error
            }
          } else if (item.table === 'cards') {
            if (item.action === 'create' || item.action === 'update') {
              const { error } = await supabase.from('cards').upsert(item.payload)
              if (error) {
                if (error.code === 'PGRST204' || error.message?.includes('schema cache')) {
                  console.warn(`[SyncEngine] Deleting invalid cards sync payload for item ${item.id}:`, error.message)
                  await db.syncQueue.delete(item.id)
                  continue
                }
                throw error
              }
            } else if (item.action === 'delete') {
              const { error } = await supabase.from('cards').delete().eq('id', item.recordId)
              if (error) throw error
            }
          }

          // Successfully synced -> dequeue
          await db.syncQueue.delete(item.id)
        } catch (err: any) {
          console.error(`Sync failed for item ${item.id}:`, err)
          const nextRetry = item.retryCount + 1

          if (nextRetry >= 3 || err.code === 'PGRST204' || err.message?.includes('schema cache')) {
            // Poison item — purge so it stops blocking the queue
            console.warn(`[SyncEngine] Purging poison item ${item.id}:`, err.message || err)
            await db.syncQueue.delete(item.id)
            continue
          }

          await db.syncQueue.update(item.id, {
            status: 'pending',
            retryCount: nextRetry,
            lastError: err.message || String(err),
          })
          break // Keep FIFO order on failure
        }
      }
    } finally {
      this.isSyncing = false
    }
  }

  init(): void {
    if (typeof window === 'undefined') return

    // Clean up any legacy poison items that have failed or were stuck
    db.syncQueue.where('status').equals('failed').delete().catch(() => {})

    window.addEventListener('online', () => {
      console.log('Online event detected, processing outbox...')
      this.processQueue()
    })

    window.addEventListener('app-online', () => {
      this.processQueue()
    })

    // Safety fallback interval every 45s when online
    setInterval(() => {
      if (navigator.onLine) {
        this.processQueue()
      }
    }, 45000)
  }

  async retryFailed(): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    const failed = await db.syncQueue.where('status').equals('failed').toArray()
    for (const item of failed) {
      if (!item.id) continue
      await db.syncQueue.update(item.id, { status: 'pending', retryCount: 0 })
    }
    this.processQueue()
  }

}

export const syncEngine = new SyncEngine()
