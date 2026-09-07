/**
 * Every word, number and annotation on the page comes from this file.
 * Components import from here and hold no copy of their own.
 *
 * This is an unofficial concept page for a real product. Nothing here is
 * Focusrite's copy and nothing here is Focusrite's published data — see
 * `specsNote` and the colophon, both of which say so on the page itself.
 *
 * Annotations are authored against the named components of the source model.
 * `part` is the node name in the GLB; the render step writes where that node
 * lands on every frame, and the leader line follows it. The frame ranges come
 * from the visibility data in the same file, so an annotation is only up while
 * its component is actually facing the camera.
 */

// --- types -----------------------------------------------------------------

export type Annotation = {
  id: string
  /** Frame index the annotation appears on. */
  enterFrame: number
  /** Frame index it disappears on. */
  exitFrame: number
  /**
   * Name of the component in the source model. When the sequence carries an
   * anchors file, the leader line tracks this part frame by frame; `anchor` is
   * the fallback for a sequence rendered without one.
   */
  part?: string
  /** 0-1, relative to the drawn image box, not the canvas element. */
  anchor: { x: number; y: number }
  title: string
  body: string
  /**
   * Optional measured figure, set in mono as a genuine readout
   * (DESIGN.md §3). Omit it rather than inventing one.
   */
  readout?: string
}

export type SpecRow = {
  label: string
  value: string
  /** Split out so the unit can sit in the secondary ink and the value stays tabular. */
  unit?: string
  note?: string
}

export type SpecGroup = {
  id: string
  title: string
  rows: SpecRow[]
}

export type MacroDetail = {
  id: string
  /** Stills are pulled from an existing sequence by frame index, through its manifest. */
  still: { sequence: string; frame: number }
  alt: string
  title: string
  body: string
  figure: { label: string; value: string }
}

export type SequenceSpec = {
  name: string
  manifestUrl: string
  heading: string
  intro: string
  /** Sits under the scrub scale, in the panel legend voice. */
  scaleLabel: string
  /** Scroll length of the pinned section, desktop and mobile. */
  scrollLength: { desktop: string; mobile: string }
  /** Frames held as static stacked images on the reduced-motion path. */
  keyFrames: number[]
}

// --- identity --------------------------------------------------------------

/**
 * Layout hint for the hero still. Shared with the build, which injects a
 * matching <link rel="preload"> so the largest paint is requested from the
 * HTML rather than after React has fetched the manifest.
 */
export const heroStillSizes = '(min-width: 1024px) 56rem, 92vw'

export const product = {
  maker: 'Focusrite',
  name: 'Scarlett Solo',
  type: 'SOLO',
  panelLegend: 'SCARLETT SOLO / 2 IN, 2 OUT',
  /** Sits opposite the maker in the hero. This page is not Focusrite's. */
  stamp: 'Unofficial concept',
  positioning:
    'One microphone input, one instrument input, two balanced outputs and a headphone amplifier, over a single USB-C cable that also powers it.',
  heroAlt: 'The Focusrite Scarlett Solo audio interface, seen from the front left.',
  scrollAffordance: 'Scroll to rotate',
} as const

// --- act I: turntable ------------------------------------------------------

export const turntable: SequenceSpec = {
  name: 'turntable',
  manifestUrl: '/frames/turntable/manifest.json',
  heading: 'One turn around the unit',
  intro:
    'A full rotation, held under your scroll. Six components are called out as they come round to face you.',
  scaleLabel: 'ROTATION / FRAME INDEX',
  scrollLength: { desktop: '+=300%', mobile: '+=200%' },
  keyFrames: [0, 30, 60, 90],
}

/**
 * Rear panel first (roughly frames 32-69 of the rotation), then the front
 * (79-119). Each range sits inside its component's visible window.
 */
