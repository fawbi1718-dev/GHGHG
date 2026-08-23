# REDESIGN NOTES — Eshmun Clinical Design System (Experiment)

Location: `Desktop\redesign-lab` (isolated copy · own git history · production app untouched)

## Design opinion
Enterprise clinical software: neutral slate surfaces, ONE desaturated teal accent
(`brand-*`), hairline borders instead of shadows/shine, 8px radius ceiling,
denser paddings, uppercase micro-labels for metadata, zero decorative emojis,
zero gradients/glassmorphism. Typography: Inter + JetBrains Mono for all
identifiers/prices (kept from original — it was already right).

## What changed (all visual only)
1. **Tokens** (`src/index.css`): `brand-50…900` teal scale, neutral page bg
   `#F1F5F9`, removed Space Grotesk display font, quieter scrollbars.
2. **Primitives**: Button (slate-900 primary / bordered secondary, fixed heights,
   rounded-md), Badge (white bg + colored border, 10px uppercase), Card
   (hairline, no shadow), Input (white bg, brand focus), Modal/Drawer (50%
   dim, no blur, shadow-xl→xl, radius-lg).
3. **Shell**: sidebar = flat list with left accent bar on active item; brand
   mark = slate-900 square with mono "E" (replaced 🌿); mobile dock = border-top
   indicator style, no scale bounce.
4. **Global sweeps**: every `emerald-*` → `brand-*` (41 files) — status colors
   and accents now unified; `rounded-2xl/3xl` → `lg/xl`.
5. **Emoji removal**: all UI emojis replaced with text or Lucide icons across
   POS, marketplace, scanner picker, settings, dispatch drawer, profile view.
6. **Decoration removal**: warehouse profile hero gradient → slate-800 band;
   intake modal header gradient → slate-50; queue/tracking card headers flattened.

## Screens most affected
Shell/nav · Marketplace (directory/storefront/profile) · Dispatch queue &
history · both Inventory tabs · Surplus publish · Auth/login chrome · modals
everywhere (shared primitives).

## Merge guidance
- SAFE to merge wholesale: index.css tokens, ui/* primitives, shell classes,
  emoji/decoration removals. These are drop-in visual changes over identical logic.
- REVIEW before merging: `emerald→brand` sweep inside POS receipt/print styles
  (ThermalReceipt) if brand printout matters.
- DO NOT merge blindly: any hunk touching files you've customized since
  baseline commit `245af41`.

## Validation in lab
`tsc --noEmit` exit 0 · vitest 16/16 · `vite build` ✓ 43s.
