@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — dev server with Turbopack on `localhost:3000`
- `npm run build` / `npm start` — production build & serve
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`)

There are no tests yet.

## What this app does

A single-page Next.js (App Router) tool for Mahidol University ICT students. The user pastes their Moodle calendar export URL once; the app fetches the iCal feed server-side, classifies each event, and renders an at-a-glance "what's due" view with a live countdown to the most urgent item.

## Architecture

The app is intentionally tiny — three files do the work:

- **`app/api/calendar/route.ts`** — server-only Route Handler. Fetches the iCal URL passed as `?url=`, runs a hand-rolled iCalendar parser (line unfolding, `VEVENT` extraction, `YYYYMMDDTHHMMSSZ` date parsing), then classifies each event into one of four `kind`s and returns JSON. Forced to `runtime = "nodejs"` and `dynamic = "force-dynamic"`.

- **`app/lib/courses.ts`** — static `Record<string, string>` of Mahidol ICT course codes (`ITCS###`, `ITGE###`, `ITLG###`) → English titles, sourced from the official 2566 (B.E.) curriculum PDF. `lookupCourseName()` normalises whitespace + casing before lookup. When adding new codes, keep the existing format and add to the right alphabetic group.

- **`app/page.tsx`** — client component. Persists the iCal URL in `localStorage` only (never to a server). Renders a hero countdown card for the next non-class event plus a date-grouped timeline of the rest. Uses CSS variables defined in `globals.css` for theming rather than Tailwind dark variants — see "Design system" below.

### Event classification rules

The classifier in `route.ts` runs in this order — order matters:

1. `SUMMARY` starts with `[Make-up]` → `makeup`
2. `SUMMARY` starts with `[Cancel]` → `cancelled`
3. `DTSTART == DTEND` (zero-duration) → `assignment` (Moodle deadlines)
4. Otherwise → `class` (regular timetabled lecture/lab)

The page filters out `class` by default (the "Important" tab). The Moodle category prefix `682_` (semester encoding) is stripped from subject codes before lookup.

### Why a custom iCal parser

`node-ical` was tried first and crashes on Turbopack's module evaluation (`e.BigInt is not a function`). The rolled-our-own parser in `route.ts` handles only the subset Moodle emits: VEVENT blocks with SUMMARY / DTSTART / DTEND / DESCRIPTION / CATEGORIES, with line unfolding (RFC 5545 §3.1) and the `YYYYMMDDTHHMMSSZ` / `YYYYMMDD` date forms. If you ever extend this (recurrence rules, timezones, etc.) you may want to re-evaluate `ical.js` rather than grow the parser.

## Design system

Theming lives in `app/globals.css` as CSS custom properties (`--bg`, `--fg`, `--accent`, `--urgent`, etc.) that flip via `@media (prefers-color-scheme: dark)`. The properties are also exposed to Tailwind v4 through `@theme inline` so utilities like `text-[var(--fg-muted)]` work everywhere. Prefer extending these tokens over hard-coding hex or using Tailwind's `dark:` variant — keeps light/dark consistent.

Other conventions used in `page.tsx`:
- `tnum` utility class for tabular numerals on countdowns and times (avoid jitter)
- `fade-up` class for entrance animation on cards
- `pulse-ring` on the hero status dot when < 24h remain
- `card` class encapsulates the hover/border treatment used across rows and panels

## Sensitive data

The Moodle iCal URL contains a personal `authtoken` that grants read access to the user's full calendar. It must stay client-side in `localStorage` and only be sent to our own `/api/calendar` route — never log it, never embed it in build artifacts, never expose it from the API response. The settings panel masks the token (`authtoken=•••••`) using `maskUrl()`.
