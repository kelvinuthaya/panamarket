import { useEffect, useRef } from 'react'
import { BrowserMultiFormatReader } from '@zxing/library'

// Ouvre la caméra et déclenche onDetected(code) au premier scan réussi.
// Le délai 50 ms attend que React ait monté le <video> dans le DOM avant de
// passer la ref à ZXing (absorbe aussi le double-fire de StrictMode en dev).
export function useBarcodeScanner(videoRef, actif, onDetected, onError) {
  const readerRef = useRef(null)

  useEffect(() => {
    if (!actif) return
    let cancelled = false

    const timer = setTimeout(() => {
      if (cancelled || !videoRef.current) return

      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader

      reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoRef.current,
        (result) => {
          if (!result || cancelled) return
          cancelled = true
          reader.reset()
          readerRef.current = null
          onDetected(result.getText())
        }
      ).catch(err => {
        if (!cancelled) onError?.(err)
      })
    }, 50)

    return () => {
      cancelled = true
      clearTimeout(timer)
      if (readerRef.current) {
        readerRef.current.reset()
        readerRef.current = null
      }
    }
  }, [actif])
}
