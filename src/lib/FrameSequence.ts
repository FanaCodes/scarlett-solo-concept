/**
 * FrameSequence — decode a pre-rendered image sequence once, then draw one
 * frame per tick under scroll control.
 *
 * Everything about the sequence comes from its manifest.json: frame count,
 * width tiers, formats, path pattern, aspect ratio, alpha. Nothing here or in
 * any component hardcodes a path, a count or a size, so swapping placeholder
 * renders for real ones is a script run and no code change.
 */

export type FrameManifest = {
  name: string
  frameCount: number
  widths: number[]
  formats: string[]
  pathPattern: string
  aspectRatio: number
  hasAlpha: boolean
}

export type FrameSequenceEvents = {
  /** 0..1, fired as frames land. */
  onProgress?: (progress: number) => void
  /** Fired once every frame has been decoded (or given up on). */
  onReady?: (seq: FrameSequence) => void
  /** Fired once if the sequence cannot be used at all. */
  onFail?: (reason: Error) => void
}

/** The drawn image box in CSS pixels, for positioning annotations. */
export type ImageBox = { x: number; y: number; width: number; height: number }

const DPR_CAP = 2
const FETCH_CONCURRENCY = 6
/** Above this, the decoded footprint is worth telling the developer about. */
const FRAME_WARN_THRESHOLD = 180
/** If more than this share of frames fail, the sequence is unusable. */
const FAILURE_RATIO = 0.15

function isManifest(value: unknown): value is FrameManifest {
  const m = value as Partial<FrameManifest> | null
  return (
    !!m &&
    typeof m.name === 'string' &&
    typeof m.frameCount === 'number' &&
    m.frameCount > 0 &&
    Array.isArray(m.widths) &&
    m.widths.length > 0 &&
    Array.isArray(m.formats) &&
    m.formats.length > 0 &&
    typeof m.pathPattern === 'string' &&
    typeof m.aspectRatio === 'number' &&
    m.aspectRatio > 0
  )
}

export function framePath(
  manifest: FrameManifest,
  width: number,
  index: number,
  format: string,
  pad = 4,
): string {
  return manifest.pathPattern
    .replaceAll('{name}', manifest.name)
    .replaceAll('{width}', String(width))
    .replaceAll('{index}', String(index).padStart(pad, '0'))
    .replaceAll('{format}', format)
}

/** Fetch and validate a sequence manifest. The only entry point for one. */
export async function loadManifest(manifestUrl: string): Promise<FrameManifest> {
  const response = await fetch(manifestUrl, { cache: 'force-cache' })
  if (!response.ok) throw new Error(`manifest ${response.status} ${manifestUrl}`)
  const manifest: unknown = await response.json()
  if (!isManifest(manifest)) throw new Error(`malformed manifest at ${manifestUrl}`)
  return manifest
}

/**
 * One probe per page load, shared by every sequence. It decodes a 2x2 AVIF
 * with alpha through createImageBitmap — the exact path the frames take, so
 * the answer is about what the engine can actually use, not about what an
 * <img> tag would accept.
 */
let avifSupport: Promise<boolean> | null = null
function supportsAvif(): Promise<boolean> {
  if (!avifSupport) {
    avifSupport = (async () => {
      try {
        const blob = await (await fetch(AVIF_PROBE)).blob()
        const bitmap = await createImageBitmap(blob)
        bitmap.close()
        return true
      } catch {
        return false
      }
    })()
  }
  return avifSupport
}

const AVIF_PROBE =
  'data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAG1pZjFhdmlmbWlhZgAAAXBtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAAA5waXRtAAAAAAABAAAANGlsb2MAAAAAREAAAgABAAAAAAGUAAEAAAAAAAAAFwACAAAAAAGrAAEAAAAAAAAAEgAAADhpaW5mAAAAAAACAAAAFWluZmUCAAAAAAEAAGF2MDEAAAAAFWluZmUCAAAAAAIAAGF2MDEAAAAAr2lwcnAAAACKaXBjbwAAAAxhdjFDgSACAAAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAcAAAAAA5waXhpAAAAAAEIAAAAOGF1eEMAAAAAdXJuOm1wZWc6bXBlZ0I6Y2ljcDpzeXN0ZW1zOmF1eGlsaWFyeTphbHBoYQAAAAAdaXBtYQAAAAAAAAACAAEDgQIDAAIEhAIFhgAAABppcmVmAAAAAAAAAA5hdXhsAAIAAQABAAAAMW1kYXQSAAoHOAA2EBDQaTIKH5A////EAACv7hIACgQYADYVMggfkP/xAAIgqA=='

