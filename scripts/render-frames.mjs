#!/usr/bin/env node
/**
 * render-frames.mjs — render both sequences from the source GLB.
 *
 *   node scripts/render-frames.mjs                 # both sequences, full size
 *   node scripts/render-frames.mjs --preview       # 8 frames each, half size
 *   node scripts/render-frames.mjs --only turntable
 *
 * This is the render step, not part of the site. It drives headless Chrome
 * (an installed one — nothing is downloaded) with three.js to rasterise the
 * model, and writes:
 *
 *   scripts/.tmp-frames/<name>/*.png    transparent frames, then converted by
 *                                       prepare-frames.mjs and deleted
 *   public/frames/<name>/anchors.json   where every named part of the model
 *                                       lands on every frame, so annotations
 *                                       can point at real components
 *
 * Nothing under src/ imports three.js or reads the GLB; the page still loads
 * no 3D runtime at all.
 */

import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'
import { prepareFrames } from './prepare-frames.mjs'

const ROOT = process.cwd()
const TMP_DIR = path.join('scripts', '.tmp-frames')
const RENDER_DIR = path.join('scripts', 'render')

/** Matches the render spec in README.md. */
const SEQUENCES = [
  // A three-quarter view at frame 0, so the hero still is the strongest angle.
  { name: 'turntable', frameCount: 120, mode: 'turntable', elevation: 17, startAzimuth: -28 },
  { name: 'exploded', frameCount: 60, mode: 'exploded', azimuth: -34, elevation: 21 },
  // A still library, not a sequence: each frame has its own locked camera, so
  // the macro details can show angles the turntable never reaches.
  {
    name: 'stills',
    mode: 'stills',
    frameCount: 4,
    views: [
      { azimuth: -24, elevation: 14 }, // front three-quarter, the panel
      { azimuth: -6, elevation: 58 }, // from above, the control layout
      { azimuth: 156, elevation: 16 }, // rear three-quarter, the connectors
      { azimuth: 24, elevation: -52 }, // from underneath, the feet and label
    ],
  },
]

const FULL = { width: 2400, height: 1600 }
const PREVIEW = { width: 1200, height: 800 }

const CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)

