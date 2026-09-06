/**
 * Offline frame renderer — runs inside headless Chrome, driven by
 * scripts/render-frames.mjs. Nothing here ships: the page under src/ never
 * loads three.js or the GLB. This is the render step an artist would do in
 * Blender, done in code so it is repeatable.
 *
 * Emits, per sequence:
 *   - one transparent PNG per frame, POSTed back to the driving server
 *   - anchors.json: where every named part of the model lands on every frame,
 *     in normalised image coordinates, plus whether it is actually visible.
 *     The page uses that to hang annotations off real parts.
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

const config = await (await fetch('/config.json')).json()
const { width, height, sequences, cameraElevation, lensFov, margin } = config

const canvas = document.createElement('canvas')
canvas.width = width
canvas.height = height
document.body.appendChild(canvas)

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
  preserveDrawingBuffer: true,
})
renderer.setPixelRatio(1)
renderer.setSize(width, height, false)
renderer.setClearAlpha(0)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.NeutralToneMapping
renderer.toneMappingExposure = 1.15

const scene = new THREE.Scene()
scene.background = null

// Studio lighting without an external HDRI: three's own room environment,
// prefiltered, plus one soft key so the panel edges read.
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
const key = new THREE.DirectionalLight(0xffffff, 1.6)
key.position.set(-2.4, 3.2, 3.0)
scene.add(key)
const fill = new THREE.DirectionalLight(0xffffff, 0.55)
fill.position.set(3.0, 1.2, -2.4)
scene.add(fill)

const gltf = await new GLTFLoader().loadAsync('/model.glb')
const model = gltf.scene

// Named top-level parts, which is what annotations are authored against.
const parts = new Map()
for (const child of model.children) if (child.name) parts.set(child.name, child)

const meshes = []
model.traverse((o) => {
  if (o.isMesh) {
    o.frustumCulled = false
    meshes.push(o)
  }
})

/** World-space bounding box of one node's geometry. */
function boxOf(object) {
  const box = new THREE.Box3()
  object.updateWorldMatrix(true, true)
  box.setFromObject(object, true)
  return box
}

const modelBox = boxOf(model)
const modelCenter = modelBox.getCenter(new THREE.Vector3())

// Rotate about a pivot at the model's centre so framing cannot drift.
const pivot = new THREE.Group()
scene.add(pivot)
pivot.add(model)
model.position.sub(modelCenter)

const camera = new THREE.PerspectiveCamera(lensFov, width / height, 0.1, 200)

function placeCamera(distance, elevationDeg, target) {
  const e = THREE.MathUtils.degToRad(elevationDeg)
  camera.position.set(
    target.x,
    target.y + distance * Math.sin(e),
    target.z + distance * Math.cos(e),
  )
  camera.lookAt(target)
  camera.updateMatrixWorld(true)
}

/**
 * Fit the camera to the widest the sequence ever gets, then lock it. Fitting a
 * bounding sphere wastes most of the frame on a wide flat object, so this fits
 * the actual projected extent instead and converges in a few passes.
 */
function fitCamera(cornersPerFrame, elevationDeg, startDistance, target) {
  let distance = startDistance
  for (let pass = 0; pass < 8; pass++) {
    placeCamera(distance, elevationDeg, target)
    let maxX = 0
    let maxY = 0
    const v = new THREE.Vector3()
    for (const corners of cornersPerFrame) {
      for (const corner of corners) {
        v.copy(corner).project(camera)
        maxX = Math.max(maxX, Math.abs(v.x))
        maxY = Math.max(maxY, Math.abs(v.y))
      }
    }
    const fill = Math.max(maxX, maxY) / margin
    if (Math.abs(fill - 1) < 0.002) break
    distance *= fill
  }
  placeCamera(distance, elevationDeg, target)
  return distance
}

// --- per-part animation ------------------------------------------------------

/** Original transforms, so every frame is built from the same starting point. */
const rest = new Map()
for (const [name, node] of parts) {
  rest.set(name, {
    position: node.position.clone(),
    quaternion: node.quaternion.clone(),
  })
}

function resetParts() {
  for (const [name, node] of parts) {
    const r = rest.get(name)
    node.position.copy(r.position)
    node.quaternion.copy(r.quaternion)
  }
}

