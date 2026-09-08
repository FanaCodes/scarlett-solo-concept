import { framePath, type FrameManifest } from '../lib/FrameSequence'
import { useManifest } from '../lib/useManifest'
import { markHeroReady } from '../lib/heroReady'

type Props = {
  manifestUrl: string
  frame: number
  alt: string
  className?: string
  /** Layout hint for the browser; the frame tiers are the candidate widths. */
  sizes?: string
  /** True for the hero still, which is the LCP element and must not be lazy. */
  priority?: boolean
}

function srcSet(manifest: FrameManifest, frame: number, format: string): string {
  return manifest.widths.map((w) => `${framePath(manifest, w, frame, format)} ${w}w`).join(', ')
}

/**
 * A single frame from a sequence, served through the same manifest the scrub
 * engine reads. Used by the hero, the macro stills, the reduced-motion path
 * and the failure path — so none of them hardcodes a frame URL either.
 */
export function FrameStill({
  manifestUrl,
  frame,
  alt,
  className,
  sizes = '100vw',
  priority = false,
}: Props) {
  const manifest = useManifest(manifestUrl)

  if (!manifest) {
    // Reserve the box so nothing shifts when the manifest lands. The explicit
    // width matters: `w-auto` on an empty div inside a flex column collapses
    // to nothing, so the row was sized by its copy alone and then grew by
    // nearly three hundred pixels the moment the image appeared.
    return (
      <div
        className={className}
        style={{ aspectRatio: '3 / 2', width: '100%' }}
        aria-hidden="true"
      />
    )
  }

  const widest = manifest.widths[manifest.widths.length - 1]
  const height = Math.round(widest / manifest.aspectRatio)
  const fallbackFormat = manifest.formats.includes('webp') ? 'webp' : manifest.formats[0]

  return (
    /*
     * The wrapper carries the definite width. <picture> is inline and
     * shrink-to-fit by default, so a percentage width on the image inside it
     * resolves against a box that depends on the image — circular, and it
     * collapsed to zero until the bytes arrived.
     */
    <picture style={{ display: 'block', width: '100%' }}>
      {manifest.formats.includes('avif') ? (
        <source type="image/avif" srcSet={srcSet(manifest, frame, 'avif')} sizes={sizes} />
      ) : null}
      <source type={`image/${fallbackFormat}`} srcSet={srcSet(manifest, frame, fallbackFormat)} sizes={sizes} />
      <img
        src={framePath(manifest, manifest.widths[0], frame, fallbackFormat)}
        alt={alt}
        width={widest}
        height={height}
        className={className}
        /*
         * The box is reserved from the manifest rather than left to the image.
         * `w-auto` on an image that has not loaded yet has no intrinsic width,
         * and inside a flex column that collapses it to nothing — every macro
         * still measured 0x0 until its bytes arrived and then shoved the row
         * down by 287px. An explicit width plus the manifest's aspect ratio
         * holds the space from the first paint; object-contain keeps the image
         * itself undistorted inside it.
         */
        style={{ aspectRatio: String(manifest.aspectRatio), width: '100%', objectFit: 'contain' }}
        loading={priority ? 'eager' : 'lazy'}
        onLoad={priority ? markHeroReady : undefined}
        onError={priority ? markHeroReady : undefined}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding={priority ? 'sync' : 'async'}
      />
    </picture>
  )
}
