#!/usr/bin/env node
/**
 * make-placeholder-frames.mjs — procedural stand-in renders.
 *
 * The real renders do not exist yet, but the frame engine must be built and
 * verifiable now. This draws a recognisable stand-in for the H2 — rounded
 * rectangular chassis, two large knobs, a row of jack circles, a small display
 * panel — on a transparent background, with the frame number burned into the
 * corner so scrub accuracy is checkable by eye.
 *
 * Two sequences, matching the render spec in README.md:
 *   turntable  120 frames, one full Y rotation, 3 deg/frame, camera locked
 *   exploded    60 frames, layers separating along Z, camera locked
 *
 * PNGs land in scripts/.tmp-frames/<name>/ and are then pushed through
 * prepare-frames.mjs — the exact pipeline the real renders will use, so the
 * placeholder path and the production path are identical.
 *
 *   node scripts/make-placeholder-frames.mjs [--out public/frames] [--keep-png]
 */

import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { createCanvas } from '@napi-rs/canvas'
import { prepareFrames } from './prepare-frames.mjs'

// --- render setup ----------------------------------------------------------

const CANVAS = { width: 1920, height: 1280 } // aspectRatio 1.5
const ELEVATION = (27 * Math.PI) / 180 // camera pitch, locked for every frame
const FOCAL = 3.6 // weak perspective; keeps the read honest without distortion
const TMP_DIR = path.join('scripts', '.tmp-frames')

const INK = '#15171A'
const PANEL = {
  top: '#33383C',
  front: '#292D31',
  back: '#1D2023',
  side: '#22262A',
  bottom: '#15181A',
}
const SILK = 'rgba(226,228,224,0.85)'
const SILK_DIM = 'rgba(226,228,224,0.35)'

// --- tiny 3D ---------------------------------------------------------------

const rotY = ([x, y, z], t) => [x * Math.cos(t) + z * Math.sin(t), y, -x * Math.sin(t) + z * Math.cos(t)]

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k]

/**
 * Model space: x right, y up, z toward the viewer at theta = 0.
 * Returns normalised screen coords (y grows downward) plus view depth.
 */
function projectRaw(p, theta) {
  const [x, y, z] = rotY(p, theta)
  const sinE = Math.sin(ELEVATION)
  const cosE = Math.cos(ELEVATION)
  // Negative depth is nearer the camera; the painter sort runs far to near.
  const depth = -(y * sinE + z * cosE)
  const persp = FOCAL / (FOCAL + depth)
  return { x: x * persp, y: (-y * cosE + z * sinE) * persp, depth }
}

function makeProjector(theta, fit) {
  return (p) => {
    const r = projectRaw(p, theta)
    return { x: fit.cx + r.x * fit.scale, y: fit.cy + r.y * fit.scale, depth: r.depth }
  }
}

// --- geometry builders -----------------------------------------------------

/** Six faces of an axis-aligned box, vertices ordered around each face. */
function boxFaces(center, size) {
  const [cx, cy, cz] = center
  const [w, h, d] = size
  const x0 = cx - w / 2
  const x1 = cx + w / 2
  const y0 = cy - h / 2
  const y1 = cy + h / 2
  const z0 = cz - d / 2
  const z1 = cz + d / 2
  return [
    { id: 'top', pts: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]] },
    { id: 'bottom', pts: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] },
    { id: 'front', pts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] },
    { id: 'back', pts: [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]] },
    { id: 'left', pts: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]] },
    { id: 'right', pts: [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]] },
  ]
}

/** Sampled points of a circle lying on the plane spanned by u and v. */
function ring(center, radius, u, v, segments = 40) {
  const pts = []
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2
    pts.push(add(center, add(scale3(u, Math.cos(a) * radius), scale3(v, Math.sin(a) * radius))))
  }
  return pts
}

