# Security changelog — remediation pass

## Critical
- **Service worker data leak (fixed):** `sw.js` rewritten (`pulse-static-v2`). Bypasses every `/api/*` request unconditionally, refuses to cache anything with `Authorization` on the request or `Set-Cookie` on the response, caches only the explicit static-asset list, deletes all old-versioned caches (including `pulse-v1`) on activation, and accepts a `purge-legacy-caches` message the frontend sends on logout.
- **Token refresh (fixed):** New `functions/_session.js`. Cookie (`pulse_sid`) now holds only a random session ID. Access token, refresh token, and their expiries are stored server-side in Cloudflare KV (`PULSE_SESSIONS`), encrypted at rest with AES-GCM under `SESSION_SECRET`. Access tokens are refreshed automatically ~60s before expiry using the GitHub refresh token; if refresh fails or the refresh token itself has expired, the session is deleted and the client is forced back to sign-in (`reason: expired_authentication`). Sessions carry both an absolute cap (30 days) and a sliding idle timeout (7 days).

## High priority
1. Every JSON API response now carries `Cache-Control: no-store, private`, `Pragma: no-cache`, `Vary: Cookie`, `X-Content-Type-Options: nosniff` (`_lib.js` `SECURITY_HEADERS`, applied in `jsonResponse` and reinforced by `_middleware.js`).
2. `isValidRepoFullName()` enforces a strict `owner/repo` pattern before any repo identifier reaches a GitHub API URL.
3. `/api/traffic` and `/api/owner-actions` no longer trust any repo list from the client — both resolve the authorized (installed) repo set server-side via `_authorized-repos.js` and reject anything outside it (`403 not_authorized`).
4. `_authorized-repos.js` paginates both `/user/installations` and `/user/installations/{id}/repositories` (up to reasonable safety caps) instead of assuming a single page.
5. `classifyGithubFailure()` replaces every silent `catch (e) { return [] }` with a structured `{code, message}` distinguishing `rate_limited`, `missing_permission`, `expired_authentication`, `processing_delay`, `network_failure`, `unknown_error` from a genuine empty result (`empty: true`).
6. `/api/owner-issues` is explicitly labeled `scope: "account-wide"` in its response and in the UI copy — GitHub's Search API has no installation-scoping mechanism, so this is disclosed rather than misrepresented.
7. Outbound GitHub requests now send `X-GitHub-Api-Version`, a `User-Agent`; responses' rate-limit headers and `X-GitHub-Request-Id` are captured into `ghMeta()`; permission failures surface `X-Accepted-GitHub-Permissions` verbatim.
8. `checkOrigin()` validates the `Origin` header against the request host before `POST /api/auth/logout` executes.
9. The OAuth state cookie is cleared on both the success and failure branches of `/api/auth/callback`.
10. `_headers` (static assets) and `_middleware.js` (Functions) add `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy`, `X-Content-Type-Options: nosniff`, and a CSP with `frame-ancestors 'none'`.

## Permission correction
- Removed the unverified claim that "Administration read alone" was assumed without checking. `PERMISSIONS.md` now documents the endpoint-by-endpoint mapping and instructs operators to treat the live `X-Accepted-GitHub-Permissions` header (now surfaced in every traffic error) as authoritative over any static doc.

## Explicitly NOT claimed as done
- Not load-tested under real GitHub rate limits — the classification logic is implemented and unit-reasoned but not exercised against a live 403 rate-limit response in this pass.
- KV eventual-consistency edge cases (race between two rapid refreshes in different colos) are mitigated by short TTLs but not exhaustively tested.
- No automated test suite ships with this pass — verification is manual per the checklist below.
