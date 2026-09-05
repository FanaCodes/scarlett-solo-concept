# Harbour Two — product page

A scroll-driven marketing page for a desktop audio interface. The signature mechanic is a
pre-rendered image sequence scrubbed by scroll: a pinned canvas plays frames forward and backward
under scroll control, with annotations latching onto specific frame indices.

There is no 3D runtime on this page. Nothing loads three.js, R3F or a GLB loader. The sequences are
ordinary images, decoded once and drawn to a 2D canvas.

- Design plan, written before the components and revised against the brief: [DESIGN.md](DESIGN.md)
- All copy, specs and annotation data: [`src/content/product.ts`](src/content/product.ts)

---

## Local development

```bash
npm install
npm run dev
```

The repository ships with **placeholder frame sequences already generated** in `public/frames`, so
`npm run dev` gives a working page immediately.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Type-check only |
| `npm run frames:placeholder` | Regenerate both placeholder sequences |
| `npm run frames:prepare -- --in <dir> --name <name>` | Convert a directory of real renders |

Stack: Vite, React, TypeScript, Tailwind CSS v4, GSAP with ScrollTrigger, Lenis.

---

## Render spec — what the artist must deliver

Two sequences. Replace the placeholders with these and the page needs no code change.

**`turntable` — 120 frames.** One full rotation about the Y axis, 3° per frame, frame 0 facing the
camera straight on. Camera locked for the whole sequence.

**`exploded` — 60 frames.** Components separating along the Z axis, from fully assembled at frame 0
to fully exploded at frame 59. Camera locked for the whole sequence.

Both sequences:

- **Transparent background** (alpha). The page ground shows through; there is no backplate.
- **50 mm-equivalent lens**, camera locked. No camera drift, no per-frame lighting changes, no
  animated exposure — every frame must differ only by the rotation or the separation.
- **Identical resolution and framing** across every frame in a sequence. If the subject grows or
  shifts between frames, the scrub will read as jitter.
- **PNG with alpha, at least 2400 px on the long edge.**
- **Sequentially named** so a natural sort gives the playback order (`turntable_0000.png`,
  `turntable_0001.png`, …).

Deliver each sequence as its own directory of PNGs.

---

## Swapping placeholders for real renders

One command per sequence. No component code is touched.

```bash
npm run frames:prepare -- --in /path/to/renders/turntable --out public/frames --name turntable
npm run frames:prepare -- --in /path/to/renders/exploded  --out public/frames --name exploded
```

`prepare-frames.mjs` writes, per sequence:

- AVIF at quality 55 and WebP at quality 80, at widths 1920 and 900
- zero-padded sequential filenames, `turntable_1920_0000.avif`
- a `manifest.json`

If the frame count changes, nothing else needs updating — the runtime reads it from the manifest.
The two places that are deliberately hand-authored against frame indices are the annotation
`enterFrame` / `exitFrame` / `anchor` values and each sequence's `keyFrames`, both in
`src/content/product.ts`. Re-tune those once the real renders land; the anchors are normalised to
the drawn image box, so they hold at any canvas size but they do assume the placeholder geometry.

### The manifest contract

The manifest is the only place a sequence describes itself. No component, hook or stylesheet
hardcodes a frame path, a frame count, a width tier or an aspect ratio.

```json
{
  "name": "turntable",
  "frameCount": 120,
  "widths": [900, 1920],
  "formats": ["avif", "webp"],
  "pathPattern": "/frames/{name}/{name}_{width}_{index}.{format}",
  "aspectRatio": 1.5,
  "hasAlpha": true
}
```

### Placeholders

`scripts/make-placeholder-frames.mjs` draws a stand-in for the unit — rounded chassis, two knobs
with tick collars, a row of jack circles, a small display — rotating on Y, on a transparent
ground, with the frame number burned into the corner so scrub accuracy is checkable by eye. It
writes PNGs and then pushes them through `prepare-frames.mjs`, so the placeholder path and the
production path are identical.

```bash
npm run frames:placeholder            # regenerate both sequences
node scripts/make-placeholder-frames.mjs --png-only --keep-png   # drawing only, for inspection
```

### The source model

`model/FocusriteSolo.glb` is the source geometry the renders come from. It is git-ignored, is not
served, and is never loaded by the page. Nothing in `src/` imports it.

---

## How the frame engine works

`src/lib/FrameSequence.ts` plus `src/components/FrameSequenceCanvas.tsx`.

- **Width tier** is chosen once at init from `matchMedia`: the narrow tier on phones, the wide tier
  elsewhere. It is deliberately not reactive — re-decoding a sequence on resize would cost more
  than the sharpness it buys.
- **Format** is chosen by decoding a 2×2 AVIF through `createImageBitmap`, the same path the frames
  take, falling back to WebP.
- **Loading** fetches every frame and decodes it with `createImageBitmap` into an indexed array,
  six at a time, reporting progress. Frame 0 lands first and is drawn immediately. Nothing
  constructs an `Image` in a scroll handler.
- **When** loading starts is gated twice: the hero still must have painted, and the act must be
  within 1.5 viewports of the viewport. The largest paint on the page never queues behind
  megabytes of frames.
- **Drawing** happens only inside the GSAP ticker. The scrub animates a proxy object, rounds it,
  and requests a frame; the ticker paints only when the integer index actually changed. The canvas
  backing store is `clientWidth × devicePixelRatio` capped at DPR 2, and the frame is drawn with
  contain math against the manifest's `aspectRatio`.
- **Gating**: the section pins from the start, so the page height never jumps, but it does not
  scrub until every frame is decoded. Until then a determinate progress rule sits under the frame
  and the first frame is held.
- **Failure**: if the sequence cannot load, the failure is logged once, the pin is released so the
  page scrolls normally, and the section falls back to a single static frame with every annotation
  visible as text. Nothing throws into the render tree. A handful of individually missing frames is
  survivable — the engine draws the nearest loaded neighbour.
- **Memory**: above 180 frames the engine logs the estimated decoded footprint and loads them all
  anyway, so the cost is visible rather than silently paid.

## Accessibility

- The canvas is `aria-hidden`. The annotations are the content: real DOM text, selectable,
  translatable, and always present in the accessibility tree rather than mounted and unmounted as
  frames pass.
- Under `prefers-reduced-motion: reduce` there is no pin, no scrub and no Lenis. Each act renders
  three or four key frames as static images in normal document flow with every annotation
  permanently visible.
- Keyboard: a skip link, a visible focus ring on everything focusable, and section links in the
  index rail carrying their titles for screen readers.
- Specifications are a real table with row headers, not a grid of divs.

## Performance notes

- Frames are AVIF first. At 1920 the 120-frame turntable is about 2.1 MB in total; the 900 tier
  used on phones is about 1.3 MB.
- The hero is a single `<picture>` with `fetchpriority="high"`, served from the same manifest, and
  never waits on a sequence.
- Motion beyond the two scrub acts is close to zero by design, so there is nothing else competing
  for the main thread while scrubbing.
