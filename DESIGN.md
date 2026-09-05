# Design plan — Harbour Two (H2) product page

Written before any component code. Revised once against the brief (see §6).

---

## 1. The product

**Harbour Two**, type designation **H2**, a 2-in / 4-out desktop recording interface.
Two discrete mic preamps, 24-bit/192 kHz conversion, relay-switched monitor control.
Panel legend on the unit reads `H2 · 2×4 DESKTOP INTERFACE`.

## 2. Palette — 6 values

| Token       | Hex       | Role |
|-------------|-----------|------|
| `--panel`   | `#B9BCB6` | Anodised aluminium grey-green. Ground for the *hardware* sections: hero and both pinned acts. |
| `--paper`   | `#F1F1EE` | Datasheet stock. Ground for the *document* sections: macro details, specifications, colophon. |
| `--ink`     | `#15171A` | Silkscreen black. All primary text, all hairlines at full strength. |
| `--ink-2`   | `#4A4F51` | Secondary text: captions, table sub-labels, colophon. |
| `--rule`    | `#8E938C` | Engraved grey. Hairlines, table rules, dB-scale ticks, leader lines on panel. |
| `--signal`  | `#A6301C` | Oxide red, the colour of a peak lamp. **Functional only:** active annotation key, the 0 dB → +6 zone of the scale, the record dot. Never a fill, never a highlighted word. |

Two grounds, one accent. The page is made of the two materials the product ships as: the anodised
panel and the printed manual bound behind it. Section boundaries are **hard cuts** between
`--panel` and `--paper`, never gradients or fades.

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
│ │  │  Harbour Two                                              │
│ │  │  Two channels in, four out. Every figure measured.        │
│ │  │  ────────────────────────────────────────                 │
│ H2 │  H2 · 2×4 DESKTOP INTERFACE          SN 0001              │
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
   ^ frame readout       ^ scrub position rides a real dB scale;
                           the 0..+6 zone is the only --signal on screen

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
  product vernacular, which also gives the accent colour a functional home (the +6 overload zone).
- **Cut: a warm off-white page with a rust accent.** That is the banned cream/terracotta reflex.
  The two-ground system (`--panel` / `--paper`) replaced it and is materially motivated.
- **Kept deliberately:** mono is present but rationed to genuine readouts, per the brief carve-out.

Also banned during code review of this build: `→` appended to link text, meta strings joined with
middle dots, identical rounded cards with soft grey shadows, gradient washes, colour-accented
headline words, and fade-and-slide-up entrances on sections.