/** Outward normals, matching the face ids from boxFaces. */
const FACE_NORMALS = {
  top: [0, 1, 0],
  bottom: [0, -1, 0],
  front: [0, 0, 1],
  back: [0, 0, -1],
  left: [-1, 0, 0],
  right: [1, 0, 0],
}

/**
 * Back-face culling. The camera sits along [0, sinE, cosE]; a face is visible
 * when its rotated normal points that way. Culling a convex solid makes the
 * draw order within a part irrelevant, which averaged-depth sorting cannot
 * guarantee (a wide face can average farther than a feature sitting on it).
 */
function isFaceVisible(id, theta) {
  const [nx, ny, nz] = rotY(FACE_NORMALS[id], theta)
  void nx
  return ny * Math.sin(ELEVATION) + nz * Math.cos(ELEVATION) > 0.0001
}

const AXIS_X = [1, 0, 0]
const AXIS_Y = [0, 1, 0]
const AXIS_Z = [0, 0, 1]

// --- canvas helpers --------------------------------------------------------

function polygonPath(ctx, pts2, radius = 0) {
  ctx.beginPath()
  if (radius <= 0) {
    ctx.moveTo(pts2[0].x, pts2[0].y)
    for (let i = 1; i < pts2.length; i++) ctx.lineTo(pts2[i].x, pts2[i].y)
    ctx.closePath()
    return
  }
  const n = pts2.length
  for (let i = 0; i < n; i++) {
    const prev = pts2[(i - 1 + n) % n]
    const cur = pts2[i]
    const next = pts2[(i + 1) % n]
    const lenA = Math.hypot(cur.x - prev.x, cur.y - prev.y) || 1
    const lenB = Math.hypot(next.x - cur.x, next.y - cur.y) || 1
    const r = Math.min(radius, lenA / 2, lenB / 2)
    const a = { x: cur.x + ((prev.x - cur.x) / lenA) * r, y: cur.y + ((prev.y - cur.y) / lenA) * r }
    const b = { x: cur.x + ((next.x - cur.x) / lenB) * r, y: cur.y + ((next.y - cur.y) / lenB) * r }
    if (i === 0) ctx.moveTo(a.x, a.y)
    else ctx.lineTo(a.x, a.y)
    ctx.quadraticCurveTo(cur.x, cur.y, b.x, b.y)
  }
  ctx.closePath()
}

function fillPolygon(ctx, pts2, fill, { stroke, lineWidth = 2, radius = 0 } = {}) {
  polygonPath(ctx, pts2, radius)
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = lineWidth
    ctx.stroke()
  }
}

function strokeLine(ctx, a, b, color, width) {
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
}

// --- scene description -----------------------------------------------------

const CHASSIS = { w: 1.0, h: 0.24, d: 0.62 }
const KNOB_R = 0.115
const KNOB_H = 0.085

/**
 * A part is a box plus the features silkscreened onto its faces. Layers are
 * described in local space and offset per frame, which is what the exploded
 * sequence animates.
 */
function chassisPart(offset = [0, 0, 0], opts = {}) {
  return {
    kind: 'chassis',
    offset,
    size: [CHASSIS.w, CHASSIS.h, CHASSIS.d],
    center: [0, 0, 0],
    features: opts.features !== false,
    palette: PANEL,
  }
}

function slabPart(offset, center, size, palette, label) {
  return { kind: 'slab', offset, center, size, palette, label }
}

// --- primitive collection --------------------------------------------------

