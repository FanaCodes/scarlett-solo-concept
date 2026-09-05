import { useEffect, useState } from 'react'
import { loadManifest, type FrameManifest } from './FrameSequence'

/** Manifests are small and immutable; one fetch per URL per page load. */
const cache = new Map<string, Promise<FrameManifest>>()

export function getManifest(url: string): Promise<FrameManifest> {
  let pending = cache.get(url)
  if (!pending) {
    pending = loadManifest(url)
    cache.set(url, pending)
  }
  return pending
}

/**
 * Read-only access to a sequence manifest for components that show stills
 * rather than scrub — the macro details and the reduced-motion path. They
 * build their URLs from the manifest for the same reason the engine does.
 */
export function useManifest(url: string): FrameManifest | null {
  const [manifest, setManifest] = useState<FrameManifest | null>(null)

  useEffect(() => {
    let cancelled = false
    getManifest(url)
      .then((m) => {
        if (!cancelled) setManifest(m)
      })
      .catch((error: unknown) => {
        console.error(`[useManifest] ${url} unavailable —`, error)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  return manifest
}
