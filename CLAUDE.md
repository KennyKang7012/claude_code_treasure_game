# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # Install dependencies
npm run dev       # Start dev server at http://localhost:3000 (auto-opens browser)
npm run build     # Production build → outputs to build/ (not dist/)
```

There are no lint or test scripts configured.

## Architecture

This is a single-page React + TypeScript game built with Vite. All game logic lives in one file: **`src/App.tsx`**.

**Game flow**: Three treasure chests are rendered; one randomly contains treasure. Clicking an unopened chest reveals either treasure (+$100) or a skeleton (-$50). The game ends when treasure is found or all chests are opened.

**State** (all in `App.tsx`):
- `boxes: Box[]` — array of `{ id, isOpen, hasTreasure }` for the three chests
- `score: number` — running score
- `gameEnded: boolean` — triggers the Game Over panel

**Key implementation details**:
- Chest open sound effects are imported as ES module assets (`src/audios/*.mp3`) and played via the Web Audio API
- Animations use `motion/react` (Framer Motion) — `whileHover`, `whileTap`, and `animate` props on `motion.div`
- The closed chest cursor can be customized using `src/assets/key.png` as a CSS `cursor` url

**UI components** (`src/components/ui/`): Pre-generated shadcn/ui components backed by Radix UI primitives. These are drop-in — use them by importing from `@/components/ui/<name>`.

**Path alias**: `@` resolves to `src/` (configured in `vite.config.ts`).

**Vite quirk**: `vite.config.ts` uses version-pinned aliases (e.g., `'motion@*': 'motion'`) to normalize versioned import specifiers — do not remove them.

## Assets

| Path | Purpose |
|------|---------|
| `src/assets/treasure_closed.png` | Closed chest image |
| `src/assets/treasure_opened.png` | Open chest with treasure |
| `src/assets/treasure_opened_skeleton.png` | Open chest with skeleton |
| `src/assets/key.png` | Key icon (for custom cursor on hover) |
| `src/audios/chest_open.mp3` | Sound for treasure chest open |
| `src/audios/chest_open_with_evil_laugh.mp3` | Sound for skeleton chest open |

## Styling

- **Tailwind CSS v4** — utility classes are used inline in JSX. `src/index.css` is the compiled Tailwind output (not a config file; do not edit it directly).
- **Custom/global styles** go in `src/styles/globals.css`.
- The amber color palette (`amber-50` through `amber-900`) is the primary theme.
