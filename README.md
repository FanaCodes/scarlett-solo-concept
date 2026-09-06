# Harbour Two — product page

A scroll-driven marketing page for a desktop audio interface. The signature mechanic is a
pre-rendered image sequence scrubbed by scroll: a pinned canvas plays frames forward and backward
under scroll control, with annotations that latch onto named components of the model and follow
them as the unit turns.

**The page loads no 3D runtime.** Nothing under `src/` imports three.js, R3F or a GLB loader; the
sequences are ordinary images, decoded once and drawn to a 2D canvas. three.js and puppeteer-core
are devDependencies used by the offline render script only — the equivalent of the artist's
Blender step, kept in the repo so it is repeatable.

- Design plan, written before the components and revised twice: [DESIGN.md](DESIGN.md)
- All copy, specs and annotation data: [`src/content/product.ts`](src/content/product.ts)

---

## Local development

```bash
npm install
npm run dev
```

The repository ships with both frame sequences already rendered in `public/frames`, so
`npm run dev` gives a working page immediately.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Type-check only |
| `npm run frames:render` | Re-render every sequence from `model/FocusriteSolo.glb` |
| `npm run frames:check` | Report whether the rendered frames are older than the model |
| `npm run frames:placeholder` | Regenerate the procedural placeholder sequences instead |
| `npm run frames:prepare -- --in <dir> --name <name>` | Convert a directory of finished renders |
| `npm run fonts` | Re-subset the self-hosted Plex woff2 files after a copy change |

Stack: Vite, React, TypeScript, Tailwind CSS v4, GSAP with ScrollTrigger, Lenis.

---

## Rendering the sequences from the model

```bash
npm run frames:render                 # both sequences, 2400x1600
node scripts/render-frames.mjs --preview        # 8 frames each, half size, no conversion
node scripts/render-frames.mjs --only turntable
```

`scripts/render-frames.mjs` starts a local server, drives an **already installed** Chrome or Edge
headlessly (nothing is downloaded), rasterises the GLB with three.js, and posts each frame back to
disk. It then runs the frames through `prepare-frames.mjs`, the same conversion step a Blender
render would go through. Set `CHROME_PATH` if the browser is somewhere unusual. A full run is
about twenty seconds of rendering plus a couple of minutes of AVIF/WebP encoding.

Both sequences are camera-locked. The camera is fitted once, to the widest the sequence ever gets,
by projecting the model's bounds on every frame and converging on a distance — so the subject
fills the frame without a hint of drift between frames.

**What moves.** The turntable turns the unit a full 360° at 3° per frame, starting on a
three-quarter view so frame 0 is the strongest still for the hero. While it turns, the two gain
encoders, the monitor knob and the headphone control rotate on their own axes, and the 48 V, Air,
Inst and Direct buttons each depress and release once. The exploded sequence separates every
panel-mounted component along the model's depth axis, front controls forward and rear connectors
back, staggered so they come apart in order.

### `anchors.json`

The render step also records, for every named node in the GLB, where that node lands on every
frame in normalised image coordinates, and whether it was unoccluded:

```json
{ "name": "turntable", "frameCount": 120, "nodes": { "Output": { "p": [[0.63, 0.57], …], "v": [0, 1, …] } } }
```

That is what lets an annotation point at a component instead of a fixed spot on the canvas: the
leader line follows the part through the rotation. The `v` array is how each annotation's
`enterFrame` / `exitFrame` in `product.ts` was chosen — an annotation is only up while its
component is actually facing the camera. Anchors are optional; without them, annotations fall back
to their authored static `anchor`.

To re-derive the ranges after a camera change, read the visible runs out of the file:

```bash
node -e "const a=require('./public/frames/turntable/anchors.json');for(const[n,d]of Object.entries(a.nodes))console.log(n,d.v.join(''))"
```

### Editing the model

**The page never reads the GLB.** It reads the pre-rendered sequences in `public/frames`, which is
the whole point of the approach — no 3D runtime ships. So a change to the model shows up on the
page only after:

```bash
npm run frames:render
```

`npm run dev` and `npm run build` both run `frames:check` first, which compares the model's
modification time against the `version` stamped into each manifest and prints a warning when the
frames are older. It warns rather than fails: stale frames are still a working page.

### The source model

`model/FocusriteSolo.glb` is the render subject. It is git-ignored (30 MB), is never served, and is
never loaded by the page. Its 19 named nodes are the vocabulary the annotations are written
against: `Body`, `Out1`, `Out2`, `Output`, `HeadphoneAudio`, `HeadphoneInput`, `Input1`, `Input2`,
`L`, `R`, `USB`, `48V`, `Air`, `Inst`, `Direct`, `Legs`, `K`, `Icons`, `Icons2`.

---

## Render spec — if the sequences are produced in a 3D package instead

Deliver each sequence as its own directory of PNGs and run `prepare-frames.mjs` over it.

**`turntable` — 120 frames.** One full rotation about the Y axis, 3° per frame. Camera locked for
the whole sequence.

**`exploded` — 60 frames.** Components separating along the Z axis, from fully assembled at frame 0
to fully exploded at frame 59. Camera locked for the whole sequence.

Both sequences:

- **Transparent background** (alpha). The page ground shows through; there is no backplate.
- **50 mm-equivalent lens**, camera locked. No camera drift, no per-frame lighting changes, no
  animated exposure — every frame must differ only by the rotation or the separation.
