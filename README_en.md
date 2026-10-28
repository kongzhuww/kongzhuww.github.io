# tab-project Showcase Website

> Static showcase website built with Next.js 16, React 19, and TypeScript for [kongzhuww/tab-project](https://github.com/kongzhuww/tab-project).

**English** | [简体中文](README.md)

- **Repository**: `kongzhuww/tab-project-website`
- **Live Production Domain**: `https://logicweaver.me/`
- **Landing Page**: Feature showcases, interactive Light / Lonetrail / Dark theme previews, installation guides, and FAQs.
- **Privacy Policy**: `/privacy` (statically exported to `out/privacy.html`), linked from the footer; must pass public verification before web store submissions.
- **Policy Basis & Checklist**: See `docs/PRIVACY_REVIEW.md`.

*Legacy AI RSS Daily pages, report JSON files, and old IoT mock scripts have been retired. We no longer maintain `/daily/` or `/reports/`. Historical code remains preserved in Git history.*

---

## Content Scope & Boundaries

- The landing page content is derived from the local `tab-project` README and codebase. It does not send dynamic runtime requests to GitHub, nor does it assume release binaries are pre-attached. The release link points to the GitHub `/releases` listing; if binaries are unavailable, users are guided to build from source.
- Live previews use mock fixture data rather than actual personal screenshots. Theme switching, tab toggles, and task check-offs only modify in-page visual state—they do not control the actual browser extension, real user accounts, or play background audio.
- Defaults to the Light theme using CSS variables. Contains zero telemetry, login systems, databases, or external tracking SDKs. Never place private keys, tokens, cookies, or personal screenshots into `public/`.

---

## Local Development & Verification

```bash
npm run dev
npm run lint
npx --no-install tsc --noEmit
npm run build
```

Open the address shown in your terminal (typically `http://localhost:3000`).
The project uses `output: "export"`; static outputs are placed in `out/`. Do not use `next start` to preview static exports.

### Key Files

```text
src/app/page.tsx                    Project introduction and interactive preview
src/app/globals.css                 Responsive styles and CSS theme variables
src/app/layout.tsx                  Root metadata and layout structure
src/app/privacy/page.tsx            Extension and website privacy policy
src/app/privacy/privacy.module.css  Theme-adaptive policy styles
next.config.mjs                     Next.js static export configuration
wrangler.toml                       Cloudflare static assets & routing rules
```

---

## Deployment

Configured for Cloudflare Workers Static Assets:

- **Build Command**: `npm run build`
- **Deploy Command**: `npx wrangler deploy`
- **Static Assets Directory**: `out/`
- **Worker**: `project911`
- **Custom Domains**: `logicweaver.me/*` and `www.logicweaver.me/*`

Local Git commits do not automatically trigger live site changes; pushes and deployments are executed only upon explicit authorization.

---

## Maintenance Notes

`CLAUDE.md` contains historical notes from the prior RSS site version. Current development strictly follows user specifications, this README, `AGENTS.md`, and active source code. Retired daily RSS, IoT simulations, databases, and login services will not be restored.