async function decodeFrame(url: string, signal: AbortSignal): Promise<ImageBitmap> {
  const response = await fetch(url, { signal, cache: 'force-cache' })
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return createImageBitmap(await response.blob())
}

export class FrameSequence {
  readonly manifest: FrameManifest
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly events: FrameSequenceEvents
  private readonly controller = new AbortController()

  private bitmaps: (ImageBitmap | undefined)[]
  private width: number
  private format: string
  private loaded = 0
  private failedCount = 0
  private lastDrawnIndex = -1
  private pendingIndex = 0
  private dirty = true
  private loadStarted = false
  private box: ImageBox = { x: 0, y: 0, width: 0, height: 0 }
  private destroyed = false

  ready = false

  private constructor(
    manifest: FrameManifest,
    canvas: HTMLCanvasElement,
    events: FrameSequenceEvents,
    width: number,
    format: string,
  ) {
    this.manifest = manifest
    this.canvas = canvas
    this.events = events
    this.width = width
    this.format = format
    this.bitmaps = new Array(manifest.frameCount)
    const ctx = canvas.getContext('2d', { alpha: manifest.hasAlpha })
    if (!ctx) throw new Error('2D canvas context unavailable')
    this.ctx = ctx
    this.resize()
  }

  /**
   * Fetch the manifest and choose a width tier. Deliberately does not start
   * decoding: the caller decides when, so a sequence never competes with the
   * hero image for bandwidth. Call load() to begin.
   */
  static async create(
    manifestUrl: string,
    canvas: HTMLCanvasElement,
    events: FrameSequenceEvents = {},
  ): Promise<FrameSequence> {
    const manifest = await loadManifest(manifestUrl)
    const width = pickWidthTier(manifest.widths)
    const format =
      manifest.formats.includes('avif') && (await supportsAvif())
        ? 'avif'
        : (manifest.formats.find((f) => f !== 'avif') ?? manifest.formats[0])

    return new FrameSequence(manifest, canvas, events, width, format)
  }

  /** Begin decoding. Idempotent; safe to call from an observer that may re-fire. */
  load(): void {
    if (this.loadStarted || this.destroyed) return
    this.loadStarted = true
    void this.loadAll()
  }

  private async loadAll(): Promise<void> {
    const { frameCount } = this.manifest

    if (frameCount > FRAME_WARN_THRESHOLD) {
      const px = this.width * (this.width / this.manifest.aspectRatio)
      const mb = (px * 4 * frameCount) / 1024 / 1024
      console.warn(
        `[FrameSequence:${this.manifest.name}] ${frameCount} frames at ${this.width}px ` +
          `is roughly ${mb.toFixed(0)} MB decoded. Loading all of them anyway; ` +
          `consider trimming the sequence or adding a narrower width tier.`,
      )
    }

    // Frame 0 first: it is the poster the pinned section holds until ready.
    try {
      this.bitmaps[0] = await decodeFrame(this.frameUrl(0), this.controller.signal)
      this.loaded = 1
      this.dirty = true
      this.flush()
      this.events.onProgress?.(1 / frameCount)
    } catch (error) {
      if (!this.destroyed) this.fail(error)
      return
    }

    let cursor = 1
    const workers = Array.from({ length: Math.min(FETCH_CONCURRENCY, frameCount) }, async () => {
      while (cursor < frameCount && !this.destroyed) {
        const index = cursor++
        try {
          this.bitmaps[index] = await decodeFrame(this.frameUrl(index), this.controller.signal)
        } catch {
          // A single missing frame is survivable: draw() falls back to the
          // nearest loaded neighbour. Too many, and the sequence is dead.
          this.failedCount++
        }
        this.loaded++
        this.events.onProgress?.(this.loaded / frameCount)
      }
    })

    await Promise.all(workers)
    if (this.destroyed) return

    if (this.failedCount > frameCount * FAILURE_RATIO) {
      this.fail(new Error(`${this.failedCount}/${frameCount} frames failed to load`))
      return
    }

    this.ready = true
    this.events.onReady?.(this)
  }

