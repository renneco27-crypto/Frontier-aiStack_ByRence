import { parseCSVFile } from './csvParser'
import { auditAndFixCSV } from './csvFixer'
import { parseJSONDeckContent } from './jsonParser'
import { createDeck } from '@/db/deckRepository'
import { createCards } from '@/db/cardRepository'
import { createImage, bulkCreateImages } from '@/db/imageRepository'
import { extractDocumentInBrowser } from './wasmDocExtractor'
import { registerJob, patchJob } from '@/store/processingJobsStore'
import { apiUrl } from '@/lib/apiBase'
import type { Deck, Card, DeckImage } from '@/lib/zodSchemas'

export class UploadError extends Error {
  code: string
  step: number
  constructor(code: string, message: string, step: number) {
    super(message)
    this.name = 'UploadError'
    this.code = code
    this.step = step
  }
}

interface ConvertedResult {
  csvText: string
  deckId?: string
  images: Array<{ title: string; caption?: string; dataUrl: string }>
}

interface PolledJobResult {
  csv: string
  deckId?: string
  images: Array<{ title: string; caption?: string; dataUrl: string }>
}

async function pollJobUntilDone(jobId: string, onProgress?: (step: string) => void): Promise<PolledJobResult> {
  const pollIntervalMs = 2000
  const maxInactivityMs = 15 * 60 * 1000 // 15 minutes max inactivity
  let lastProgress = ''
  let lastActivityTime = Date.now()

  while (true) {
    await new Promise(r => setTimeout(r, pollIntervalMs))

    try {
      const res = await fetch(apiUrl(`/api/relay/job-status?id=${encodeURIComponent(jobId)}`))
      if (!res.ok) {
        if (res.status === 404) {
          throw new UploadError('CONVERSION_ERROR', 'Generation job expired or was removed from queue.', 1)
        }
        continue
      }

      const rawText = await res.text().catch(() => '')
      let data: any = null
      try {
        data = rawText ? JSON.parse(rawText) : null
      } catch {
        continue
      }
      if (!data) continue

      if (data.status === 'completed' && data.resultCsv) {
        const returnedImages = Array.isArray(data.images) ? data.images : []
        return { csv: data.resultCsv, deckId: data.deckId, images: returnedImages }
      }

      if (data.status === 'failed') {
        throw new UploadError('CONVERSION_ERROR', data.error || 'Generation failed on Gemini Relay', 1)
      }

      if (data.progress && data.progress !== lastProgress) {
        lastProgress = data.progress
        lastActivityTime = Date.now()
        onProgress?.(`AI generation in progress (${data.progress})…`)
      } else {
        const elapsedSec = Math.round((Date.now() - (data.createdAt || Date.now())) / 1000)
        onProgress?.(`AI generation in progress (${elapsedSec}s elapsed)…`)
      }

      if (Date.now() - lastActivityTime > maxInactivityMs) {
        throw new UploadError('CONVERSION_ERROR', 'Generation stalled with no progress updates for 15 minutes.', 1)
      }
    } catch (err) {
      if (err instanceof UploadError) throw err
      if (Date.now() - lastActivityTime > maxInactivityMs) {
        throw new UploadError('CONVERSION_ERROR', 'Lost connection to generation relay server.', 1)
      }
    }
  }
}

