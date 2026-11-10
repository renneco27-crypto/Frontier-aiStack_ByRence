import JSZip from 'jszip'
import * as mammoth from 'mammoth'
import { createWorker } from 'tesseract.js'

export interface ExtractedDocResult {
  text: string
  images: Array<{
    title: string
    caption?: string
    dataUrl: string
  }>
}

/**
 * Extracts raw readable text runs from legacy binary PPT (PowerPoint 97-2003 OLE format).
 */
export function extractBinaryPptText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const strings: string[] = []

  // 1. Scan for UTF-16LE text runs (4+ chars)
  let currentUtf16: number[] = []
  for (let i = 0; i < bytes.length - 1; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8)
    if ((code >= 32 && code <= 126) || code === 10 || code === 13 || (code >= 160 && code <= 0xd7ff)) {
      currentUtf16.push(code)
    } else {
      if (currentUtf16.length >= 4) {
        const str = String.fromCharCode(...currentUtf16).trim()
        if (str.length >= 4 && !/^[0-9\s._-]+$/.test(str)) {
          if (!str.startsWith('PowerPoint Document') && !str.startsWith('Current User')) {
            strings.push(str)
          }
        }
      }
      currentUtf16 = []
    }
  }

  // 2. Scan for ASCII text runs (5+ chars)
  let currentAscii: number[] = []
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    if ((b >= 32 && b <= 126) || b === 10 || b === 13) {
      currentAscii.push(b)
    } else {
      if (currentAscii.length >= 5) {
        const str = String.fromCharCode(...currentAscii).trim()
        if (str.length >= 5 && !/^[0-9\s._-]+$/.test(str) && !strings.includes(str)) {
          if (!str.startsWith('Current User') && !str.startsWith('PowerPoint Document') && !str.startsWith('SummaryInformation')) {
            strings.push(str)
          }
        }
      }
      currentAscii = []
    }
  }

  // Helper to check if a string is clean human-readable text
  const isHumanReadable = (s: string): boolean => {
    if (s.length < 5) return false
    // Filter XML / OLE artifacts and JPEG markers
    if (s.startsWith('<') || s.endsWith('>') || s.includes('xmlns:') || s.includes('.xml') || s.includes('.rels')) return false
    if (s.startsWith('drs/') || s.startsWith('theme/') || s.startsWith('_rels') || s.startsWith('___PPT')) return false
    if (s.startsWith('PowerPoint') || s.startsWith('Current User') || s.startsWith('SummaryInformation') || s.startsWith('DocumentSummary')) return false
    if (s.includes('CDEFGHIJSTUVWXYZ') || s.includes('cdefghijstuvwxyz')) return false
    if (/^[0-9\s._\-+/*=]+$/.test(s)) return false
    // Must contain at least one multi-letter word
    if (!/[a-zA-Z]{3,}/.test(s)) return false
    // Printable letter/space ratio check (must be at least 70% letters/spaces/standard punctuation)
    const validChars = s.match(/[a-zA-Z0-9\s.,!?:;'"()\-_/]/g) || []
    if (validChars.length / s.length < 0.75) return false
    return true
  }

  const seen = new Set<string>()
  const deduped: string[] = []
  for (const s of strings) {
    if (isHumanReadable(s) && !seen.has(s)) {
      seen.add(s)
      deduped.push(s)
    }
  }

  return deduped.join('\n\n')
}

/**
 * Parses PPTX/PPT presentations directly in JS using JSZip + XML parsing with binary PPT fallback.
 * Extracts slide text, speaker notes, and embedded diagram images.
 */
export async function extractPptxInBrowser(
  arrayBuffer: ArrayBuffer,
  fileName: string = 'presentation.pptx'
): Promise<ExtractedDocResult> {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer)
    const slidesText: string[] = []
    const images: Array<{ title: string; caption?: string; dataUrl: string }> = []

  // 1. Extract embedded media/diagrams
  const mediaFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith('ppt/media/') && !name.endsWith('/')
  )

  let imgIndex = 0
  for (const mediaPath of mediaFiles) {
    const file = zip.file(mediaPath)
    if (!file) continue
    const base64Data = await file.async('base64')
    if (base64Data.length > 3000) {
      imgIndex++
      const ext = mediaPath.split('.').pop()?.toLowerCase() || 'jpeg'
      const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg'
      images.push({
        title: 'Slide Figure ' + imgIndex,
        caption: 'Extracted from ' + fileName,
        dataUrl: 'data:' + mime + ';base64,' + base64Data,
      })
    }
  }

  // 2. Extract slides in numeric order
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0
      return numA - numB
    })

  for (let idx = 0; idx < slideNames.length; idx++) {
    const slideFile = zip.file(slideNames[idx])
    if (!slideFile) continue
    const xml = await slideFile.async('text')

    // Parse paragraph by paragraph (<a:p>) so formatted runs (<a:r><a:t>) stay intact as complete sentences
    const paraMatches = Array.from(xml.matchAll(/<a:p(?:\s+[^>]*)?>([\s\S]*?)<\/a:p>/gi))
    const lines: string[] = []

    for (const pm of paraMatches) {
      const paraXml = pm[1]
      const textMatches = Array.from(paraXml.matchAll(/<a:t(?:\s+[^>]*)?>([\s\S]*?)<\/a:t>/gi))
      const combinedText = textMatches
        .map((m) =>
          m[1]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
        )
        .join('')
        .trim()

      if (combinedText) {
        lines.push(combinedText)
      }
    }

    // Check for corresponding speaker notes
    const notePath = 'ppt/notesSlides/notesSlide' + (idx + 1) + '.xml'
    const noteFile = zip.file(notePath)
    if (noteFile) {
      const noteXml = await noteFile.async('text')
      const noteParaMatches = Array.from(noteXml.matchAll(/<a:p(?:\s+[^>]*)?>([\s\S]*?)<\/a:p>/gi))
      const noteLines: string[] = []
      for (const npm of noteParaMatches) {
        const textMatches = Array.from(npm[1].matchAll(/<a:t(?:\s+[^>]*)?>([\s\S]*?)<\/a:t>/gi))
        const nText = textMatches
          .map((m) =>
            m[1]
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'")
          )
          .join('')
          .trim()
        if (nText) noteLines.push(nText)
      }
      if (noteLines.length > 0) {
        lines.push('Speaker Notes: ' + noteLines.join(' '))
      }
    }

    const slideTitle = lines[0] ? ` - ${lines[0].slice(0, 50)}` : ''
    const slideBody = lines.length > 0 ? lines.join('\n') : '[Slide contains visual diagrams or images]'
    slidesText.push(`=== Slide ${idx + 1}${slideTitle} ===\n${slideBody}`)
  }

    return {
      text: slidesText.join('\n\n'),
      images: images.slice(0, 30),
    }
  } catch (_zipErr) {
    // Fallback for legacy binary .ppt files (PowerPoint 97-2003)
    const binaryText = extractBinaryPptText(arrayBuffer)
    if (binaryText && binaryText.length > 20) {
      return {
        text: `=== Presentation: ${fileName} ===\n${binaryText}`,
        images: [],
      }
    }
    return {
      text: `=== Presentation: ${fileName} ===\n[Note: Binary PPT file could not be parsed via XML. Plain text fallback produced: ${binaryText || 'no readable text'}]`,
      images: [],
    }
  }
}

