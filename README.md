# Hacker

A golf swing coach that runs entirely in the browser (Chrome or Edge on a Mac or PC). See [SPEC.md](SPEC.md) for the full plan.

Nothing leaves the computer: swings are stored in the browser, and videos can be kept in a folder you choose.

## Commands

Run these in Terminal from the `hacker` folder (`cd ~/hacker`).

| What | Command |
| --- | --- |
| Install the tools (once, or after pulling changes) | `npm install` |
| Run the app on this Mac | `npm run dev`, then open http://localhost:5173 in Chrome or Edge |
| Stop the app | Press Ctrl + C in the Terminal window |
| Run the tests | `npm test` |
| Check the code for type errors | `npm run typecheck` |
| Build the website for hosting | `npm run build` (the site lands in `dist/`) |
| Try the built website locally | `npm run preview` |
| Deploy | Not set up yet: waiting on the choice of host |

## Test videos

Put test videos in `TestVideos/` (Git ignores this folder because videos are large). AirDrop them from the iPhone and save them there.

`TestVideos/synthetic/` holds generated clips (240 fps HEVC, 240 fps H.264, 30 fps HEVC) made with:

```
swiftc -O scripts/makevideo.swift -o scripts/makevideo
scripts/makevideo TestVideos/synthetic/example.mov hevc 1920 1080 240 2 1 "2026-11-01T10:00:00-0400"
```

`npm test` reads their headers when the folder exists.

To check which video formats the installed Chrome or Edge can play, start `npm run dev`, then:

```
node scripts/probe-browser.mjs "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" 9333
node scripts/probe-browser.mjs "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" 9334
```

On any computer, the app's **Diagnostics** page runs the same checks by hand, tests a real iPhone video, and tests folder access.

## Layout

- `src/lib/` – the analysis library and data layer, with no screen code: swing types, the rolling rule, the video header reader, IndexedDB with versioned migrations, the video folder, CSV.
- `src/ui/` – placeholder screens behind a simple `Screen` interface, to be replaced by Claude Design's screens.
- `tests/` – Vitest tests, run from the terminal.

## Rules for changing stored data

The database layout lives in `MIGRATIONS` in `src/lib/db.ts`. Never edit an existing migration: add a new one, and test it on a copy of real data.

## Status

- Milestone 0 (setup): done on the MacBook Pro. PC checks pending.
- Milestone 1 (upload, label, rolling sets): built with placeholder screens. Deployment pending the choice of host.