- **Identical resolution and framing** across every frame in a sequence. If the subject grows or
  shifts between frames, the scrub reads as jitter.
- **PNG with alpha, at least 2400 px on the long edge.**
- **Sequentially named** so a natural sort gives the playback order (`turntable_0000.png`, …).

A sequence produced this way has no `anchors.json`, so annotations fall back to the static anchors
in `product.ts` and those need re-tuning by eye.

---

## Swapping sequences

One command per sequence. No component code is touched.

```bash
npm run frames:prepare -- --in /path/to/renders/turntable --out public/frames --name turntable
npm run frames:prepare -- --in /path/to/renders/exploded  --out public/frames --name exploded
```

`prepare-frames.mjs` writes, per sequence: AVIF at quality 55 and WebP at quality 80 at widths 1920
and 900, zero-padded filenames (`turntable_1920_0000.avif`), and a `manifest.json`.

If the frame count, aspect ratio or tier list changes, nothing else needs updating — the runtime
reads all of it from the manifest. The two things authored by hand against frame indices are each
annotation's `enterFrame` / `exitFrame` / `part` and each sequence's `keyFrames`, both in
`src/content/product.ts`.

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
  "hasAlpha": true,
  "version": "mfa1k2p9",
  "anchorsPath": "/frames/{name}/anchors.json"
}
```

`version` and `anchorsPath` are additions to the base contract. `version` is bumped on every
prepare and appended to every frame URL as `?v=`; frame filenames are stable across re-renders, so
without it a returning visitor keeps scrubbing the previous sequence out of their HTTP cache.
`anchorsPath` is present only when the sequence was rendered from the model.

### Placeholders

`scripts/make-placeholder-frames.mjs` is still here and still works: it draws a procedural stand-in
unit — rounded chassis, two knobs with tick collars, a row of jack circles, a small display —
rotating on Y, on a transparent ground, with the frame number burned into the corner so scrub
accuracy is checkable by eye. It exists so the frame engine can be built and verified with no model
at all, and it writes through the same conversion pipeline.

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
  within 1.5 viewports. The largest paint on the page never queues behind megabytes of frames.
- **Drawing** happens only inside the GSAP ticker. The scrub animates a proxy object, rounds it,
  and requests a frame; the ticker paints only when the integer index actually changed. The canvas
  backing store is `clientWidth × devicePixelRatio` capped at DPR 2, and the frame is drawn with
  contain math against the manifest's `aspectRatio`.
- **Annotations** are DOM text positioned with that same contain math, recomputed on resize. Their
  leader lines are rewritten from the ticker as the tracked component moves, so React re-renders
  only when the active annotation changes, not once per frame.
- **Gating**: the section pins from the start, so page height never jumps, but it does not scrub
  until every frame is decoded. Until then a determinate progress rule sits under the frame.
- **Failure**: if the sequence cannot load, it is logged once, the pin is released so the page
  scrolls normally, and the section falls back to a single static frame with every annotation
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

## Performance

Measured with Lighthouse 12.8 against `npm run preview`, on this machine:

| Profile | Score | FCP | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- |
| Desktop | **100** | 0.5 s | 0.6 s | 0 ms | 0 |
| Mobile, simulated slow 4G + 4× CPU | **94** | 2.0 s | 2.9 s | 10 ms | 0 |

Desktop clears the ≥ 90 target comfortably. **Mobile LCP is 2.9 s against the 2.5 s budget** — see
the note at the end.

What earns those numbers:

- **The hero still is preloaded from the HTML.** A Vite plugin reads the same manifest at build
  time and injects `<link rel="preload" as="image" imagesrcset=…>`, so the browser starts the
  largest paint immediately instead of waiting for JS to fetch the manifest and render an `<img>`.
  This alone took mobile LCP from 13.5 s to 3.5 s.
- **Sequences do not compete with it.** Frame decoding waits for the hero still to paint *and* for
  the act to be scrolled towards. Loading them at rest put 1.6 MB in front of the hero image.
- **GSAP, ScrollTrigger and Lenis are lazy.** They are 45 kB gzipped and nothing on the first
  screen needs them, so the acts and the smooth-scroll wiring load in their own chunks. The initial
  JS is 70 kB gzipped instead of 123 kB. The hero entrance is CSS keyframes for the same reason.
- **The hero still is never faded in.** Chrome will not nominate an element that is transparent
  when it first paints, so animating the LCP element cost the page its LCP entry entirely.
- **Fonts are self-hosted and subset** to the ~100 characters the page sets: 55 kB for four cuts
  instead of 161 kB of full latin subsets across a third-party origin.
- **The stylesheet is inlined** at build time; it is 4.7 kB gzipped and this is one page, so a
  separate request for it was a round trip spent for nothing.
- Frames are AVIF first. At 1920 the 120-frame turntable is about 3.4 MB; the 900 tier used on
  phones is about 1.7 MB. Neither is on the critical path.

**The remaining 0.4 s.** Mobile LCP is bounded by React: the hero `<img>` cannot paint until the
entry chunk has downloaded, parsed and rendered, which is ~0.9 s of the 2.9 s on a 4× throttled
CPU. Closing that gap means prerendering the markup — a `renderToStaticMarkup` build step and
`hydrateRoot` — which is a real change in how the page is built rather than a tuning pass, so it is
left as a deliberate, documented gap.
