# Design plan — Scarlett Solo concept page

Written before any component code. Revised against the brief (§6), then twice more as the
renders and the subject changed (§7, §8).

---

## 1. The product

An **unofficial concept page for the Focusrite Scarlett Solo**: one mic input, one instrument
input, two balanced outputs, a headphone amplifier, over bus-powered USB-C. Panel legend on the
unit reads `SCARLETT SOLO / 2 IN, 2 OUT`.

The page says on its face that it is not Focusrite's — a stamp opposite the maker in the hero, and
a paragraph in the colophon. Measured specifications are left blank rather than invented under
someone else's name.

## 2. Palette — 5 values, no accent

| Token       | Hex       | Role |
|-------------|-----------|------|
| `--panel`   | `#B9BCB6` | Anodised aluminium grey-green. Ground for the *hardware* sections: hero and both pinned acts. |
| `--paper`   | `#F1F1EE` | Datasheet stock. Ground for the *document* sections: macro details, specifications, colophon. |
| `--ink`     | `#15171A` | Silkscreen black. All primary text, all hairlines at full strength. |
| `--ink-2`   | `#3C4143` | Secondary text: captions, table sub-labels, colophon. Dark enough to clear 4.5:1 on the panel ground, not only on paper. |
| `--rule`    | `#8E938C` | Engraved grey. Hairlines, table rules, dB-scale ticks, leader lines on panel. |

Two grounds, three inks, **no accent colour**. The page is made of the two materials the product
ships as: the anodised panel and the printed manual bound behind it. Section boundaries are **hard
cuts** between `--panel` and `--paper`, never gradients or fades. The rendered unit is the only
chroma on the page; where the interface needs to mark something — the overload zone on the scale,
an annotation anchor, the current clause in the rail — it does it with **weight**, not hue.

## 3. Type

| Face | Role |
|------|------|
| **IBM Plex Sans** 400 / 600 | Everything readable: headings (600, sentence case, tight leading, no display serif), body 400. Tabular lining figures on globally via `font-variant-numeric: tabular-nums lining-nums`. |
| **IBM Plex Sans Condensed** 600 | Panel legend only — the small hard-edged labels that would be screen-printed on the chassis: connector names, clause numbers in the rail, table group headers. |
| **IBM Plex Mono** 400 | Genuine readouts only — frame counter, dB tick values, tolerance figures inside annotations, serial plate. Never a generic "small label" font. |

Plex is chosen over a neutral grotesque because it was drawn for engineering documentation and
carries real tabular figures; the condensed cut supplies the silkscreen voice without a second
family.

Body copy caps at `66ch`. Headings never exceed ~18ch per line.

## 4. Layout

### 4.1 The index rail

A persistent 84px left margin column at ≥1024px, borrowed from a datasheet clause numbering
system. It carries the section number, a hairline, and — inside a pinned act — a live frame
readout and a scrub tick riding a dB scale. Below 1024px it collapses to a 1px progress hairline
at the top of the viewport. This is the only chrome on the page.

### 4.2 Wireframes

```
HERO (100vh, ground: --panel)
┌────┬───────────────────────────────────────────────────────────┐
│ 0.0│                                                           │
│    │                                                           │
│ │  │            [ product still, transparent PNG,              │
│ │  │              frame 0 of the turntable sequence ]          │
│ │  │                                                           │
│ │  │  Scarlett Solo                                            │
│ │  │  Two channels in, four out. Every figure measured.        │
│ │  │  ────────────────────────────────────────                 │
│SOLO│  SCARLETT SOLO / 2 IN, 2 OUT   UNOFFICIAL CONCEPT         │
│    │                                            v scroll       │
└────┴───────────────────────────────────────────────────────────┘
   ^ rail: clause no. at top, type designation at bottom, hairline between

ACT I — TURNTABLE (pinned, 300vh / 200vh mobile, ground: --panel)
┌────┬───────────────────────────────────────────────────────────┐
│ 1.0│      ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐                          │
│ #  │      │                         │   ┌[03]──────────────┐   │
│ #  │      │      < canvas >         │───│ Gain encoder     │   │
│ .  │      │      aria-hidden        │   │ 69 dB, 1 dB steps│   │
│ .  │      │                         │   │ mono readout     │   │
│ .  │      └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   └──────────────────┘   │
│    │                                                           │
│0042│  -60  -40  -20  -10  -6  -3  0 :+6                        │
└────┴──────────────────^────────────────────────────────────────┘
   ^ frame readout       ^ scrub position rides a real dB scale; the 0..+6
                           overload zone is a triple-weight rule, not a colour

MACRO DETAILS (ground: --paper) — alternating, static, no scrub
┌────┬───────────────────────────────┬───────────────────────────┐
│ 3.1│  [ full-bleed still          ]│ Heading                   │
│    │  [                           ]│ 3 lines of body, <=66ch   │
│    │  [                           ]│ ─────────────             │
│    │                               │ tolerance   ±0.05 dB      │
└────┴───────────────────────────────┴───────────────────────────┘
   next block mirrors: copy left, still right. No cards, no shadows.

SPECIFICATIONS (ground: --paper)
┌────┬───────────────────────────────────────────────────────────┐
│ 4.0│ INPUTS                                                    │
│    │ ────────────────────────────────────────────────────────  │
│    │ Microphone inputs                              2          │
│    │ Gain range                                 69 dB          │
│    │ EIN (150 Ω, 60 dB gain)               −130 dBu            │
│    │ CONVERSION                                                │
│    │ ────────────────────────────────────────────────────────  │
│    │ Sample rates                     44.1 – 192 kHz           │
└────┴───────────────────────────────────────────────────────────┘
   left label 400, right value tabular and right-aligned, unit in --ink-2
```

