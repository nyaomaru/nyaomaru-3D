# Repository Guidelines

## Project Structure & Module Organization
- `src/` — Vue 3 + TypeScript sources. Key files: `main.ts`, `App.vue`, components in `src/components/` (e.g., `ThreeScene.vue`), styles in `src/style.css`.
- `public/` — static assets served at `import.meta.env.BASE_URL` (e.g., `nyaomaru_logo.png`). Do not import from `src/assets/` for runtime-loaded textures.
- Root — `index.html`, `vite.config.ts`, `tsconfig*.json`, `package.json`.

## Build, Test, and Development Commands
- `pnpm dev` (or `npm run dev`) — start Vite dev server with HMR.
- `pnpm build` — type-check via `vue-tsc -b`, then `vite build` to `dist/`.
- `pnpm preview` — serve the production build locally.

## Coding Style & Naming Conventions
- TypeScript strict mode enabled (see `tsconfig.app.json`); fix all type errors.
- Indentation: 2 spaces; prefer explicit named exports for utilities.
- Vue SFCs use `<script setup lang="ts">`.
- Filenames: components in PascalCase (`ThreeScene.vue`), utilities/composables in camelCase (`useFoo.ts`), styles kebab-case (`style.css`).
- Three.js: always dispose geometries/materials/textures and remove listeners on unmount.

## Testing Guidelines
- No test runner is configured yet. If adding tests, use Vitest + Vue Test Utils.
- Place unit tests next to sources as `*.spec.ts` (e.g., `src/components/ThreeScene.spec.ts`).
- Prefer pure logic extraction for testability; mock WebGL/TextureLoader when needed.

## Commit & Pull Request Guidelines
- Prefer Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`.
- Keep commits focused; explain rationale if changing rendering/math.
- PRs must include: summary, screenshots/GIFs for visual changes, steps to verify, and any perf/memory notes (disposals, texture sizes).
- Link related issues; keep PRs small and scoped.

## Security & Configuration Tips
- Use `import.meta.env.BASE_URL` for asset paths; avoid hardcoding URLs.
- Keep textures optimized (power-of-two where possible); avoid committing very large binaries.
- Do not add dependencies or change build tooling without discussion in an issue/PR description.

## Agent-Specific Instructions
- Follow these guidelines for all edits within this repo tree.
- Make minimal, targeted changes; do not rename files or reorganize modules without clear justification.
- When introducing new code, mirror existing patterns and tsconfig constraints.
