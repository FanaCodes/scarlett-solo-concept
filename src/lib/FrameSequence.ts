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
  /**
   * Optional cache key, bumped every time the sequence is prepared. Frame
   * filenames do not change between renders, so this is what stops a returning
   * visitor from scrubbing last week's frames.
   */
  version?: string
  /**
   * Optional. Written when the sequence was rendered from the source model, so
   * annotations can track named components instead of a fixed point.
   */
  anchorsPath?: string
}

export type FrameSequenceEvents = {
  /** 0..1, fired as frames land. */
  onProgress?: (progress: number) => void
  /** Fired once enough frames are decoded that the act can be scrubbed. */
  onUsable?: () => void
  /** Fired once every frame has been decoded (or given up on). */
  onReady?: (seq: FrameSequence) => void
  /** Fired once if the sequence cannot be used at all. */
  onFail?: (reason: Error) => void
}

/** The drawn image box in CSS pixels, for positioning annotations. */
export type ImageBox = { x: number; y: number; width: number; height: number }

const DPR_CAP = 2
const FETCH_CONCURRENCY = 6
/**
 * Share of a sequence that must be decoded before it can be scrubbed at all.
 * Waiting for every frame meant that on a slow connection the reader crossed
 * the whole act while it held frame 0, then it snapped to wherever they had
 * scrolled. Scrubbing a partly-loaded sequence degrades honestly instead: the
 * frames that exist play, and draw() holds the nearest loaded neighbour until
 * the rest arrive.
 */
const USABLE_FRACTION = 0.15
const USABLE_MINIMUM = 8

/**
 * The order frames are fetched in: coarse first, then refining.
 *
 * Fetching 0,1,2,3... means a part-loaded sequence only covers its beginning,
 * so an act entered early scrubs for a moment and then sticks. Halving the
 * stride each pass spreads the first arrivals across the whole sequence, so
 * once the usable threshold is met the entire act can be scrubbed — coarsely
 * at first, then filling in. draw() holds the nearest loaded neighbour, so the
 * refinement is invisible apart from the motion getting smoother.
 */
/**
 * The three acts all become visible within a couple of viewports of each other,
 * so without this they download at once and split a slow connection three ways
 * — none of them reaching a scrubbable state before the reader arrives. Only
 * the opening phase of each sequence is serialised, in the order the acts were
 * started, which is page order. Once an act can be scrubbed it releases the
 * queue and fills in the rest alongside everyone else.
 */
let openingPhase: Promise<unknown> = Promise.resolve()
let openingPending = 0

function queueOpeningPhase<T>(run: () => Promise<T>): Promise<T> {
  openingPending++
  const result = openingPhase.then(run, run)
  openingPhase = result.catch(() => undefined).finally(() => {
    openingPending--
  })
  return result
}

/**
 * Refining passes yield to any opening phase still outstanding, including one
 * queued after they started. Without this the last act on the page was starved:
 * its opening competed with the full-width passes of the two acts above it, and
 * over a real connection it had barely begun by the time the reader arrived.
 * Openings are small and short, so letting them cut in costs the refine almost
 * nothing.
 */
function openingsOutstanding(): Promise<unknown> | null {
  return openingPending > 0 ? openingPhase : null
}

export function loadOrder(count: number): number[] {
  const order: number[] = []
  const seen = new Set<number>()
  const take = (index: number) => {
    if (index < count && !seen.has(index)) {
      seen.add(index)
      order.push(index)
    }
  }
  take(0)
  take(count - 1)
  for (let stride = 1 << Math.max(0, Math.floor(Math.log2(count))); stride >= 1; stride >>= 1) {
    for (let i = stride; i < count; i += stride) take(i)
  }
  return order
}
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
  const path = manifest.pathPattern
    .replaceAll('{name}', manifest.name)
    .replaceAll('{width}', String(width))
    .replaceAll('{index}', String(index).padStart(pad, '0'))
    .replaceAll('{format}', format)
  return manifest.version ? `${path}?v=${manifest.version}` : path
}

/**
 * Fetch and validate a sequence manifest. The only entry point for one.
 *
 * Deliberately not force-cached: the manifest is the one file that changes
 * when a sequence is re-rendered, so it has to obey normal revalidation. The
 * frames themselves are safe to force-cache — their names change with content.
 */