const easeInOut = (t) => t * t * (3 - 2 * t)

/**
 * Knobs turn as the unit turns. Each knob is a cylinder in its own local
 * space; `axis` names the local axis it spins about.
 */
const KNOBS = [
  { name: 'Out1', axis: 'z', turn: 130 },
  { name: 'Out2', axis: 'z', turn: -95 },
  { name: 'Output', axis: 'y', turn: 165 },
  { name: 'HeadphoneAudio', axis: 'y', turn: 70 },
]

/** A short press and release, so the buttons are not dead geometry. */
const BUTTONS = [
  { name: '48V', at: 0.18 },
  { name: 'Air', at: 0.34 },
  { name: 'Inst', at: 0.52 },
  { name: 'Direct', at: 0.7 },
]
const PRESS_DEPTH = 0.055
const PRESS_WIDTH = 0.06

function applyTurntableMotion(t) {
  for (const knob of KNOBS) {
    const node = parts.get(knob.name)
    if (!node) continue
    const angle = THREE.MathUtils.degToRad(knob.turn) * easeInOut(t)
    if (knob.axis === 'y') node.rotateY(angle)
    else node.rotateZ(angle)
  }
  for (const button of BUTTONS) {
    const node = parts.get(button.name)
    if (!node) continue
    const d = Math.abs(t - button.at)
    if (d > PRESS_WIDTH) continue
    const amount = Math.cos((d / PRESS_WIDTH) * Math.PI * 0.5) ** 2
    // Buttons face the panel along their own local Z.
    node.translateZ(-PRESS_DEPTH * amount)
  }
}

/**
 * Exploded view: only the parts that genuinely come off the unit — the four
 * knob caps and the four switch caps.
 *
 * Everything else stays put, deliberately:
 *
 *   Surface graphics (Icons, Icons2). Silkscreen is printed on the panel, not
 *   fitted to it. Floating it forward peeled the legends off the front.
 *
 *   Through-panel jack barrels (Input1, HeadphoneInput, L, R, Input2). Long
 *   thin cylinders that sit almost entirely inside the chassis, so pulling
 *   them read as rods skewering the panel.
 *
 *   The USB-C socket and the Kensington slot. One is soldered to the board,
 *   the other is a hole in the shell. Neither is a component you can take out.
 */
const EXPLODE = [
  // Knob caps first, then the switch caps behind them.
  { name: 'Output', k: 2.6 },
  { name: 'HeadphoneAudio', k: 2.6 },
  { name: 'Out1', k: 2.2 },
  { name: 'Out2', k: 2.2 },
  { name: '48V', k: 1.6 },
  { name: 'Air', k: 1.6 },
  { name: 'Inst', k: 1.6 },
  { name: 'Direct', k: 1.6 },
]
const EXPLODE_SPREAD = 1.05

function applyExplodedMotion(t) {
  const amount = easeInOut(t) * EXPLODE_SPREAD
  for (const item of EXPLODE) {
    const node = parts.get(item.name)
    if (!node) continue
    node.position.z += item.k * amount
  }
}

// --- anchors -----------------------------------------------------------------

const raycaster = new THREE.Raycaster()

function anchorFor(node) {
  const box = boxOf(node)
  const centre = box.getCenter(new THREE.Vector3())
  const projected = centre.clone().project(camera)
  const point = { x: (projected.x + 1) / 2, y: (1 - projected.y) / 2 }

  // Visible when nothing sits in front of the part's near surface. Testing
  // against the centroid alone would call every panel-mounted jack hidden,
  // because its centroid is inside the chassis.
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  const near = camera.position.distanceTo(centre) - sphere.radius
  const direction = centre.clone().sub(camera.position).normalize()
  raycaster.set(camera.position, direction)
  const hits = raycaster.intersectObjects(meshes, false)
  let visible = false
  if (hits.length) {
    let owner = hits[0].object
    while (owner.parent && owner.parent !== model) owner = owner.parent
    visible = owner === node || hits[0].distance >= near - 0.02
  }
  const inFrame = point.x > 0.02 && point.x < 0.98 && point.y > 0.02 && point.y < 0.98
  return { point, visible: visible && inFrame }
}

// --- sequence loop -----------------------------------------------------------

