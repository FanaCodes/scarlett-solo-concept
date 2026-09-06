import type { FrameManifest } from './FrameSequence'

/**
 * Where every named part of the model lands on every frame, in coordinates
 * normalised to the drawn image box, written by scripts/render-frames.mjs.
 *
 * This is what lets an annotation point at a component rather than at a fixed
 * spot on the canvas: the leader line follows the part as the unit turns. The
 * `v` array records whether the part was actually unoccluded on that frame,
 * which is what the annotation frame ranges in product.ts were tuned against.
 */
export type SequenceAnchors = {
  name: string
  frameCount: number
  nodes: Record<string, { p: [number, number][]; v: number[] }>
}

const cache = new Map<string, Promise<SequenceAnchors | null>>()

function isAnchors(value: unknown): value is SequenceAnchors {
  const a = value as Partial<SequenceAnchors> | null
  return !!a && typeof a.frameCount === 'number' && !!a.nodes && typeof a.nodes === 'object'
}

/**
 * Anchors are optional: a sequence rendered without them still works, the
 * annotations just fall back to their authored static anchor.
 */
export function loadAnchors(manifest: FrameManifest): Promise<SequenceAnchors | null> {
  if (!manifest.anchorsPath) return Promise.resolve(null)
  const base = manifest.anchorsPath.replaceAll('{name}', manifest.name)
  const url = manifest.version ? `${base}?v=${manifest.version}` : base

  let pending = cache.get(url)
  if (!pending) {
    pending = fetch(url)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => (isAnchors(data) ? data : null))
      .catch((error: unknown) => {
        console.warn(`[anchors] ${url} unavailable, falling back to static anchors —`, error)
        return null
      })
    cache.set(url, pending)
  }
  return pending
}
