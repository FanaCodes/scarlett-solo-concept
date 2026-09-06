#!/usr/bin/env node
/**
 * check-frames-fresh.mjs — warn when the rendered frames are older than the
 * model they came from.
 *
 * The page never reads the GLB: it reads the pre-rendered sequences in
 * public/frames. Editing the model therefore changes nothing on the page until
 * `npm run frames:render` has run, which is easy to forget and looks exactly
 * like a caching bug. This runs before dev and build and says so out loud.
 *
 * Warns, never fails — a stale sequence is still a working page.
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const MODEL_DIR = 'model'
const FRAME_DIR = 'public/frames'

async function newestModelMtime() {
  let entries
  try {
    entries = await readdir(MODEL_DIR)
  } catch {
    return null
  }
  let newest = null
  for (const entry of entries) {
    if (!/\.(glb|gltf)$/i.test(entry)) continue
    const { mtime } = await stat(path.join(MODEL_DIR, entry))
    if (!newest || mtime > newest.mtime) newest = { file: path.join(MODEL_DIR, entry), mtime }
  }
  return newest
}

async function renderedSequences() {
  let names
  try {
    names = await readdir(FRAME_DIR)
  } catch {
    return []
  }
  const sequences = []
  for (const name of names) {
    try {
      const manifest = JSON.parse(await readFile(path.join(FRAME_DIR, name, 'manifest.json'), 'utf8'))
      // `version` is Date.now().toString(36), stamped by prepare-frames.
      const rendered = manifest.version ? new Date(parseInt(manifest.version, 36)) : null
      if (rendered && !Number.isNaN(rendered.getTime())) sequences.push({ name, rendered })
    } catch {
      // Not a sequence directory, or a manifest from before versioning.
    }
  }
  return sequences
}

const model = await newestModelMtime()
const sequences = await renderedSequences()
if (!model || sequences.length === 0) process.exit(0)

const stale = sequences.filter((s) => s.rendered < model.mtime)
if (stale.length === 0) process.exit(0)

const line = '─'.repeat(72)
console.warn(`\n${line}`)
console.warn(`  ${model.file} was edited ${model.mtime.toLocaleString()}`)
console.warn(`  These sequences were rendered before that, so the page still shows the old model:`)
for (const s of stale) {
  console.warn(`    ${s.name.padEnd(12)} rendered ${s.rendered.toLocaleString()}`)
}
console.warn(`\n  The page never reads the GLB — it reads public/frames. To pick the change up:`)
console.warn(`    npm run frames:render`)
console.warn(`${line}\n`)
