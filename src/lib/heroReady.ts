/**
 * The hero still is the largest paint on the page and must never queue behind
 * a few megabytes of frame sequence. Sequences wait on this before they start
 * decoding; a timeout keeps a broken or cached-away hero from stalling them.
 */

const FALLBACK_MS = 4000

let settled = false
let release: () => void = () => {}
const heroPainted = new Promise<void>((resolve) => {
  release = resolve
})

/** Called by the hero still once it has loaded (or failed to). */
export function markHeroReady(): void {
  if (settled) return
  settled = true
  release()
}

export function whenHeroReady(): Promise<void> {
  if (settled) return Promise.resolve()
  return Promise.race([
    heroPainted,
    new Promise<void>((resolve) => setTimeout(resolve, FALLBACK_MS)),
  ])
}