/**
 * Parses DOCX files using mammoth and JSZip
 */
export async function extractDocxInBrowser(
  arrayBuffer: ArrayBuffer,
  fileName: string = 'document.docx'
): Promise<ExtractedDocResult> {
  const images: Array<{ title: string; caption?: string; dataUrl: string }> = []
  let imgIndex = 0

  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      convertImage: mammoth.images.imgElement(async (img) => {
        try {
          const buffer = await img.read()
          if (buffer.length > 3000) {
            imgIndex++
            const contentType = img.contentType || 'image/jpeg'
            const b64 = Buffer.from(buffer).toString('base64')
            images.push({
              title: 'Document Figure ' + imgIndex,
              caption: 'Extracted from ' + fileName,
              dataUrl: 'data:' + contentType + ';base64,' + b64,
            })
          }
        } catch {}
        return { src: '' }
      }),
    }
  )

  const cleanText = result.value
    .replace(/\s*<\/(p|div|h[1-6]|li|tr|th|td)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim()

  return {
    text: cleanText,
    images: images.slice(0, 30),
  }
}

/**
 * Parses PDF in browser via pdfjs-dist / standard text extraction
 */
export async function extractPdfInBrowser(
  arrayBuffer: ArrayBuffer,
  fileName: string = 'document.pdf'
): Promise<ExtractedDocResult> {
  try {
    const pdfjs = await import('pdfjs-dist')
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@' + pdfjs.version + '/build/pdf.worker.min.mjs'
    }
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) })
    const pdf = await loadingTask.promise
    const pagesText: string[] = []
    const images: Array<{ title: string; caption?: string; dataUrl: string }> = []

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()

      // Reconstruct line-breaks using PDF coordinates and EOL markers
      let lastY: number | null = null
      const lineParts: string[] = []
      let currentLine = ''

      for (const rawItem of textContent.items) {
        if ('str' in rawItem) {
          const item = rawItem as { str: string; transform?: number[]; hasEOL?: boolean }
          const text = item.str
          if (!text) continue

          const y = item.transform ? Math.round(item.transform[5]) : null
          if (lastY !== null && y !== null && Math.abs(lastY - y) > 5) {
            if (currentLine.trim()) {
              lineParts.push(currentLine.trim())
            }
            currentLine = text
          } else {
            currentLine = currentLine ? `${currentLine} ${text}` : text
          }
          if (item.hasEOL) {
            if (currentLine.trim()) {
              lineParts.push(currentLine.trim())
            }
            currentLine = ''
          }
          lastY = y
        }
      }
      if (currentLine.trim()) {
        lineParts.push(currentLine.trim())
      }

      const pageStr = lineParts.join('\n').trim()
      let pageBody = pageStr

      // If page has little or no extractable text, render to canvas as an image for visual extraction & OCR
      if (!pageStr || pageStr.length < 80) {
        try {
          if (typeof document !== 'undefined') {
            const viewport = page.getViewport({ scale: 1.5 })
            const canvas = document.createElement('canvas')
            const context = canvas.getContext('2d')
            canvas.width = viewport.width
            canvas.height = viewport.height

            if (context) {
              await (page.render as any)({ canvasContext: context, viewport, canvas }).promise
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
              images.push({
                title: `Slide ${i} Visual`,
                caption: `Extracted from ${fileName} (Slide ${i})`,
                dataUrl,
              })

              // Run client-side WASM OCR directly on slide visual
              try {
                const ocrText = await runWasmOcr(dataUrl)
                if (ocrText && ocrText.length > 5) {
                  pageBody = pageBody ? `${pageBody}\n${ocrText}` : ocrText
                }
              } catch {}

              if (!pageBody) {
                pageBody = '[Slide contains visual diagrams or scanned graphics]'
              }
            }
          }
        } catch {}
      }

      pagesText.push(`=== Slide ${i} ===\n${pageBody || '[Visual diagrams/charts]'}`)
    }

    return {
      text: pagesText.join('\n\n'),
      images,
    }
  } catch (pdfErr) {
    console.warn('[wasmDocExtractor] PDF.js extraction fallback:', pdfErr)
    return {
      text: '=== Document: ' + fileName + ' ===\n[PDF document parsed]',
      images: [],
    }
  }
}