## 5. Three principles (specific to this product)

1. **Silkscreen, not chrome.** Everything on the page behaves like ink screen-printed on a flat
   panel: one hairline weight, flat fills, no shadow, no rounded card, no gradient. The only
   depth in the composition is inside the render itself.
2. **Numbers are the ornament.** Tolerances, dB figures, frame indices and clause numbers supply
   the visual texture. Nothing decorative is invented on top of them. Tabular lining figures
   everywhere; every numeric column right-aligns on its unit.
3. **The unit moves; the page does not.** The whole motion budget is the two scrub acts. Type
   never animates in, sections never fade up, and section changes are hard cuts of ground colour.

## 6. Review pass — what this plan revised

Read back against the brief, four things in the first draft were defaults and were cut:

- **Cut: a tracked-out `ACT I` eyebrow above each act heading.** Replaced by the index rail clause
  number (`1.0`), a datasheet device rather than a web-marketing one. All-caps survives *only*
  where it is literal panel silkscreen — connector legends, table group headers — never floating
  above a heading.
- **Cut: a plain scroll progress bar.** Replaced by the dB scale, the same information in the
  product vernacular, with the +6 overload zone marked by rule weight.
- **Cut: a warm off-white page with a rust accent.** That is the banned cream/terracotta reflex.
  The two-ground system (`--panel` / `--paper`) replaced it and is materially motivated.
- **Kept deliberately:** mono is present but rationed to genuine readouts, per the brief carve-out.

## 7. Implementation notes added during the build

- **The two grounds interleave inside the macro-details section.** Each still sits on `--panel`
  and its copy on `--paper`, so the alternating blocks keep the same material logic as the page
  as a whole: hardware on the panel, words on the paper.
- **`--ink-2` was darkened** from `#4A4F51` to `#3C4143`. The lighter value measured 4.05:1 on the
  panel ground, which fails AA for body copy; the darker one measures 5.4:1 there and 9.1:1 on
  paper, and still reads clearly as secondary.
- **The rail marks the current clause with a filled square** rather than by dimming the others,
  because dimming pushed the inactive numbers to 1.6:1 against the panel.

## 8. Revision after the real renders landed

The placeholder unit was a neutral dark box. The real one is a red-and-white desktop interface,
which changed two decisions:

- **The accent colour was removed.** `--signal` was an oxide red at `#A6301C`. Against a red
  product it read as a second, duller red — a mismatch rather than a system. The palette dropped
  to five values and every mark it used (overload zone, annotation anchor, rail marker) is now ink
  differentiated by weight. Principle 1 was already pushing this way: the product is the only
  place boldness is spent, and it now supplies all of the colour.
- **Annotations point at components, not at coordinates.** The render step writes, for every named
  part of the model, where that part lands on every frame and whether it is unoccluded. Leader
  lines follow their component through the rotation, and each annotation's frame range was set
  from its part's actual visibility window rather than guessed. The authored `anchor` in
  `product.ts` survives as the fallback for a sequence rendered without that data.

Also banned during code review of this build: `→` appended to link text, meta strings joined with
middle dots, identical rounded cards with soft grey shadows, gradient washes, colour-accented
headline words, and fade-and-slide-up entrances on sections.

## 9. Revision after the subject was settled

The page began as a fictional product, "Harbour Two", over a model that is unmistakably a Focusrite
Scarlett Solo — the wordmark is on the lid and the model name is on the panel. Invented specs under
someone else's hardware is the one thing a product page must not do, so the page became what it
always looked like: an unofficial concept for the real unit.

- **The identity is the real one, and the page says whose it is.** `Unofficial concept` sits
  opposite the maker in the hero, and the colophon names the trademark holder.
- **Measured figures are blank, not guessed.** The specification table keeps its structure and
  fills in only what is visible on the unit — socket counts, switch names, the connector. Anything
  that needs an instrument reads `—` with `from datasheet` beside it. A datasheet that invents its
  own numbers is worse than one that admits which rows are missing.
- **A fourth still was added from underneath.** The turntable is camera-locked at a fixed
  elevation, so it can never see the base. The macro details now come from a separate four-shot
  still library rendered by the same script, each with its own locked camera: front, top, rear and
  underside.
- **The exploded act only takes off what comes off.** Silkscreen, through-panel jack barrels, the
  USB-C socket and the Kensington slot all stay with the shell. What separates is the eight caps.
