# Security hardening review (2026-10-18)

## Scope and release status

Security-only changes based on main `d3c36f0`. No UI source files, database
policies, DNS, or Cloudflare account settings are changed by this patch.
The owner authorized committing/pushing the security fix for production rollout.
Production activation must be verified separately; a Git push is not proof that
Cloudflare has deployed the new Worker and static assets.

## Changes

- Worker proxies allow only the paths and query parameters used by this site.
  `/vps/*` is no longer an unrestricted forwarder: only `/vps/stats` remains.
- Proxy methods are GET/HEAD/OPTIONS only. Browser credentials and request bodies
  are never forwarded. Wildcard CORS response headers are removed.
- Lyrics require HTTPS, exact CDN hosts (`res01.hycdn.cn`, `res02.hycdn.cn`,
  `web.hycdn.cn`), and a Siren `.lrc` path. Credentials, nonstandard ports,
  fragments, query strings, and redirects are rejected. A newly used official
  host/path must be reviewed before extending this allowlist.
- All upstream fetches reject redirects, enforce a deadline through body
  consumption, and cap decoded response sizes (JSON 2 MiB; lyrics 256 KiB).
- Upstream HTTP/JSON failures fail closed with generic errors and no-store.
  Public VPS statistics are always no-store. API-level errors are not cached.
- Local `.wrangler/` state and `.dev.vars*` secrets are Git-ignored. Generated
  Wrangler bundles are excluded from lint without changing any source rules.
- Static assets receive security headers through `public/_headers`; dynamic
  responses use `security-headers.mjs`. A test checks that both remain in sync.
  Selective `run_worker_first` keeps proxy validation ahead of asset routing.
- `nosniff`, referrer policy, anti-framing, and browser permission restrictions
  are active. Narrow CSP directives (object/base/frame ancestors) are enforced.
  The broader CSP remains Report-Only, so it does not block existing scripts,
  login, music, or embedded players. Inline Next.js scripts may produce expected
  report-only violations. No external CSP report collector is configured.
- Next.js and its ESLint config are updated from 16.2.6 to 16.4.2; compatible
  transitive dependency security updates are included. No forced downgrade or
  lint-rule suppression was applied.

## Verification

- `npm run test:security`: 16 offline tests pass (upstream fetches mocked).
- `node --check worker.js`: passes.
- `npm exec --no -- eslint worker.js security-headers.mjs tests/worker-security.test.mjs eslint.config.mjs`: passes.
- `npm run build`: passes, including TypeScript checks and static export.
- `wrangler deploy --dry-run`: passes, finds the ASSETS binding and output.
- Local `wrangler dev --local`: home/report JSON return 200, missing assets and
  rejected proxies return 404, unsupported proxy POST returns 405. Actual static
  and dynamic responses contain the expected security headers. Local test
  process was stopped afterwards.
- `npm audit --omit=dev --registry=https://registry.npmjs.org`: 0 vulnerabilities.
- Full audit: 5 high-severity dependency entries remain in the development-only
  chain `eslint-config-next -> @next/eslint-plugin-next -> fast-glob ->
  micromatch -> braces`. These are not five independent deployed exploits.
  The current compatible upstream has no fix; do not run `audit fix --force`
  (it proposes downgrading eslint-config-next to 14.x).
- Full `npm run lint`: FAILS with 29 errors in unchanged React UI/hook source.
  No `src/` file was changed or rules disabled. The owner explicitly accepted
  leaving these business-code lint errors out of this security-only release;
  targeted security lint/build passing does not make full lint pass.
- Authenticated database inspection, remote vulnerability scanning, and browser
  interaction/visual acceptance are outside this release's verification.

## Remaining account/infrastructure work

1. Cloudflare: set minimum TLS 1.2. Introduce HSTS with a short max-age first;
   verify HTTPS across subdomains before includeSubDomains or preload. No HSTS
   preload or long-lived policy is silently introduced by this patch.
2. Cloudflare + registrar: enable DNSSEC signing and publish the matching DS
   record at Namecheap; verify the chain before considering it complete.
3. Configure edge rate limits for public proxy routes. CORS removal and endpoint
   allowlists are NOT authentication and do not stop scripted same-origin
   requests. No misleading in-memory per-isolate rate limiter was added.
4. The Worker-to-VPS hop still uses existing plain HTTP on port 8080. Configure
   verified HTTPS and, if needed, server-side authentication on the VPS before
   changing this URL. The upstream VPS itself must enforce its own restrictions:
   Worker validation does not protect directly reachable VPS endpoints.
5. `/vps/stats` intentionally remains a PUBLIC statistics endpoint to preserve
   existing behavior. Review exposed fields or disable it if these statistics
   should be private. The version probe no longer exposes upstream topology.
6. Confirm live Supabase RLS, grants, and all policies, especially any `todos`
   table. A frontend `.eq(user_id, ...)` filter is not an authorization boundary.
   The repository's user_prefs policy scopes rows to auth.uid(); now_playing is
   designed for public reads and service-role-only writes. That does not prove
   these scripts match live policies, and other permissive policies may coexist.
   No anonymous writes or destructive SQL probes were attempted.

A database owner may run this READ-ONLY metadata inspection in the SQL editor
without sharing credentials or table rows:

```sql
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p');

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public';

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated');
```

Review results before changing policies; policy/grant edits can break legitimate
clients. For now_playing, anonymous SELECT is intentional, but anonymous writes
should not be permitted. Private rows must be scoped on both reads and writes.
Never expose a service-role key or bridge push token in frontend/public files.

## Deployment acceptance checklist

The owner authorized the security-only rollout while deferring the business-code
lint errors and unresolved development-only advisories. Before claiming the
production website is updated:

- Run tests, build, audit, lint, and deployment dry-run again from this branch.
- Deploy without copying any `.env`, credentials, or old build directory.
- Verify security headers on both apex and www, HTML, JSON, 404, and proxy errors.
- Confirm supported API reads, music/lyrics, login return, and embedded player
  behavior; review CSP report-only console messages before tightening policies.
- Recheck the public TLS/DNS configuration independently. Local tests do not
  validate production Cloudflare rules or database isolation.

References:
- https://developers.cloudflare.com/workers/static-assets/routing/headers/
- https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
- https://nextjs.org/docs/app/guides/static-exports