export const turntableAnnotations: Annotation[] = [
  {
    id: 'usb',
    part: 'USB',
    enterFrame: 33,
    exitFrame: 44,
    anchor: { x: 0.463, y: 0.716 },
    title: 'One cable',
    body: 'A single USB-C connection carries audio in both directions and powers the unit. There is no separate supply to lose and nothing to install before it works.',
    readout: 'USB-C, bus powered',
  },
  {
    id: 'chassis',
    part: 'Body',
    enterFrame: 46,
    exitFrame: 57,
    anchor: { x: 0.499, y: 0.507 },
    title: 'Anodised aluminium shell',
    body: 'The body is a single anodised aluminium extrusion. It is the structure and the shield at once, which is why there is no seam down either side.',
    readout: 'Unibody, anodised',
  },
  {
    id: 'mic-input',
    part: 'Input2',
    enterFrame: 59,
    exitFrame: 68,
    anchor: { x: 0.531, y: 0.623 },
    title: 'Microphone input',
    body: 'The XLR input sits on the rear panel, so the one cable you rarely unplug stays behind the unit and out of the way of your hands.',
    readout: 'XLR, rear panel, 48 V',
  },
  {
    id: 'gain',
    part: 'Out1',
    enterFrame: 81,
    exitFrame: 92,
    anchor: { x: 0.617, y: 0.551 },
    title: 'Gain, with a halo',
    body: 'A ring around each gain control lights green as signal arrives, then amber and red as you approach clipping. You set a level by looking at the knob you are already holding.',
    readout: 'GREEN / AMBER / RED',
  },
  {
    id: 'monitor',
    part: 'Output',
    enterFrame: 94,
    exitFrame: 105,
    anchor: { x: 0.653, y: 0.553 },
    title: 'Monitor level',
    body: 'The largest control on the unit is the one you reach for most: a single big knob for speaker level, in the middle of the panel where you cannot miss it.',
    readout: 'Analogue, both outputs',
  },
  {
    id: 'headphones',
    part: 'HeadphoneAudio',
    enterFrame: 107,
    exitFrame: 119,
    anchor: { x: 0.731, y: 0.533 },
    title: 'Headphones, separately',
    body: 'The headphone output has its own level control beside its socket, so you can set what you hear without touching what the speakers are doing.',
    readout: 'Front panel, independent',
  },
]

// --- act II: exploded ------------------------------------------------------

export const exploded: SequenceSpec = {
  name: 'exploded',
  manifestUrl: '/frames/exploded/manifest.json',
  heading: 'Taken apart along its depth',
  intro:
    'The four knob caps drawn out along the axis they were fitted on. They are the only parts that come off; everything else is the shell.',
  scaleLabel: 'SEPARATION / FRAME INDEX',
  scrollLength: { desktop: '+=200%', mobile: '+=150%' },
  keyFrames: [0, 20, 40, 59],
}

export const explodedClaims: Annotation[] = [
  {
    id: 'discrete-controls',
    part: 'Out1',
    enterFrame: 6,
    exitFrame: 22,
    anchor: { x: 0.299, y: 0.423 },
    title: 'Four caps, and that is all',
    body: 'The knob caps are separate mouldings, each pressed onto its own shaft. Nothing else on the front comes away: the switches are moulded into the panel and the sockets are fixed through the shell.',
    readout: '4 knob caps',
  },
  {
    id: 'shell',
    part: 'Body',
    enterFrame: 24,
    exitFrame: 40,
    anchor: { x: 0.545, y: 0.434 },
    title: 'The rest is one piece',
    body: 'The sockets are fixed through the shell, the switches are part of the panel and the legends are printed onto it. Take the four caps off and what is left is a single machined body closed by two end panels.',
    readout: 'Aluminium, 2 end panels',
  },
  {
    id: 'front-face',
    part: 'Output',
    enterFrame: 42,
    exitFrame: 59,
    anchor: { x: 0.311, y: 0.679 },
    title: 'Everything you touch faces you',
    body: 'Every control, and both of the sockets you use daily, are on one face. Everything you connect once and forget is on the other.',
    readout: 'Front: 4 controls, 2 jacks',
  },
]

// --- act III: plugging in ---------------------------------------------------

export const plug: SequenceSpec = {
  name: 'plug',
  manifestUrl: '/frames/plug/manifest.json',
  heading: 'Plugging in',
  intro:
    'A quarter-inch jack going into the front socket, held under your scroll. The camera is close and locked; only the cable moves.',
  scaleLabel: 'INSERTION / FRAME INDEX',
  scrollLength: { desktop: '+=150%', mobile: '+=120%' },
  keyFrames: [0, 20, 36, 47],
}

