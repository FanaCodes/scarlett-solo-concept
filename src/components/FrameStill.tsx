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
    // Reserve the box so nothing shifts when the manifest lands.
    return <div className={className} style={{ aspectRatio: '3 / 2' }} aria-hidden="true" />
  }

  const widest = manifest.widths[manifest.widths.length - 1]
  const height = Math.round(widest / manifest.aspectRatio)
  const fallbackFormat = manifest.formats.includes('webp') ? 'webp' : manifest.formats[0]

  return (
    <picture>
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
        loading={priority ? 'eager' : 'lazy'}
        onLoad={priority ? markHeroReady : undefined}
        onError={priority ? markHeroReady : undefined}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding={priority ? 'sync' : 'async'}
      />
    </picture>
  )
}