function collectPart(part, project, theta, out) {
  const off = part.offset ?? [0, 0, 0]
  const center = add(part.center, off)
  const faces = boxFaces(center, part.size)
  const [, h] = part.size

  // Parts are sorted against each other by their centre depth; everything
  // inside one part is sequenced explicitly by `order`.
  const partDepth = project(center).depth
  let order = 0
  const push = (draw) => out.push({ depth: partDepth, order: order++, draw })
  const topVisible = isFaceVisible('top', theta)
  const frontVisible = isFaceVisible('front', theta)

  for (const face of faces) {
    if (!isFaceVisible(face.id, theta)) continue
    const pts2 = face.pts.map(project)
    const fill =
      face.id === 'top'
        ? part.palette.top
        : face.id === 'front'
          ? part.palette.front
          : face.id === 'back'
            ? part.palette.back
            : face.id === 'bottom'
              ? part.palette.bottom
              : part.palette.side
    push((ctx) => fillPolygon(ctx, pts2, fill, { radius: part.kind === 'chassis' ? 18 : 4 }))
  }

  if (!part.features) return

  const topY = center[1] + h / 2 + 0.001
  const frontZ = center[2] + part.size[2] / 2 + 0.001

  // Silkscreen border on the top face.
  const inset = 0.03
  const border = [
    [center[0] - part.size[0] / 2 + inset, topY, center[2] - part.size[2] / 2 + inset],
    [center[0] + part.size[0] / 2 - inset, topY, center[2] - part.size[2] / 2 + inset],
    [center[0] + part.size[0] / 2 - inset, topY, center[2] + part.size[2] / 2 - inset],
    [center[0] - part.size[0] / 2 + inset, topY, center[2] + part.size[2] / 2 - inset],
  ].map(project)
  if (topVisible) push((ctx) => fillPolygon(ctx, border, null, { stroke: SILK_DIM, lineWidth: 2, radius: 14 }))

  // Two large knobs on the top face.
  for (const kx of topVisible ? [-0.3, 0.3] : []) {
    const base = [center[0] + kx, topY, center[2] - 0.02]
    const cap = [base[0], base[1] + KNOB_H, base[2]]

    // dB-style tick collar around the knob.
    const ticks = []
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5
      const dir = [Math.cos(a), 0, Math.sin(a)]
      ticks.push([
        add(base, scale3(dir, KNOB_R * 1.28)),
        add(base, scale3(dir, KNOB_R * (i % 5 === 0 ? 1.52 : 1.42))),
      ])
    }
    const tick2 = ticks.map(([a, b]) => [project(a), project(b)])
    push((ctx) => {
      for (const [a, b] of tick2) strokeLine(ctx, a, b, SILK_DIM, 2)
    })

    const baseRing = ring(base, KNOB_R, AXIS_X, AXIS_Z).map(project)
    const capRing = ring(cap, KNOB_R * 0.94, AXIS_X, AXIS_Z).map(project)
    push((ctx) => {
      // Skirt: base ring, the band between the two rings, then the cap.
      fillPolygon(ctx, baseRing, '#1A1D20')
      for (let i = 0; i < baseRing.length; i++) {
        const j = (i + 1) % baseRing.length
        fillPolygon(ctx, [baseRing[i], baseRing[j], capRing[j], capRing[i]], '#2E3337')
      }
      fillPolygon(ctx, capRing, '#3C4247', { stroke: '#4A5157', lineWidth: 2 })
    })

    // Pointer line on the cap: makes the rotation legible frame to frame.
    const pointerA = project(cap)
    const pointerB = project(add(cap, scale3([Math.cos(kx > 0 ? -0.6 : 0.4), 0, Math.sin(kx > 0 ? -0.6 : 0.4)], KNOB_R * 0.8)))
    push((ctx) => strokeLine(ctx, pointerA, pointerB, SILK, 3))
  }

  // Small display panel on the top face, between the knobs.
  const dw = 0.26
  const dd = 0.15
  const display = [
    [center[0] - dw / 2, topY, center[2] - dd / 2 - 0.02],
    [center[0] + dw / 2, topY, center[2] - dd / 2 - 0.02],
    [center[0] + dw / 2, topY, center[2] + dd / 2 - 0.02],
    [center[0] - dw / 2, topY, center[2] + dd / 2 - 0.02],
  ].map(project)
  if (topVisible) {
    push((ctx) => fillPolygon(ctx, display, '#0C1113', { stroke: '#3A4146', lineWidth: 2, radius: 6 }))
  }
  // Two readout bars inside the display.
  for (const [k, frac] of topVisible ? [[0, 0.34], [1, 0.66]] : []) {
    const zRow = center[2] - dd / 2 - 0.02 + dd * frac
    const a = project([center[0] - dw / 2 + 0.02, topY + 0.0005, zRow])
    const b = project([center[0] - dw / 2 + 0.02 + dw * (k === 0 ? 0.62 : 0.4), topY + 0.0005, zRow])
    push((ctx) => strokeLine(ctx, a, b, '#7FA9A0', 5))
  }

  // Row of jack circles on the front face.
  for (let i = 0; frontVisible && i < 4; i++) {
    const jx = center[0] - 0.33 + i * 0.22
    const jc = [jx, center[1] - 0.01, frontZ]
    const outer = ring(jc, 0.058, AXIS_X, AXIS_Y, 28).map(project)
    const inner = ring(jc, 0.03, AXIS_X, AXIS_Y, 28).map(project)
    push((ctx) => {
      fillPolygon(ctx, outer, '#191C1F', { stroke: SILK_DIM, lineWidth: 2 })
      fillPolygon(ctx, inner, '#05070880')
    })
  }
}

