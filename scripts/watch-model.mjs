#!/usr/bin/env node
/**
 * watch-model.mjs — re-render the sequences whenever the model changes.
 *
 *   npm run frames:watch
 *
 * Leave it running in a second terminal beside `npm run dev`. Save a new GLB
 * over model/FocusriteSolo.glb and the frames rebuild on their own; refresh
 * the page and the change is there.
 *
 * It is not part of `npm run dev` on purpose. A full render is twenty seconds
 * of GPU plus a couple of minutes of AVIF encoding across every core, which is
 * not something to trigger by accident while you are working on the page.
 */

import { watch } from 'node:fs'
import { stat } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

const MODEL_DIR = 'model'
const MODEL_PATTERN = /\.(glb|gltf)$/i
/** Blender writes a large GLB progressively; wait for the size to settle. */
const SETTLE_MS = 1200
const SETTLE_CHECKS = 2

let running = false
let queued = false

function log(message) {
  const time = new Date().toLocaleTimeString()
  console.log(`[${time}] ${message}`)
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Resolves once the file has stopped growing, so we never render a half-written GLB. */
async function settled(file) {
  let last = -1
  let stable = 0
  for (let attempt = 0; attempt < 60; attempt++) {
    await wait(SETTLE_MS)
    let size
    try {
      size = (await stat(file)).size
    } catch {
      return false
    }
    stable = size === last ? stable + 1 : 0
    last = size
    if (stable >= SETTLE_CHECKS) return true
  }
  return false
}

function render() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/render-frames.mjs'], { stdio: 'inherit' })
    child.on('close', (code) => resolve(code))
  })
}

async function run(file) {
  if (running) {
    queued = true
    return
  }
  running = true
  try {
    log(`${file} changed, waiting for the write to finish…`)
    if (!(await settled(file))) {
      log('file never settled, skipping this change')
      return
    }
    log('rendering')
    const code = await render()
    log(code === 0 ? 'done — refresh the page' : `render exited with code ${code}`)
  } finally {
    running = false
    if (queued) {
      queued = false
      void run(file)
    }
  }
}

log(`watching ${path.resolve(MODEL_DIR)} for model changes — ctrl+c to stop`)
watch(MODEL_DIR, (_event, filename) => {
  if (!filename || !MODEL_PATTERN.test(filename)) return
  void run(path.join(MODEL_DIR, filename))
})