export const plugAnnotations: Annotation[] = [
  {
    id: 'jack',
    part: 'Metal',
    enterFrame: 4,
    exitFrame: 20,
    anchor: { x: 0.393, y: 0.58 },
    title: 'A quarter-inch jack',
    body: 'The oldest connector still in daily use, and the reason a guitar can be plugged into a computer without an adapter in the way.',
    readout: '6.35 mm, tip and sleeve',
  },
  {
    id: 'socket',
    part: 'Input1',
    enterFrame: 23,
    exitFrame: 38,
    anchor: { x: 0.5, y: 0.5 },
    title: 'Straight into the shell',
    body: 'The socket is mounted through the front panel and fixed to the chassis, so the force of a plug going in lands on aluminium rather than on a solder joint.',
    readout: 'Panel mounted, front',
  },
  {
    id: 'inst',
    part: 'Inst',
    enterFrame: 41,
    exitFrame: 47,
    anchor: { x: 0.56, y: 0.551 },
    title: 'Then press Inst',
    body: 'Seated, the socket is still expecting a line signal. The switch beside it changes the input to instrument level, which is the step everyone forgets once.',
    readout: 'Inst: line / instrument',
  },
]

// --- macro details ---------------------------------------------------------

/** A still library rather than a scrubbed sequence: four locked cameras. */
export const stills = {
  name: 'stills',
  manifestUrl: '/frames/stills/manifest.json',
} as const

export const macroDetails: MacroDetail[] = [
  {
    id: 'panel',
    still: { sequence: 'stills', frame: 0 },
    alt: 'The front panel of the Scarlett Solo, with both gain halos, the monitor knob and the headphone control.',
    title: 'The panel says what it does',
    body: 'Every legend is set on the black panel in white: channel numbers, switch names, and the two sockets you reach for without looking.',
    figure: { label: 'Front controls', value: '4' },
  },
  {
    id: 'layout',
    still: { sequence: 'stills', frame: 1 },
    alt: 'The Scarlett Solo seen from above, showing the control layout and the maker mark on the lid.',
    title: 'Read from left to right',
    body: 'Inputs on the left, monitoring in the middle, headphones on the right. The layout follows the signal, so the panel doubles as a diagram of the unit.',
    figure: { label: 'Gain controls', value: '2' },
  },
  {
    id: 'connectors',
    still: { sequence: 'stills', frame: 2 },
    alt: 'The rear of the Scarlett Solo, showing the USB-C socket, the Kensington slot, the two line outputs and the XLR input.',
    title: 'Connectors bolted to the shell',
    body: 'Every socket is fixed to the chassis rather than hanging off the board, so a pulled cable loads the aluminium and not the solder.',
    figure: { label: 'Rear sockets', value: '4' },
  },
  {
    id: 'underside',
    still: { sequence: 'stills', frame: 3 },
    alt: 'The underside of the Scarlett Solo, showing four rubber feet and the compliance label.',
    title: 'Four feet and the small print',
    body: 'The base carries what nobody is meant to look at: four rubber feet to keep it still on a desk, and the compliance marks, kept off every surface you can see.',
    figure: { label: 'Feet', value: '4' },
  },
]

// --- specifications --------------------------------------------------------