function drawScene(ctx, parts, theta, fit) {
  const project = makeProjector(theta, fit)
  const prims = []
  for (const part of parts) collectPart(part, project, theta, prims)
  // Parts far to near; within a part, the explicit order.
  prims.sort((a, b) => b.depth - a.depth || a.order - b.order)
  for (const p of prims) p.draw(ctx)
}

/** Every point a frame will touch, for the auto-fit pass. */
function scenePoints(parts, theta) {
  const pts = []
  const project = (p) => projectRaw(p, theta)
  for (const part of parts) {
    const center = add(part.center, part.offset ?? [0, 0, 0])
    const grow = part.features ? [0.06, KNOB_H * 2 + 0.06, 0.06] : [0, 0, 0]
    for (const f of boxFaces(center, [
      part.size[0] + grow[0],
      part.size[1] + grow[1],
      part.size[2] + grow[2],
    ])) {
      for (const p of f.pts) pts.push(project(p))
    }
  }
  return pts
}

function fitFrames(frames, margin = 0.86) {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const { parts, theta } of frames) {
    for (const p of scenePoints(parts, theta)) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    }
  }
  const scale = Math.min(
    (CANVAS.width * margin) / (maxX - minX),
    (CANVAS.height * margin) / (maxY - minY),
  )
  return {
    scale,
    cx: CANVAS.width / 2 - ((minX + maxX) / 2) * scale,
    cy: CANVAS.height / 2 - ((minY + maxY) / 2) * scale,
  }
}

// --- burned-in frame stamp -------------------------------------------------

function drawStamp(ctx, name, index, total) {
  const pad = 44
  ctx.save()
  ctx.font = '500 30px Consolas, "DejaVu Sans Mono", monospace'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  ctx.fillText(`${String(index).padStart(4, '0')} / ${String(total).padStart(4, '0')}`, pad, CANVAS.height - pad)
  ctx.font = '500 22px Consolas, "DejaVu Sans Mono", monospace'
  ctx.fillStyle = 'rgba(21,23,26,0.55)'
  ctx.fillText(`${name.toUpperCase()}  PLACEHOLDER`, pad, CANVAS.height - pad - 40)

  // Registration crosses, so any camera drift in a real render is obvious.
  ctx.strokeStyle = 'rgba(21,23,26,0.4)'
  ctx.lineWidth = 2
  for (const [x, y] of [
    [pad, pad],
    [CANVAS.width - pad, pad],
    [CANVAS.width - pad, CANVAS.height - pad],
  ]) {
    ctx.beginPath()
    ctx.moveTo(x - 12, y)
    ctx.lineTo(x + 12, y)
    ctx.moveTo(x, y - 12)
    ctx.lineTo(x, y + 12)
    ctx.stroke()
  }
  ctx.restore()
}