/**
 * Runs client-side WASM OCR using Tesseract.js on an image or diagram
 */
export async function runWasmOcr(
  imageSource: string | Blob | ArrayBuffer
): Promise<string> {
  try {
    const worker = await createWorker('eng')
    const source = imageSource instanceof ArrayBuffer ? new Blob([imageSource]) : imageSource
    const ret = await worker.recognize(source)
    await worker.terminate()
    return ret.data.text.trim()
  } catch (err) {
    console.warn('[wasmDocExtractor] Tesseract WASM OCR error:', err)
    return ''
  }
}

/**
 * Unified in-browser WASM / JS Document Extractor
 * Zero Python, Zero .bat script, 100% Client-side compatible!
 */
export async function extractDocumentInBrowser(
  file: File,
  deepOcr: boolean = false,
  onProgress?: (step: string) => void
): Promise<ExtractedDocResult> {
  const fileName = file.name
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  onProgress?.('Processing ' + fileName + '…')

  const arrayBuffer = await file.arrayBuffer()
  let result: ExtractedDocResult = { text: '', images: [] }

  if (ext === 'pptx' || ext === 'ppt') {
    result = await extractPptxInBrowser(arrayBuffer, fileName)
  } else if (ext === 'docx' || ext === 'doc') {
    result = await extractDocxInBrowser(arrayBuffer, fileName)
  } else if (ext === 'pdf') {
    result = await extractPdfInBrowser(arrayBuffer, fileName)
  } else if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) {
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
    const b64 = Buffer.from(arrayBuffer).toString('base64')
    const dataUrl = 'data:' + mime + ';base64,' + b64
    result = {
      text: '=== Visual Diagram: ' + fileName + ' ===',
      images: [{ title: fileName, caption: 'Uploaded Diagram', dataUrl }],
    }
  } else {
    const text = new TextDecoder('utf-8').decode(arrayBuffer)
    result = { text, images: [] }
  }

  // If Deep OCR is requested on document diagrams (DOCX or standalone images), scan them
  if (deepOcr && result.images.length > 0 && ext !== 'pdf' && ext !== 'pptx' && ext !== 'ppt') {
    onProgress?.('Analyzing diagrams & figures…')
    const ocrTexts: string[] = []
    const limit = Math.min(result.images.length, 10)
    for (let i = 0; i < limit; i++) {
      const img = result.images[i]
      onProgress?.('Scanning visual ' + (i + 1) + '/' + limit + '…')
      const ocrResult = await runWasmOcr(img.dataUrl)
      if (ocrResult && ocrResult.length > 5) {
        ocrTexts.push('[Diagram Text - ' + img.title + ']:\n' + ocrResult)
      }
    }
    if (ocrTexts.length > 0) {
      result.text += '\n\n=== EXTRACTED DIAGRAM TEXT ===\n' + ocrTexts.join('\n\n')
    }
  }

  return result
}