  private fail(error: unknown): void {
    // Log once, never throw into the render tree.
    console.error(`[FrameSequence:${this.manifest.name}] unavailable —`, error)
    this.events.onFail?.(error instanceof Error ? error : new Error(String(error)))
  }

  private frameUrl(index: number): string {
    return framePath(this.manifest, this.width, index, this.format)
  }

  /** Nearest loaded frame, so a gap in the sequence never blanks the canvas. */
  private resolveBitmap(index: number): ImageBitmap | undefined {
    if (this.bitmaps[index]) return this.bitmaps[index]
    for (let d = 1; d < this.manifest.frameCount; d++) {
      if (this.bitmaps[index - d]) return this.bitmaps[index - d]
      if (this.bitmaps[index + d]) return this.bitmaps[index + d]
    }
    return undefined
  }

  /**
   * Queue a frame. Called from the scrub's onUpdate; the actual paint happens
   * in flush(), which the caller runs from the GSAP ticker.
   */
  requestFrame(frame: number): void {
    const index = Math.max(0, Math.min(this.manifest.frameCount - 1, Math.round(frame)))
    if (index === this.pendingIndex) return
    this.pendingIndex = index
    this.dirty = true
  }

  /** Paint if the integer frame index actually changed. Cheap to call per tick. */
  flush(): void {
    if (this.destroyed) return
    if (!this.dirty && this.pendingIndex === this.lastDrawnIndex) return
    const bitmap = this.resolveBitmap(this.pendingIndex)
    if (!bitmap) return

    const { x, y, width, height } = this.box
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.drawImage(bitmap, x, y, width, height)
    this.lastDrawnIndex = this.pendingIndex
    this.dirty = false
  }

  /** Backing store follows the element, capped at DPR 2. Contain math follows the manifest. */
  resize(): void {
    if (this.destroyed) return
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
    const cssWidth = this.canvas.clientWidth || 1
    const cssHeight = this.canvas.clientHeight || 1
    const backingWidth = Math.round(cssWidth * dpr)
    const backingHeight = Math.round(cssHeight * dpr)

    if (this.canvas.width !== backingWidth || this.canvas.height !== backingHeight) {
      this.canvas.width = backingWidth
      this.canvas.height = backingHeight
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // contain: fit the manifest aspect ratio inside the element box.
    const ar = this.manifest.aspectRatio
    let width = cssWidth
    let height = cssWidth / ar
    if (height > cssHeight) {
      height = cssHeight
      width = cssHeight * ar
    }
    this.box = { x: (cssWidth - width) / 2, y: (cssHeight - height) / 2, width, height }

    this.dirty = true
    this.flush()
  }

  /** The drawn image box in CSS pixels — annotations anchor against this. */
  getImageBox(): ImageBox {
    return this.box
  }

  get currentIndex(): number {
    return this.lastDrawnIndex < 0 ? 0 : this.lastDrawnIndex
  }

  destroy(): void {
    this.destroyed = true
    this.controller.abort()
    for (const bitmap of this.bitmaps) bitmap?.close()
    this.bitmaps = []
  }
}

/**
 * One matchMedia read at init decides the tier for the whole session: the
 * narrow tier on phones, the wide tier everywhere else. Deliberately not
 * reactive — re-decoding a whole sequence on a resize would cost far more
 * than the sharpness it buys.
 */
export function pickWidthTier(widths: number[]): number {
  const sorted = [...widths].sort((a, b) => a - b)
  const wantsWide =
    typeof window !== 'undefined' &&
    window.matchMedia('(min-width: 768px)').matches &&
    (window.devicePixelRatio || 1) * window.innerWidth > 900
  return wantsWide ? sorted[sorted.length - 1] : sorted[0]
}
