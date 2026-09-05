#!/usr/bin/env node
/**
 * prepare-frames.mjs — turn a directory of source renders into the web frame
 * sequences the runtime consumes.
 *
 *   node scripts/prepare-frames.mjs --in <dir> --out public/frames --name turntable
 *
 * Produces, per sequence:
 *   <out>/<name>/<name>_<width>_<index>.avif   (quality 55)
 *   <out>/<name>/<name>_<width>_<index>.webp   (quality 80)
 *   <out>/<name>/manifest.json
 *
 * The manifest is the single source of truth for the runtime: frame count,
 * width tiers, formats, path pattern, aspect ratio and alpha. Nothing in the
 * app hardcodes any of it.
 *
 * Options:
 *   --in <dir>            source directory of PNG/TIFF renders (required)
 *   --out <dir>           output root, default public/frames
 *   --name <string>       sequence name, default = basename of --in
 *   --widths 900,1920     width tiers, default 900,1920
 *   --avif-quality 55     default 55
 *   --webp-quality 80     default 80
 *   --concurrency <n>     default = CPU count
 */

import { readdir, mkdir, rm, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

const DEFAULTS = {
  out: 'public/frames',
  widths: [900, 1920],
  avifQuality: 55,
  webpQuality: 80,
  concurrency: Math.max(2, Math.min(8, os.cpus().length)),
}

const SOURCE_EXTENSIONS = new Set(['.png', '.tif', '.tiff', '.exr', '.jpg', '.jpeg', '.webp'])
const INDEX_PAD = 4
export const PATH_PATTERN = '/frames/{name}/{name}_{width}_{index}.{format}'

/** Natural sort so frame_9 precedes frame_10. */
function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

export function frameFileName(name, width, index, format) {
  return `${name}_${width}_${String(index).padStart(INDEX_PAD, '0')}.${format}`
}

async function listSourceFrames(inDir) {
  const entries = await readdir(inDir, { withFileTypes: true })
  const files = entries
    .filter((e) => e.isFile() && SOURCE_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort(naturalCompare)
  if (files.length === 0) {
    throw new Error(`No source images found in ${inDir}`)
  }
  return files.map((f) => path.join(inDir, f))
}

/** Run tasks with a bounded worker pool; sharp is already threaded per task. */
async function pool(items, limit, worker) {
  let cursor = 0
  let done = 0
  const total = items.length
  const runners = Array.from({ length: Math.min(limit, total) }, async () => {
    while (cursor < total) {
      const i = cursor++
      await worker(items[i], i)
      done++
      if (done % 10 === 0 || done === total) {
        process.stdout.write(`\r  encoded ${done}/${total} frames`)
      }
    }
  })
  await Promise.all(runners)
  process.stdout.write('\n')
}

/** Remove previously generated output for this sequence, nothing else. */
async function cleanSequenceDir(dir, name) {
  let entries
  try {
    entries = await readdir(dir)
  } catch {
    return
  }
  const stale = entries.filter(
    (f) => f === 'manifest.json' || (f.startsWith(`${name}_`) && /_\d+_\d+\.(avif|webp)$/.test(f)),
  )
  await Promise.all(stale.map((f) => rm(path.join(dir, f), { force: true })))
}

export async function prepareFrames({
  inDir,
  outDir = DEFAULTS.out,
  name,
  widths = DEFAULTS.widths,
  avifQuality = DEFAULTS.avifQuality,
  webpQuality = DEFAULTS.webpQuality,
  concurrency = DEFAULTS.concurrency,
  quiet = false,
} = {}) {
  if (!inDir) throw new Error('prepareFrames: --in is required')
  const sequenceName = name || path.basename(path.resolve(inDir))
  const sortedWidths = [...widths].sort((a, b) => a - b)
  const sequenceDir = path.join(outDir, sequenceName)

  const sources = await listSourceFrames(inDir)
  const probe = await sharp(sources[0]).metadata()
  const sourceWidth = probe.width ?? 0
  const sourceHeight = probe.height ?? 0
  if (!sourceWidth || !sourceHeight) throw new Error(`Cannot read dimensions of ${sources[0]}`)

  const log = quiet ? () => {} : (...a) => console.log(...a)
  log(`\n${sequenceName}: ${sources.length} source frames at ${sourceWidth}x${sourceHeight}`)
  if (Math.max(sourceWidth, sourceHeight) < 2400 && !quiet) {
    console.warn(
      `  note: source long edge is ${Math.max(sourceWidth, sourceHeight)}px; ` +
        `final renders should be at least 2400px (see README, render spec).`,
    )
  }

  await mkdir(sequenceDir, { recursive: true })
  await cleanSequenceDir(sequenceDir, sequenceName)

  // One task per (frame, width): both formats share the decode and the resize.
  const tasks = []
  for (let i = 0; i < sources.length; i++) {
    for (const width of sortedWidths) tasks.push({ src: sources[i], index: i, width })
  }

  let sawAlpha = false
  await pool(tasks, concurrency, async ({ src, index, width }) => {
    const pipeline = sharp(src, { limitInputPixels: false })
    const meta = await pipeline.metadata()
    if (meta.hasAlpha) sawAlpha = true

    const resized = pipeline.clone().resize({
      width,
      fit: 'inside',
      withoutEnlargement: false,
      kernel: 'lanczos3',
    })

    await Promise.all([
      resized
        .clone()
        .avif({ quality: avifQuality, effort: 4, chromaSubsampling: '4:4:4' })
        .toFile(path.join(sequenceDir, frameFileName(sequenceName, width, index, 'avif'))),
      resized
        .clone()
        .webp({ quality: webpQuality, effort: 4, alphaQuality: 90 })
        .toFile(path.join(sequenceDir, frameFileName(sequenceName, width, index, 'webp'))),
    ])
  })

  const manifest = {
    name: sequenceName,
    frameCount: sources.length,
    widths: sortedWidths,
    formats: ['avif', 'webp'],
    pathPattern: PATH_PATTERN,
    aspectRatio: Number((sourceWidth / sourceHeight).toFixed(4)),
    hasAlpha: sawAlpha,
  }
  await writeFile(
    path.join(sequenceDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  )

  let bytes = 0
  for (const f of await readdir(sequenceDir)) {
    bytes += (await stat(path.join(sequenceDir, f))).size
  }
  log(
    `  wrote ${sources.length * sortedWidths.length * 2} files + manifest.json ` +
      `(${(bytes / 1024 / 1024).toFixed(1)} MB total) to ${sequenceDir}`,
  )

  return manifest
}

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
    args[key] = value
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.in) {
    console.error(
      'usage: node scripts/prepare-frames.mjs --in <dir> [--out public/frames] [--name <name>]',
    )
    process.exit(1)
  }
  await prepareFrames({
    inDir: args.in,
    outDir: args.out ?? DEFAULTS.out,
    name: args.name,
    widths: args.widths ? args.widths.split(',').map(Number) : DEFAULTS.widths,
    avifQuality: args['avif-quality'] ? Number(args['avif-quality']) : DEFAULTS.avifQuality,
    webpQuality: args['webp-quality'] ? Number(args['webp-quality']) : DEFAULTS.webpQuality,
    concurrency: args.concurrency ? Number(args.concurrency) : DEFAULTS.concurrency,
  })
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
