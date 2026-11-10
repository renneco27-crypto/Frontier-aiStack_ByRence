/**
 * Safe document download helper for standard browsers, PWA, and Median.co (Android/iOS WebViews).
 */
export async function downloadFileBlob(blob: Blob, filename: string): Promise<void> {
  // 1. Check for native Android Capacitor plugin (saves directly to public /storage/emulated/0/Download/)
  if (typeof window !== 'undefined') {
    const nativeStorage = (window as any).Capacitor?.Plugins?.NativeDeckStorage
    if (nativeStorage && typeof nativeStorage.saveFileToDownloads === 'function') {
      try {
        const reader = new FileReader()
        const base64Data = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        await nativeStorage.saveFileToDownloads({
          filename,
          base64Data,
          mimeType: blob.type || 'application/octet-stream'
        })
        return
      } catch (e) {
        console.warn('Native download to Downloads folder failed, falling back:', e)
      }
    }
  }

  // 2. Check for Median.co / GoNative native bridge
  const median = (window as any).median || (window as any).gonative
  if (median?.downloads?.downloadFile) {
    const reader = new FileReader()
    reader.readAsDataURL(blob)
    return new Promise((resolve, reject) => {
      reader.onloadend = () => {
        try {
          const base64data = reader.result as string
          median.downloads.downloadFile({
            url: base64data,
            filename: filename,
            open: true,
          })
          resolve()
        } catch (e) {
          reject(e)
        }
      }
      reader.onerror = reject
    })
  }

  // 2. Try Native Web Share API if available on mobile
  if (typeof navigator !== 'undefined' && (navigator as any).canShare) {
    try {
      const file = new File([blob], filename, { type: blob.type })
      if ((navigator as any).canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
        })
        return
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
    }
  }

  // 3. Fallback: Standard <a> trigger with delayed URL revocation
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()

  // Wait 60s before revoking to give mobile download manager time to fetch the blob
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link)
    }
    URL.revokeObjectURL(url)
  }, 60000)
}