export async function loadManifest(manifestUrl: string): Promise<FrameManifest> {
  // High priority because layout waits on it: a still cannot reserve its box
  // until the aspect ratio is known, and behind six in-flight frame requests
  // this 300-byte file was arriving eight seconds late.
  const response = await fetch(manifestUrl, { priority: 'high' } as RequestInit)
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
  /** Which width tier each decoded frame currently is, for the refine pass. */
  private bitmapWidth: number[]
  private width: number
  /** The tier the opening phase uses; equal to `width` when there is only one. */
  private readonly openingWidth: number
  private format: string
  private loaded = 0
  private lastDrawnIndex = -1
  private pendingIndex = 0
  private dirty = true
  private loadStarted = false
  private readonly usableAt: number
  private box: ImageBox = { x: 0, y: 0, width: 0, height: 0 }
  private destroyed = false

  /** Every frame decoded. Drives the loading rule. */
  ready = false
  /** Enough decoded to scrub against. Drives the scrub gate. */
  usable = false

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
    this.bitmapWidth = new Array(manifest.frameCount).fill(0)
    this.openingWidth = Math.min(...manifest.widths)
    this.usableAt = Math.min(
      manifest.frameCount,
      Math.max(USABLE_MINIMUM, Math.ceil(manifest.frameCount * USABLE_FRACTION)),
    )
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

  /** Fetch and decode a list of frame indices with a bounded worker pool. */
  /**
   * Fetch and decode a list of frame indices at one width tier, with a bounded
   * worker pool. A frame already held at this tier is skipped; one held at a
   * narrower tier is replaced and the old bitmap closed.
   */
  private async fetchFrames(indices: number[], width: number, yieldToOpenings = false): Promise<void> {
    const { frameCount } = this.manifest
    let cursor = 0
    const workers = Array.from(
      { length: Math.min(FETCH_CONCURRENCY, Math.max(1, indices.length)) },
      async () => {
        while (cursor < indices.length && !this.destroyed) {
          const index = indices[cursor++]
          if (this.bitmapWidth[index] >= width) continue
          if (yieldToOpenings) {
            const pending = openingsOutstanding()
            if (pending) await pending.catch(() => undefined)
            if (this.destroyed) return
          }
          let bitmap: ImageBitmap | undefined
          try {
            bitmap = await decodeFrame(this.frameUrl(index, width), this.controller.signal)
          } catch {
            // A single missing frame is survivable: draw() falls back to the
            // nearest loaded neighbour. Too many, and the sequence is dead.
            continue
          }
          if (this.destroyed) {
            bitmap.close()
            return
          }
          const previous = this.bitmaps[index]
          this.bitmaps[index] = bitmap
          this.bitmapWidth[index] = width
          if (previous) previous.close()
          else this.loaded++

          // Redraw when the frame on screen has just arrived or got sharper.
          if (index === 0 || index === this.lastDrawnIndex) {
            this.dirty = true
            this.flush()
          }
          if (!this.usable && this.loaded >= this.usableAt) {
            this.usable = true
            this.events.onUsable?.()
          }
          this.events.onProgress?.(this.loaded / frameCount)
        }
      },
    )
    await Promise.all(workers)
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

    // Coarse to fine, and the opening stretch is fetched at the narrowest tier
    // so the act becomes scrubbable in a fraction of the bytes. The full-width
    // pass then replaces those frames. draw() scales whatever bitmap it has
    // into the same box, so the only visible difference is that the first
    // moments of a slow load are softer.
    const order = loadOrder(frameCount)
    const opening = order.slice(0, this.usableAt)

    await queueOpeningPhase(() => this.fetchFrames(opening, this.openingWidth))
    if (this.destroyed) return
    if (!this.bitmaps[0]) {
      this.fail(new Error('frame 0 did not load'))
      return
    }
    await this.fetchFrames(order, this.width, true)
    if (this.destroyed) return

    const missing = this.bitmaps.reduce((count, bitmap) => count + (bitmap ? 0 : 1), 0)
    if (missing > frameCount * FAILURE_RATIO) {
      this.fail(new Error(`${missing}/${frameCount} frames failed to load`))
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

  private frameUrl(index: number, width: number): string {
    return framePath(this.manifest, width, index, this.format)
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
 * One read at init decides the tier for the whole session: the narrow tier on
 * phones, and also on a slow or metered connection, where the wide tier's extra
 * megabytes cost more than the sharpness is worth — a sequence that has not
 * arrived by the time you reach it is worth nothing at all. Deliberately not
 * reactive: re-decoding a whole sequence mid-scroll would cost far more than it
 * saves.
 */
type NetworkInformation = { effectiveType?: string; saveData?: boolean }

function prefersNarrowTier(): boolean {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection
  if (!connection) return false
  // Only the two signals that are actually trustworthy. `downlink` was tried
  // and dropped: it is a rounded estimate from recent history and reads about
  // 1.5 Mbps on a fresh page even on a fast desktop connection, which quietly
  // put every visitor on the narrow tier.
  if (connection.saveData) return true
  return /^(slow-2g|2g|3g)$/.test(connection.effectiveType ?? '')
}

export function pickWidthTier(widths: number[]): number {
  const sorted = [...widths].sort((a, b) => a - b)
  if (typeof window === 'undefined') return sorted[0]
  const wantsWide =
    window.matchMedia('(min-width: 768px)').matches &&
    (window.devicePixelRatio || 1) * window.innerWidth > 900 &&
    !prefersNarrowTier()
  return wantsWide ? sorted[sorted.length - 1] : sorted[0]
}