function attachImagesToDeckInBackground(
  deckId: string,
  images: Array<{ title: string; caption?: string; dataUrl: string }>
) {
  if (!images || images.length === 0) return

  // Asynchronous background task: attaches images directly to the newly created deck in IndexedDB
  setTimeout(async () => {
    try {
      const deckImages: DeckImage[] = images.map((img, idx) => ({
        id: `img-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        deckId,
        title: img.title || `Extracted Figure ${idx + 1}`,
        caption: img.caption,
        dataUrl: img.dataUrl,
        createdAt: new Date().toISOString(),
      }))

      await bulkCreateImages(deckImages)
      console.log(`[uploadHandler] Background attached ${deckImages.length} images to deck ${deckId}`)
    } catch (err) {
      console.warn('[uploadHandler] Background image attachment notice:', err)
    }
  }, 10)
}

async function convertFile(file: File, onProgress?: (step: string) => void, targetDeckId?: string): Promise<ConvertedResult> {
  onProgress?.('Processing document…')
  
  // 1. Fast extract document text and capture visual images directly in browser without blocking on heavy OCR
  let extracted = { text: '', images: [] as Array<{ title: string; caption?: string; dataUrl: string }> }
  try {
    extracted = await extractDocumentInBrowser(file, false, onProgress)
  } catch (extractErr) {
    console.warn('[uploadHandler] In-browser extractor notice:', extractErr)
  }

  onProgress?.('Generating study deck with AI…')

  // Build a text-only image list for the server: only images with caption/OCR text,
  // dataUrl stripped out — the AI only needs the text content, not the raw bytes.
  // This prevents the "Unterminated string in JSON" caused by 10MB+ base64 payloads.
  const imagesForServer = extracted.images
    .filter(img => img.caption && img.caption.trim().length > 10)
    .map(({ title, caption }) => ({ title, caption }))

  // 2. Send structured text & diagrams to backend / extension relay with targetDeckId
  let res: Response
  if (extracted.text && extracted.text.length > 10) {
    res = await fetch(apiUrl('/api/convert-docx'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: extracted.text,
        fileName: file.name,
        // Only send images that have text content (no dataUrl — base64 stays local)
        images: imagesForServer.length > 0 ? imagesForServer : undefined,
        deckId: targetDeckId,
        async_mode: true,
      }),
    })
  } else {
    // Fallback to FormData
    const formData = new FormData()
    formData.append('file', file)
    if (targetDeckId) formData.append('deckId', targetDeckId)
    formData.append('async_mode', 'true')
    res = await fetch(apiUrl('/api/convert-docx'), { method: 'POST', body: formData })
  }

  if (!res.ok) {
    const rawErr = await res.text().catch(() => '')
    let errData: any = null
    try { errData = rawErr ? JSON.parse(rawErr) : null } catch {}
    throw new UploadError('CONVERSION_ERROR', errData?.error || 'Unable to convert document. Please check the file and try again.', 1)
  }

  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const rawText = await res.text().catch(() => '')
    let data: any = null
    try {
      data = rawText ? JSON.parse(rawText) : null
    } catch {
      throw new UploadError('CONVERSION_ERROR', 'Server returned an invalid or incomplete response.', 1)
    }
    if (!data) {
      throw new UploadError('CONVERSION_ERROR', 'Server returned an empty response.', 1)
    }

    // If job was enqueued for async background processing by extension worker
    if (data.status === 'enqueued' && data.jobId) {
      onProgress?.('Relay job queued, awaiting Gemini synthesis…')
      const polled = await pollJobUntilDone(data.jobId, onProgress)
      const combinedImgs = [...extracted.images]
      for (const img of polled.images) {
        if (!combinedImgs.some(existing => existing.dataUrl === img.dataUrl)) {
          combinedImgs.push(img)
        }
      }
      return {
        csvText: polled.csv,
        deckId: polled.deckId || data.deckId || targetDeckId,
        images: combinedImgs,
      }
    }

    const serverImgs = Array.isArray(data.images) ? data.images : []
    const combinedImgs = [...extracted.images]
    for (const img of serverImgs) {
      if (!combinedImgs.some(existing => existing.dataUrl === img.dataUrl)) {
        combinedImgs.push(img)
      }
    }

    return {
      csvText: data.csv || '',
      deckId: data.deckId || targetDeckId,
      images: combinedImgs,
    }
  }

  const csvText = await res.text()
  return { csvText, deckId: targetDeckId, images: extracted.images }
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

export async function handleUpload(
  file: File,
  onProgress?: (step: string) => void,
  customTitle?: string
): Promise<string> {
  const jobId = 'job_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6)
  registerJob({
    id: jobId,
    fileName: customTitle?.trim() || file.name,
    status: 'processing',
    progressStep: 'Processing document…',
    createdAt: Date.now(),
  })

  const wrappedProgress = (step: string) => {
    onProgress?.(step)
    patchJob(jobId, { progressStep: step })
  }

  try {
    const ext = file.name.split('.').pop()?.toLowerCase()
    const fallbackTitle = file.name.replace(/\.(csv|json|docx|doc|txt|pdf|pptx|ppt)$/i, '').replace(/[_-]+/g, ' ').trim()
    const title = customTitle?.trim() || ''
    const targetDeckId = `deck-${ext === 'json' ? 'json' : 'csv'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    let parsedResult: { deck: Deck; cards: Card[] } | null = null
    let extractedImages: Array<{ title: string; caption?: string; dataUrl: string }> = []

    const isExplicitJson = ext === 'json' || file.type.includes('json')
    const isTextReadable = isExplicitJson || ext === 'csv' || ext === 'txt' || !ext || file.type.startsWith('text/')

    // 1. JSON FIRST: inspect text files directly without invoking external AI converters
    if (isTextReadable) {
      wrappedProgress('Reading file…')
      const text = await readFileText(file)
      const clean = text.trim()

      // JSON FIRST: check if content is JSON or has a JSON deck structure
      if (clean.startsWith('{') || clean.startsWith('[') || isExplicitJson) {
        try {
          wrappedProgress('Parsing JSON deck…')
          parsedResult = parseJSONDeckContent(clean, title, fallbackTitle, targetDeckId)
        } catch (jsonErr) {
          if (isExplicitJson) throw jsonErr
        }
      }

      // 2. CSV SECOND: if not JSON, check if it's CSV
      if (!parsedResult && (ext === 'csv' || clean.startsWith('front,') || clean.startsWith('front\t') || clean.startsWith('"front"'))) {
        wrappedProgress('Parsing CSV…')
        parsedResult = parseCSVFile(auditAndFixCSV(clean), title, fallbackTitle, targetDeckId)
      }
    }

    // 3. Fallback: only if neither JSON nor CSV could be parsed from text, invoke document converter
    if (!parsedResult) {
      const converted = await convertFile(file, wrappedProgress, targetDeckId)
      const rawText = converted.csvText
      extractedImages = converted.images
      const finalDeckId = converted.deckId || targetDeckId

      if (rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
        parsedResult = parseJSONDeckContent(rawText, title, fallbackTitle, finalDeckId)
      } else {
        parsedResult = parseCSVFile(auditAndFixCSV(rawText), title, fallbackTitle, finalDeckId)
      }
    }

    const { deck, cards } = parsedResult

    wrappedProgress('Saving…')
    const deckWithoutCards: Deck = { ...deck, cards: [] }
    await createDeck(deckWithoutCards)
    await createCards(cards)

    // Attach extracted figures/photos asynchronously in the background so user doesn't wait
    if (extractedImages.length > 0) {
      attachImagesToDeckInBackground(deck.id, extractedImages)
    }

    patchJob(jobId, {
      status: 'completed',
      deckId: deck.id,
      progressStep: 'Ready to study',
      completedAt: Date.now(),
    })

    return deck.id
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    patchJob(jobId, { status: 'failed', error: message })
    if (err instanceof UploadError) throw err
    throw new UploadError('UPLOAD_ERROR', message, 0)
  }
}

export async function handleMultipleUpload(
  files: File[],
  onProgress?: (step: string) => void,
  customTitle?: string
): Promise<string> {
  if (!files || files.length === 0) {
    throw new UploadError('NO_FILES', 'No files selected', 0)
  }
  if (files.length === 1) {
    return handleUpload(files[0], onProgress, customTitle)
  }

  const multiJobId = 'job_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6)
  registerJob({
    id: multiJobId,
    fileName: customTitle?.trim() || `${files[0].name} (+${files.length - 1} files)`,
    status: 'processing',
    progressStep: 'Processing batch documents…',
    createdAt: Date.now(),
  })

  const wrappedProgress = (step: string) => {
    onProgress?.(step)
    patchJob(multiJobId, { progressStep: step })
  }

  try {
    const combinedTexts: string[] = []
    let allImages: Array<{ title: string; caption?: string; dataUrl: string }> = []
    const firstFileName = files[0].name
    const fallbackTitle = files
      .map(f => f.name.replace(/\.(csv|docx|doc|txt|pdf|pptx|ppt)$/i, '').replace(/[_-]+/g, ' ').trim())
      .slice(0, 3)
      .join(' & ')
    const title = customTitle?.trim() || ''
    const targetDeckId = `deck-csv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const fileHeader = `=== Reference Material ${i + 1}: ${file.name} ===`

      wrappedProgress(`Processing ${file.name} (${i + 1}/${files.length})…`)

      if (ext === 'csv' || ext === 'json') {
        const raw = await readFileText(file)
        combinedTexts.push(`${fileHeader}\n${raw}`)
      } else {
        const extracted = await extractDocumentInBrowser(file, false, (step) => {
          wrappedProgress(`[${i + 1}/${files.length}] ${file.name}: ${step}`)
        })
        if (extracted.text && extracted.text.trim()) {
          combinedTexts.push(`${fileHeader}\n${extracted.text}`)
        }
        if (extracted.images && extracted.images.length > 0) {
          const taggedImages = extracted.images.map(img => ({
            ...img,
            title: `[${file.name}] ${img.title}`,
            caption: img.caption ? `${img.caption} (from ${file.name})` : `Extracted from ${file.name}`,
          }))
          allImages = allImages.concat(taggedImages)
        }
      }
    }

    const mergedFullText = combinedTexts.join('\n\n')
    if (!mergedFullText.trim()) {
      throw new UploadError('EMPTY_EXTRACTION', 'No readable content could be extracted from the uploaded files.', 1)
    }

    wrappedProgress('Generating unified study deck with AI…')

    // Strip dataUrls before sending — only pass title+caption for images with OCR text
    const allImagesForServer = allImages
      .filter(img => img.caption && img.caption.trim().length > 10)
      .map(({ title, caption }) => ({ title, caption }))

    const res = await fetch(apiUrl('/api/convert-docx'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: mergedFullText,
        fileName: title || firstFileName,
        images: allImagesForServer.length > 0 ? allImagesForServer : undefined,
        deckId: targetDeckId,
        async_mode: true,
      }),
    })

    if (!res.ok) {
      const rawErr = await res.text().catch(() => '')
      let errData: any = null
      try { errData = rawErr ? JSON.parse(rawErr) : null } catch {}
      throw new UploadError('CONVERSION_ERROR', errData?.error || 'Unable to process document. Please check the file and try again.', 1)
    }

    let csvText = ''
    let finalDeckId = targetDeckId
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const rawText = await res.text().catch(() => '')
      let data: any = null
      try {
        data = rawText ? JSON.parse(rawText) : null
      } catch {
        throw new UploadError('CONVERSION_ERROR', 'Server returned an invalid or incomplete response.', 1)
      }
      if (!data) {
        throw new UploadError('CONVERSION_ERROR', 'Server returned an empty response.', 1)
      }

      // If job was enqueued for async background processing by extension worker
      if (data.status === 'enqueued' && data.jobId) {
        wrappedProgress('Unified relay job queued, awaiting Gemini synthesis…')
        const polled = await pollJobUntilDone(data.jobId, wrappedProgress)
        csvText = polled.csv
        if (polled.deckId) finalDeckId = polled.deckId
        for (const img of polled.images) {
          if (!allImages.some(existing => existing.dataUrl === img.dataUrl)) {
            allImages.push(img)
          }
        }
      } else {
        csvText = data.csv || ''
        if (data.deckId) finalDeckId = data.deckId
        if (Array.isArray(data.images) && data.images.length > 0) {
          for (const img of data.images) {
            if (!allImages.some(existing => existing.dataUrl === img.dataUrl)) {
              allImages.push(img)
            }
          }
        }
      }
    } else {
      csvText = await res.text()
    }

    wrappedProgress('Parsing unified deck…')
    const { deck, cards } = (csvText.trim().startsWith('{') || csvText.trim().startsWith('['))
      ? parseJSONDeckContent(csvText, title, fallbackTitle, finalDeckId)
      : parseCSVFile(auditAndFixCSV(csvText), title, fallbackTitle, finalDeckId)

    wrappedProgress('Saving unified deck…')
    const deckWithoutCards: Deck = { ...deck, cards: [] }
    await createDeck(deckWithoutCards)
    await createCards(cards)

    // Attach extracted figures/photos asynchronously in the background so user doesn't wait
    if (allImages.length > 0) {
      attachImagesToDeckInBackground(deck.id, allImages)
    }

    patchJob(multiJobId, {
      status: 'completed',
      deckId: deck.id,
      progressStep: 'Ready to study',
      completedAt: Date.now(),
    })

    return deck.id
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    patchJob(multiJobId, { status: 'failed', error: message })
    if (err instanceof UploadError) throw err
    throw new UploadError('UPLOAD_ERROR', message, 0)
  }
}
