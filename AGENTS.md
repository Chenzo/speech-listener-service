# AI Guidance (Canonical)

This document is the source of truth for AI-assisted contributions in this repo. Follow it exactly.

## Repo context
- Stack: Next.js + React (versions in `package.json`), JavaScript/JSX (no TypeScript).
- Styling: SCSS modules plus global SCSS.

## Nonâ€‘negotiables
1) **Strict scope**: Do only what the request asks. No â€œniceâ€‘toâ€‘haves.â€
2) **Minimal diff**: Make the smallest change that works. Do not reformat unrelated code.
3) **Maintain patterns**: Match existing architecture, naming, imports, error handling, and data flow.
4) **No new dependencies**: Do not add packages, frameworks, or tooling.
5) **Readability bar**: Prefer explicit, straightforward code. Avoid deep nesting, nested ternaries, metaprogramming, or overly generic abstractions.
6) **Helpers sparingly**: Add helpers only when required or specifically requested.
7) **Comments**: Keep existing comments. Do not add conversational comments or emojis. If a comment becomes inaccurate, minimally correct it.
8) **Safety**: Never add or expose secrets. No empty `catch`; log or propagate errors following local patterns.
9) **Refactors**: Avoid large refactors. If a bigger change is needed, propose a stepwise plan instead of implementing it.
10) **Tests**: Do not write or run tests unless explicitly asked. Do not add Playwright tests.
11) **Ambiguity**: Do not guess. Ask questions or propose 2â€“3 options with tradeoffs.
12) **Output expectations**: In responses, summarize what changed, why, files touched, and how to validate.

## Implementation guidance
- Follow existing file structure and import style (including path aliases like `components/` and `lib/`).
- Keep formatting consistent with `.prettierrc`.
- Do not rename files or reorganize folders unless explicitly asked.
- Prefer small, localized edits over broad rewrites.