function findChrome() {
  for (const candidate of CHROME_CANDIDATES) if (existsSync(candidate)) return candidate
  throw new Error(
    'No Chrome or Edge found. Set CHROME_PATH to a Chromium-based browser executable.',
  )
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
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

async function startServer({ modelPath, config, onFrame, onAnchors }) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')

    if (req.method === 'POST' && (url.pathname === '/frame' || url.pathname === '/anchors')) {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const body = Buffer.concat(chunks)
      try {
        if (url.pathname === '/frame') {
          await onFrame(url.searchParams.get('seq'), Number(url.searchParams.get('index')), body)
        } else {
          await onAnchors(url.searchParams.get('seq'), JSON.parse(body.toString('utf8')))
        }
        res.writeHead(204).end()
      } catch (error) {
        console.error(error)
        res.writeHead(500).end(String(error))
      }
      return
    }

    try {
      let file
      if (url.pathname === '/' || url.pathname === '/render.html') {
        file = path.join(RENDER_DIR, 'render.html')
      } else if (url.pathname === '/render.js') {
        file = path.join(RENDER_DIR, 'render.js')
      } else if (url.pathname === '/model.glb') {
        file = modelPath
      } else if (url.pathname === '/config.json') {
        res.writeHead(200, { 'content-type': MIME['.json'] }).end(JSON.stringify(config))
        return
      } else if (url.pathname.startsWith('/three/')) {
        // Serve the installed three.js so the render page needs no network.
        file = path.join(ROOT, 'node_modules', url.pathname.slice(1))
      } else if (url.pathname === '/favicon.ico') {
        res.writeHead(204).end()
        return
      } else {
        res.writeHead(404).end('not found')
        return
      }
      const data = await readFile(file)
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' })
      res.end(data)
    } catch {
      res.writeHead(404).end('not found')
    }
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return { server, port: server.address().port }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const preview = Boolean(args.preview)
  const modelPath = typeof args.model === 'string' ? args.model : 'model/FocusriteSolo.glb'
  const outDir = typeof args.out === 'string' ? args.out : 'public/frames'
  const only = typeof args.only === 'string' ? args.only.split(',') : null

  if (!existsSync(modelPath)) throw new Error(`Model not found: ${modelPath}`)

  const size = preview ? PREVIEW : FULL
  const sequences = SEQUENCES.filter((s) => !only || only.includes(s.name)).map((s) =>
    preview && s.mode !== 'stills' ? { ...s, frameCount: 8 } : s,
  )

  const pngRoot = preview ? path.join('scripts', '.preview') : TMP_DIR
  for (const sequence of sequences) {
    const dir = path.join(pngRoot, sequence.name)
    await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
  }

  const anchorsBySequence = new Map()
  const { server, port } = await startServer({
    modelPath,
    config: {
      ...size,
      // 50mm on full frame: 2 * atan(24 / (2 * 50)).
      lensFov: 26.99,
      cameraElevation: 17,
      // Fraction of the frame the subject fills at its widest.
      margin: 0.94,
      sequences,
    },
    onFrame: async (name, index, body) => {
      const file = path.join(pngRoot, name, `${name}_${String(index).padStart(4, '0')}.png`)
      await writeFile(file, body)
      if ((index + 1) % 10 === 0 || index === 0) {
        process.stdout.write(`\r  ${name}: ${index + 1} frames rendered`)
      }
    },
    onAnchors: async (name, payload) => {
      anchorsBySequence.set(name, payload)
      process.stdout.write(`\n  ${name}: anchors captured for ${Object.keys(payload.nodes).length} parts\n`)
    },
  })

  const executablePath = findChrome()
  console.log(`\nRendering from ${modelPath} at ${size.width}x${size.height}`)
  console.log(`  browser: ${executablePath}`)

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    protocolTimeout: 30 * 60 * 1000,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-angle=default',
      '--enable-unsafe-swiftshader',
      '--disable-features=Vulkan',
    ],
  })

  try {
    const page = await browser.newPage()
    page.on('console', (message) => {
      if (message.type() === 'error') console.error('  [page]', message.text())
    })
    page.on('pageerror', (error) => console.error('  [page]', error.message))
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' })

    const started = Date.now()
    await page.waitForFunction('window.__done === true', { timeout: 30 * 60 * 1000, polling: 2000 })
    const failure = await page.evaluate(() => window.__error)
    if (failure) throw new Error(`renderer failed:\n${failure}`)
    console.log(`\n  rendered in ${((Date.now() - started) / 1000).toFixed(0)}s`)
  } finally {
    await browser.close()
    server.close()
  }

  if (preview) {
    for (const [name, payload] of anchorsBySequence) {
      await writeFile(path.join(pngRoot, `${name}.anchors.json`), JSON.stringify(payload), 'utf8')
    }
    console.log(`\nPreview frames in ${pngRoot}. Nothing converted, nothing published.`)
    return
  }

  for (const sequence of sequences) {
    const inDir = path.join(pngRoot, sequence.name)
    const files = await readdir(inDir)
    if (files.length !== sequence.frameCount) {
      throw new Error(`${sequence.name}: expected ${sequence.frameCount} frames, got ${files.length}`)
    }

    const sequenceOut = path.join(outDir, sequence.name)
    await mkdir(sequenceOut, { recursive: true })
    const anchors = anchorsBySequence.get(sequence.name)
    if (anchors) {
      await writeFile(path.join(sequenceOut, 'anchors.json'), JSON.stringify(anchors) + '\n', 'utf8')
    }

    await prepareFrames({
      inDir,
      outDir,
      name: sequence.name,
      extraManifest: anchors ? { anchorsPath: '/frames/{name}/anchors.json' } : undefined,
    })
    await rm(inDir, { recursive: true, force: true })
  }

  console.log('\nSequences rendered from the model and converted. Reload the page.\n')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
