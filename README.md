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
- Attach PDFs, images, documents, and other files to actions and reference notes. Choose files or drag and drop, then save; download or remove them from the editor. Up to 10 files per action, 10 MB each, stored privately in R2 with ownership metadata in D1. Search includes filenames.
- Export a readable JSON backup of notes and attachment metadata (download the actual files separately). A separate `?demo=1` workspace is temporary and never seeds personal records.
- Install on Android from a supporting browser. The app needs a connection for records; its service worker caches only a public offline notice and icons. It never caches private responses or login routes.

This is an independent implementation. It does not integrate with Evernote, import ENEX files, provide push reminders, or implement recurring tasks yet. Export is currently one-way; there is no backup restore UI. Plain-text notes preserve line breaks; rich-text formatting is not included.

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

Initial verification: TypeScript and the local API integration checks passed. Browser interaction tests, physical Android installation, and runtime WebMCP checks have not been performed; no supported WebMCP test context was available in the build session.

## Attachments

Files upload when the action is saved. Closing the editor keeps selected files in memory; Discard draft drops unsaved selections. Reload restores the text draft, but unsaved files and removals must be selected again. Partial upload failures preserve remaining selections for retry without creating another action or duplicate attachment. Demo files remain in memory only.

Downloads always require the signed-in owner and an active parent action, use private/no-store responses, and are served as downloads instead of executable inline content. Soft-deleting an action preserves its files for Undo; removed attachments become inaccessible immediately. The server enforces both actual byte limits and the per-action count. File metadata supplied in task JSON is ignored; only successful uploads create attachments.

Apply local migrations before development. Sites provisions the ATTACHMENTS R2 binding on publication. Run `node scripts/verify-attachments.mjs` against the local server to check upload/download integrity, access controls, limits, retry behavior, and task deletion/undo.