// PLACEHOLDER SPECS — indicative figures for this design study, not Focusrite's
// published data. Rows that would need a measurement are left blank on purpose
// rather than guessed at; fill them from the official datasheet before this
// page is presented as anything other than a concept.
export const specGroups: SpecGroup[] = [
  {
    id: 'inputs',
    title: 'Inputs',
    rows: [
      { label: 'Microphone input', value: '1', note: 'XLR, rear panel' },
      { label: 'Instrument input', value: '1', note: '1/4 in TS, front panel' },
      { label: 'Phantom power', value: '48', unit: 'V', note: 'switched' },
      { label: 'Air mode', value: 'Yes', note: 'switched, microphone channel' },
      { label: 'Gain range', value: '—', unit: 'dB', note: 'from datasheet' },
      { label: 'Equivalent input noise', value: '—', unit: 'dBu', note: 'from datasheet' },
    ],
  },
  {
    id: 'conversion',
    title: 'Conversion',
    rows: [
      { label: 'Resolution', value: '24', unit: 'bit' },
      { label: 'Sample rates', value: '44.1–192', unit: 'kHz' },
      { label: 'Dynamic range', value: '—', unit: 'dB', note: 'A-weighted, from datasheet' },
      { label: 'THD+N', value: '—', unit: '%', note: 'from datasheet' },
      { label: 'Frequency response', value: '—', unit: 'Hz', note: 'from datasheet' },
    ],
  },
  {
    id: 'outputs',
    title: 'Outputs',
    rows: [
      { label: 'Line outputs', value: '2', note: 'balanced, 1/4 in TRS, rear' },
      { label: 'Headphone output', value: '1', note: '1/4 in TRS, front, own level' },
      { label: 'Direct monitor', value: 'Yes', note: 'switched, analogue' },
      { label: 'Maximum output level', value: '—', unit: 'dBu', note: 'from datasheet' },
    ],
  },
  {
    id: 'physical',
    title: 'Physical',
    rows: [
      { label: 'Connection', value: 'USB-C', note: 'bus powered, class compliant' },
      { label: 'Security slot', value: 'Yes', note: 'Kensington, rear' },
      { label: 'Chassis', value: 'Aluminium', note: 'anodised unibody' },
      { label: 'Feet', value: '4', note: 'rubber' },
      { label: 'Dimensions', value: '—', unit: 'mm', note: 'from datasheet' },
      { label: 'Weight', value: '—', unit: 'kg', note: 'from datasheet' },
    ],
  },
]

export const specsNote =
  'This is a concept page, not a datasheet. Measured figures are left blank rather than guessed at — take them from the manufacturer’s published specifications. The rows that are filled in describe what is visible on the unit itself.'

// --- colophon --------------------------------------------------------------

export const colophon = {
  intro:
    'A portfolio piece: an unofficial concept page for the Focusrite Scarlett Solo, built to work a scroll-scrubbed render sequence through end to end. It is not affiliated with, endorsed by, or produced for Focusrite, and none of the copy here is theirs.',
  credits: [
    { role: 'Subject', value: 'Focusrite Scarlett Solo, third generation' },
    { role: 'Modelling', value: 'Yannick — interface and instrument cable' },
    { role: 'Rendering', value: '232 frames, rendered offline from the source models' },
    { role: 'Design and build', value: 'Yannick, with Claude' },
    { role: 'Typefaces', value: 'IBM Plex Sans, IBM Plex Sans Condensed, IBM Plex Mono' },
  ],
  note: 'Focusrite and Scarlett are trademarks of Focusrite Audio Engineering Ltd, used here only to identify the product this study is about. Frame sequences are pre-rendered stills; no 3D runtime is loaded by this page.',
}

// --- section index (the datasheet rail) ------------------------------------

export type Section = {
  id: string
  /** Clause number in the rail. */
  clause: string
  title: string
  intro?: string
}

export const sections: Section[] = [
  { id: 'hero', clause: '0.0', title: 'Scarlett Solo' },
  { id: 'turntable', clause: '1.0', title: 'The unit' },
  { id: 'exploded', clause: '2.0', title: 'Inside' },
  { id: 'plug', clause: '3.0', title: 'Plugging in' },
  {
    id: 'details',
    clause: '4.0',
    title: 'Detail',
    intro: 'Four things that are easier to show than to claim.',
  },
  { id: 'specifications', clause: '5.0', title: 'Specifications', intro: specsNote },
  { id: 'colophon', clause: '6.0', title: 'Colophon' },
]

/** Components look sections up by id rather than by position. */
export function section(id: string): Section {
  const found = sections.find((s) => s.id === id)
  if (!found) throw new Error(`Unknown section: ${id}`)
  return found
}

// --- interface strings ------------------------------------------------------

export const ui = {
  skipToContent: 'Skip to content',
  railLabel: 'Sections',
  loadingSequence: 'Loading sequence',
  /** Placeholder shown in the frame readout before the first draw. */
  frameReadoutPlaceholder: '0000',
  /** Alt text for a key frame on the reduced-motion and failure paths. */
  keyFrameAlt: (heading: string, index: number, total: number) =>
    `${heading}, view ${index} of ${total}.`,
}