// --- sequences -------------------------------------------------------------

function turntableFrames(frameCount) {
  return Array.from({ length: frameCount }, (_, i) => ({
    theta: (i * 3 * Math.PI) / 180, // 3 degrees per frame, one full revolution
    parts: [chassisPart()],
  }))
}

const smoothstep = (t) => t * t * (3 - 2 * t)

function explodedFrames(frameCount) {
  const THETA = (-34 * Math.PI) / 180 // camera locked for the whole sequence
  const SPREAD = 0.58
  // Layers of the unit, bottom to top, separating along Z.
  const layers = [
    { y: -0.09, h: 0.06, inset: 0.0, k: -1.6, palette: { ...PANEL, top: '#26292C' }, features: false },
    { y: -0.02, h: 0.012, inset: 0.09, k: -0.5, palette: greenBoard(), features: false },
    { y: 0.03, h: 0.01, inset: 0.34, k: 0.5, palette: blueBoard(), features: false },
    { y: 0.095, h: 0.05, inset: 0.0, k: 1.6, palette: PANEL, features: true },
  ]
  return Array.from({ length: frameCount }, (_, i) => {
    const t = smoothstep(i / (frameCount - 1))
    return {
      theta: THETA,
      parts: layers.map((l) =>
        Object.assign(
          slabPart(
            [0, 0, l.k * SPREAD * t],
            [0, l.y, 0],
            [CHASSIS.w - l.inset, l.h, CHASSIS.d - l.inset * 0.62],
            l.palette,
          ),
          { features: l.features, kind: l.features ? 'chassis' : 'slab' },
        ),
      ),
    }
  })
}

const greenBoard = () => ({
  top: '#2C4A38',
  front: '#22392B',
  back: '#1B2E23',
  side: '#22392B',
  bottom: '#1B2E23',
})
const blueBoard = () => ({
  top: '#26405C',
  front: '#1D3247',
  back: '#17293A',
  side: '#1D3247',
  bottom: '#17293A',
})

// --- driver ----------------------------------------------------------------

async function renderSequence(name, frames) {
  const dir = path.join(TMP_DIR, name)
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })

  const fit = fitFrames(frames)
  const canvas = createCanvas(CANVAS.width, CANVAS.height)
  const ctx = canvas.getContext('2d')

  for (let i = 0; i < frames.length; i++) {
    ctx.clearRect(0, 0, CANVAS.width, CANVAS.height) // transparent background
    drawScene(ctx, frames[i].parts, frames[i].theta, fit)
    drawStamp(ctx, name, i, frames.length - 1)
    await writeFile(path.join(dir, `${name}_${String(i).padStart(4, '0')}.png`), canvas.toBuffer('image/png'))
    if ((i + 1) % 20 === 0 || i === frames.length - 1) {
      process.stdout.write(`\r  drew ${i + 1}/${frames.length} placeholder PNGs`)
    }
  }
  process.stdout.write('\n')
  return dir
}

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue
    const key = argv[i].slice(2)
    args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const outDir = typeof args.out === 'string' ? args.out : 'public/frames'

  const sequences = [
    { name: 'turntable', frames: turntableFrames(120) },
    { name: 'exploded', frames: explodedFrames(60) },
  ]

  for (const seq of sequences) {
    console.log(`\n${seq.name}: drawing ${seq.frames.length} frames at ${CANVAS.width}x${CANVAS.height}`)
    const pngDir = await renderSequence(seq.name, seq.frames)
    if (args['png-only']) continue // drawing smoke test, skip conversion
    // Same conversion pipeline the real renders go through.
    await prepareFrames({ inDir: pngDir, outDir, name: seq.name, quiet: false })
    if (!args['keep-png']) await rm(pngDir, { recursive: true, force: true })
  }

  console.log('\nPlaceholder sequences ready. Replace them by rendering the real')
  console.log('frames per README.md and running scripts/prepare-frames.mjs.\n')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
