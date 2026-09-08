# The Secret Weapon

A private, responsive productivity app inspired by [The Secret Weapon](https://thesecretweapon.org/the-secret-weapon-manifesto/the-secret-weapon/) and [Getting Things Done](https://gettingthingsdone.com/what-is-gtd/).

## What works

- Capture thoughts into an Inbox, then clarify them into actions with supporting notes.
- Organize with **1-Now, 2-Next, 3-Soon, 4-Later, 5-Someday**, plus **Waiting** and a reference **Cabinet**.
- Intersect **Where**, **Who**, and **What/project** with the selected horizon. Optional duration and energy filters narrow the list further.
- Set actual deadlines or Waiting follow-up dates independently of priority horizons.
- Search notes, actions, and completed history. Complete, restore, soft-delete, and undo changes.
- Walk through a five-step weekly review and save its completion date.
- Save personal records to Cloudflare D1 behind Sites-managed ChatGPT sign-in. Queries and writes are scoped to the authenticated user. Optimistic versions reject stale edits from another device.
- Export a readable JSON backup. A separate `?demo=1` workspace is temporary and never seeds personal records.
- Install on Android from a supporting browser. The app needs a connection for records; its service worker caches only a public offline notice and icons. It never caches private responses or login routes.

This is an independent implementation. It does not integrate with Evernote, import ENEX files, provide push reminders, or implement recurring tasks yet. Export is currently one-way; there is no backup restore UI. Plain-text notes preserve line breaks; rich-text formatting and attachments are not included.

## Development

Node.js 22.13 or newer is required. On Windows, use `npm.cmd` / `npx.cmd` if PowerShell execution policy blocks the `.ps1` shims.

```sh
npm ci
npx wrangler d1 migrations apply DB --local --config wrangler.local.json
npm run dev
```

Open the printed local URL. Use the sign-in link for the scaffold's development identity, or append `?demo=1` to try sample actions. Local identity simulation is supplied by the Sites Vite plugin and is not part of the production Worker.

```sh
npx tsc --noEmit
node scripts/verify.mjs
npm run build
```

The integration check requires the running dev server and local migrations. It refuses non-local URLs, creates its own local action, and soft-deletes it afterward. It also records a review for the development account.

## Hosting and privacy

The production runtime is a Cloudflare-compatible Worker built with Vinext. Sites supplies the `DB` binding, identity headers, access policy, and deployment migrations. `.openai/hosting.json` contains logical configuration and the Site ID, not credentials. Never expose the Worker outside a trusted identity dispatcher: the app relies on the dispatcher's authenticated headers.

Task data is stored in the server database. Session storage is used only for an unfinished editor draft, keyed to the verified site user. Signing out through the app clears the current account's temporary draft. No API key is needed or stored in the browser. The first hosted deployment is owner-private.

The build is not a GitHub Pages static site. GitHub holds the source; Sites runs the app, its database, and sign-in. To use a Namecheap-managed subdomain, register the desired hostname through Sites first, then apply the exact DNS/validation records it returns in Namecheap Advanced DNS. Do not repoint the existing portfolio's apex records. Installing directly on Namecheap hosting would require adapting the database and authentication integrations.

## Design rationale

The working surface opens on Now, with broader horizons always visible. Quick capture asks for one thought; contexts live in optional details. Labeled controls, visible active filters, explicit saving feedback, undo, and keyboard shortcuts apply [Nielsen's usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/). Touch controls, keyboard focus, accessible dialogs, and reduced-motion support are included. These are design choices, not claims of measured productivity gains.

Two optional WebMCP tools expose the loaded action list and open a capture draft for user review. They feature-detect `document.modelContext`, share the app's state, validate inputs, and unregister on unmount. Runtime WebMCP verification depends on a supporting browser context.