const round = (v) => Math.round(v * 1000) / 1000

async function renderSequence(spec) {
  const {
    name,
    frameCount,
    mode,
    azimuth = 0,
    startAzimuth = 0,
    elevation = cameraElevation,
    views = [],
  } = spec

  const poseFor = (t) => {
    resetParts()
    if (mode === 'turntable') applyTurntableMotion(t)
    else if (mode === 'exploded') applyExplodedMotion(t)
    pivot.rotation.y =
      mode === 'turntable'
        ? THREE.MathUtils.degToRad(startAzimuth) - t * Math.PI * 2
        : THREE.MathUtils.degToRad(azimuth)
    pivot.updateMatrixWorld(true)
  }

  /**
   * A still library rather than a sequence: each frame is its own locked
   * camera, so the page can show the unit from angles the turntable never
   * reaches — the underside, most of all. Nothing scrubs these.
   */
  const poseForStill = (index) => {
    const view = views[index]
    resetParts()
    pivot.rotation.y = THREE.MathUtils.degToRad(view.azimuth)
    pivot.updateMatrixWorld(true)
    const box = boxOf(model)
    const corners = []
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z))
      }
    }
    const target = box.getCenter(new THREE.Vector3())
    const radius = box.getSize(new THREE.Vector3()).length() / 2
    fitCamera(
      [corners],
      view.elevation,
      radius / Math.sin(THREE.MathUtils.degToRad(lensFov) / 2),
      target,
    )
  }

  if (mode === 'stills') {
    const anchors = {}
    for (const partName of parts.keys()) anchors[partName] = { p: [], v: [] }
    for (let i = 0; i < frameCount; i++) {
      poseForStill(i)
      renderer.render(scene, camera)
      for (const [partName, node] of parts) {
        const { point, visible } = anchorFor(node)
        anchors[partName].p.push([round(point.x), round(point.y)])
        anchors[partName].v.push(visible ? 1 : 0)
      }
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      await fetch(`/frame?seq=${encodeURIComponent(name)}&index=${i}`, { method: 'POST', body: blob })
      window.__progress = { sequence: name, frame: i + 1, total: frameCount }
    }
    await fetch(`/anchors?seq=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, frameCount, width, height, nodes: anchors }),
    })
    return
  }

  // Framing is decided once, from the widest the sequence ever gets, so the
  // camera is genuinely locked for every frame.
  const cornersPerFrame = []
  const union = new THREE.Box3()
  for (let i = 0; i < frameCount; i++) {
    poseFor(frameCount > 1 ? i / (frameCount - 1) : 0)
    const box = boxOf(model)
    union.union(box)
    const corners = []
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z))
      }
    }
    cornersPerFrame.push(corners)
  }
  // Aim at the centre of everything the sequence ever occupies, so an
  // asymmetric explode does not push the subject into one corner.
  const target = union.getCenter(new THREE.Vector3())
  const radius = union.getSize(new THREE.Vector3()).length() / 2
  const startDistance = radius / Math.sin(THREE.MathUtils.degToRad(lensFov) / 2)
  fitCamera(cornersPerFrame, elevation, startDistance, target)

  const anchors = {}
  for (const partName of parts.keys()) anchors[partName] = { p: [], v: [] }

  for (let i = 0; i < frameCount; i++) {
    poseFor(frameCount > 1 ? i / (frameCount - 1) : 0)
    renderer.render(scene, camera)

    for (const [partName, node] of parts) {
      const { point, visible } = anchorFor(node)
      anchors[partName].p.push([round(point.x), round(point.y)])
      anchors[partName].v.push(visible ? 1 : 0)
    }

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    await fetch(`/frame?seq=${encodeURIComponent(name)}&index=${i}`, {
      method: 'POST',
      body: blob,
    })
    window.__progress = { sequence: name, frame: i + 1, total: frameCount }
  }

  await fetch(`/anchors?seq=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, frameCount, width, height, nodes: anchors }),
  })
}

window.__progress = { sequence: null, frame: 0, total: 0 }
window.__done = false
window.__error = null

try {
  for (const spec of sequences) await renderSequence(spec)
  window.__done = true
} catch (error) {
  window.__error = String((error && error.stack) || error)
  window.__done = true
}
