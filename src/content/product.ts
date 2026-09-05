/**
 * Every word, number and annotation on the page comes from this file.
 * Components import from here and hold no copy of their own.
 */

// --- types -----------------------------------------------------------------

export type Annotation = {
  id: string
  /** Frame index the annotation appears on. */
  enterFrame: number
  /** Frame index it disappears on. */
  exitFrame: number
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

export const product = {
  maker: 'Harbour Instruments',
  name: 'Harbour Two',
  type: 'H2',
  panelLegend: 'H2 / 2×4 DESKTOP INTERFACE',
  serial: 'SN 0001',
  positioning:
    'Two discrete microphone preamplifiers, four analogue outputs, and a monitor path with nothing in it you did not ask for.',
  scrollAffordance: 'Scroll to rotate',
} as const

// --- act I: turntable ------------------------------------------------------

export const turntable: SequenceSpec = {
  name: 'turntable',
  manifestUrl: '/frames/turntable/manifest.json',
  heading: 'One turn around the unit',
  intro:
    'A full rotation, held under your scroll. Six parts of the unit are called out as they come round.',
  scaleLabel: 'ROTATION / FRAME INDEX',
  scrollLength: { desktop: '+=300%', mobile: '+=200%' },
  keyFrames: [0, 30, 60, 90],
}

/**
 * Authored against frame indices in the turntable sequence. Anchors are
 * normalised to the drawn image box, so they survive any canvas size — but
 * they are tuned to the placeholder geometry and want a pass once the real
 * renders land.
 */
export const turntableAnnotations: Annotation[] = [
  {
    id: 'preamps',
    enterFrame: 4,
    exitFrame: 26,
    anchor: { x: 0.3, y: 0.66 },
    title: 'Microphone inputs',
    body: 'Two discrete transformer-coupled preamplifiers on a single board, laid out as mirrored channels so both signal paths are the same length.',
    readout: 'EIN −130 dBu, 150 Ω, 60 dB',
  },
  {
    id: 'gain',
    enterFrame: 28,
    exitFrame: 48,
    anchor: { x: 0.44, y: 0.33 },
    title: 'Gain encoder',
    body: 'A stepped rotary encoder switching a relay ladder rather than sweeping a pot, so both channels can be matched by ear and then read off the panel.',
    readout: '69 dB range, 1 dB steps',
  },
  {
    id: 'conversion',
    enterFrame: 50,
    exitFrame: 68,
    anchor: { x: 0.57, y: 0.47 },
    title: 'Conversion and clocking',
    body: 'A single low-jitter clock feeds both converters. There is no internal resampling: the rate you choose is the rate the converter runs at.',
    readout: '24-bit / 192 kHz, ±2 ppm',
  },
  {
    id: 'monitor',
    enterFrame: 70,
    exitFrame: 88,
    anchor: { x: 0.6, y: 0.34 },
    title: 'Monitor control',
    body: 'Level is set by a relay-switched resistor ladder in the analogue domain, ahead of the outputs, so nothing is thrown away digitally to make it quieter.',
    readout: 'Channel match ±0.05 dB',
  },
  {
    id: 'headphones',
    enterFrame: 90,
    exitFrame: 106,
    anchor: { x: 0.33, y: 0.62 },
    title: 'Headphone outputs',
    body: 'Two independent amplifiers, each with its own level control, driving anything from 16 to 600 Ω without running out of voltage.',
    readout: '2 × 250 mW into 32 Ω',
  },
  {
    id: 'chassis',
    enterFrame: 108,
    exitFrame: 119,
    anchor: { x: 0.5, y: 0.72 },
    title: 'Chassis',
    body: 'Milled from a single aluminium billet. The shell is the heatsink, the shield and the structure, which is why there are no seams along the sides.',
    readout: '1.4 kg, 6061-T6',
  },
]

// --- act II: exploded ------------------------------------------------------

export const exploded: SequenceSpec = {
  name: 'exploded',
  manifestUrl: '/frames/exploded/manifest.json',
  heading: 'Four layers, taken apart',
  intro:
    'The same unit separated along its depth axis: cover, main board, converter board, base.',
  scaleLabel: 'SEPARATION / FRAME INDEX',
  scrollLength: { desktop: '+=200%', mobile: '+=150%' },
  keyFrames: [0, 20, 40, 59],
}

export const explodedClaims: Annotation[] = [
  {
    id: 'ground-plane',
    enterFrame: 5,
    exitFrame: 24,
    anchor: { x: 0.42, y: 0.52 },
    title: 'Four layers, one ground plane',
    body: 'Analogue and digital sections sit on opposite sides of an unbroken ground plane, joined at a single point beneath the converter.',
    readout: '4-layer, 70 µm copper',
  },
  {
    id: 'isolation',
    enterFrame: 25,
    exitFrame: 43,
    anchor: { x: 0.55, y: 0.44 },
    title: 'Converter on its own island',
    body: 'The converter and its clock have a separately regulated supply, so nothing on the USB side can reach them.',
    readout: 'Supply noise < 3 µV RMS',
  },
  {
    id: 'assembly',
    enterFrame: 44,
    exitFrame: 59,
    anchor: { x: 0.47, y: 0.63 },
    title: 'Serviceable, not sealed',
    body: 'Six captive screws and no adhesive anywhere in the assembly. Every board can be lifted out and put back by hand.',
    readout: '6 fasteners, no adhesive',
  },
]

// --- macro details ---------------------------------------------------------

export const macroDetails: MacroDetail[] = [
  {
    id: 'panel',
    still: { sequence: 'turntable', frame: 0 },
    alt: 'The top panel of the H2 seen straight on, with both gain encoders and the level display.',
    title: 'The panel says what it does',
    body: 'Legends are engraved and filled, not printed. Nothing on the top surface is there to be looked at rather than used.',
    figure: { label: 'Legend depth', value: '0.15 mm' },
  },
  {
    id: 'encoder',
    still: { sequence: 'turntable', frame: 14 },
    alt: 'Three-quarter view of the H2 showing the gain encoder and its detented collar.',
    title: 'Detents you can count',
    body: 'The encoder has a mechanical detent at every step, so a level can be set by feel in the dark and repeated the next day.',
    figure: { label: 'Detent torque', value: '1.8 mNm' },
  },
  {
    id: 'connectors',
    still: { sequence: 'turntable', frame: 104 },
    alt: 'The rear of the H2, showing the row of output connectors.',
    title: 'Connectors bolted to the shell',
    body: 'Every socket is fixed to the chassis rather than hanging off the board, so a pulled cable loads the aluminium and not the solder.',
    figure: { label: 'Insertion cycles', value: '5000' },
  },
  {
    id: 'interior',
    still: { sequence: 'exploded', frame: 44 },
    alt: 'The H2 with its cover lifted, showing the main board and the converter board.',
    title: 'One board, two domains',
    body: 'The analogue front end occupies its own half of the board, with the converter and clock behind a single-point ground tie.',
    figure: { label: 'Board separation', value: '12 mm' },
  },
]

// --- specifications --------------------------------------------------------

// PLACEHOLDER SPECS — every figure below is a stand-in. Replace with the
// measured values from the final production units before this page ships.
export const specGroups: SpecGroup[] = [
  {
    id: 'inputs',
    title: 'Inputs',
    rows: [
      { label: 'Microphone inputs', value: '2', note: 'XLR, transformer-coupled' },
      { label: 'Gain range', value: '69', unit: 'dB', note: '1 dB steps' },
      { label: 'Equivalent input noise', value: '−130', unit: 'dBu', note: '150 Ω, 60 dB gain' },
      { label: 'Maximum input level', value: '+12', unit: 'dBu' },
      { label: 'Input impedance', value: '3.0', unit: 'kΩ' },
      { label: 'Instrument inputs', value: '2', note: '1 MΩ, front panel' },
    ],
  },
  {
    id: 'conversion',
    title: 'Conversion',
    rows: [
      { label: 'Resolution', value: '24', unit: 'bit' },
      { label: 'Sample rates', value: '44.1–192', unit: 'kHz' },
      { label: 'Dynamic range', value: '120', unit: 'dB', note: 'A-weighted' },
      { label: 'THD+N', value: '< 0.0008', unit: '%', note: '1 kHz, −1 dBFS' },
      { label: 'Frequency response', value: '20–20k', unit: 'Hz', note: '±0.05 dB' },
      { label: 'Clock stability', value: '±2', unit: 'ppm' },
    ],
  },
  {
    id: 'outputs',
    title: 'Outputs',
    rows: [
      { label: 'Line outputs', value: '4', note: 'balanced, impedance-compensated' },
      { label: 'Maximum output level', value: '+18', unit: 'dBu' },
      { label: 'Output impedance', value: '75', unit: 'Ω' },
      { label: 'Headphone outputs', value: '2', note: 'independent amplifiers' },
      { label: 'Headphone power', value: '250', unit: 'mW', note: 'per channel into 32 Ω' },
      { label: 'Monitor attenuation', value: '0–96', unit: 'dB', note: 'relay ladder, analogue' },
    ],
  },
  {
    id: 'physical',
    title: 'Physical',
    rows: [
      { label: 'Width', value: '212', unit: 'mm' },
      { label: 'Depth', value: '148', unit: 'mm' },
      { label: 'Height', value: '52', unit: 'mm' },
      { label: 'Weight', value: '1.42', unit: 'kg' },
      { label: 'Chassis', value: '6061-T6', note: 'milled aluminium, anodised' },
      { label: 'Connection', value: 'USB-C', note: 'bus powered, class compliant' },
    ],
  },
]

export const specsNote =
  'Figures are typical for a production unit at 24-bit / 48 kHz unless stated otherwise, measured at the outputs over a 20 Hz to 20 kHz bandwidth.'

// --- colophon --------------------------------------------------------------

export const colophon = {
  intro:
    'A portfolio piece. The Harbour Two is not a real product; the page is built the way a real one would be.',
  credits: [
    { role: 'Modelling', value: 'Yannick' },
    { role: 'Rendering', value: 'Placeholder sequences, generated procedurally' },
    { role: 'Design and build', value: 'Yannick, with Claude' },
    { role: 'Typefaces', value: 'IBM Plex Sans, IBM Plex Sans Condensed, IBM Plex Mono' },
  ],
  note: 'Frame sequences are pre-rendered stills. No 3D runtime is loaded by this page.',
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
  { id: 'hero', clause: '0.0', title: 'Harbour Two' },
  { id: 'turntable', clause: '1.0', title: 'The unit' },
  { id: 'exploded', clause: '2.0', title: 'Inside' },
  {
    id: 'details',
    clause: '3.0',
    title: 'Detail',
    intro: 'Four things that are easier to show than to claim.',
  },
  { id: 'specifications', clause: '4.0', title: 'Specifications', intro: specsNote },
  { id: 'colophon', clause: '5.0', title: 'Colophon' },
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
