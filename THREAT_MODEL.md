# Pulse — threat model

## Assets
- GitHub user access/refresh tokens (Owner Mode)
- Session identifiers (cookie)
- Private repository metadata the user has explicitly authorized
- GitHub App client secret, session-encryption secret

## Trust boundaries
- Browser (untrusted) ↔ Cloudflare Pages Functions (trusted, holds secrets) ↔ GitHub API
- Service worker cache (browser-controlled, must never hold secrets or authenticated data)

## Threats considered & mitigations
| Threat | Mitigation |
|---|---|
| Token exfiltration via XSS reading localStorage/cookies | Tokens never leave the server; cookie holds only a random session ID, HttpOnly so JS can't read it |
| Token exfiltration via Service Worker cache | `sw.js` bypasses all `/api/` requests unconditionally, refuses to cache any response carrying `Set-Cookie`, refuses requests carrying `Authorization` |
| Stale legacy cached API data after logout | Logout instructs the SW (`postMessage`) to purge every cache except the current static-asset cache; SW `activate` also deletes all non-current caches, including the old `pulse-v1` |
| CSRF on logout / state-changing routes | `Origin` header validated against request host before honoring `POST /api/auth/logout` |
| OAuth CSRF / authorization-code injection | Random `state` stored in a short-lived HttpOnly cookie, compared on callback; cleared on both success and failure |
| Session fixation / long-lived compromised session | Sessions have both an absolute cap (30 days) and an idle timeout (7 days); access tokens are refreshed server-side and never handed to the client |
| Privilege escalation via frontend-supplied repo names | `/api/traffic` and `/api/owner-actions` resolve the authorized repo set from GitHub's own installation API server-side and reject any repo not in that set; repo identifiers are validated against a strict `owner/repo` pattern before use in any URL |
| Confusing a rate-limit/permission failure for "zero activity" | Every GitHub call classifies failures into explicit codes (`rate_limited`, `missing_permission`, `expired_authentication`, `processing_delay`, `network_failure`, `unknown_error`) instead of collapsing to `[]` or `0` |
| Secrets committed to the repo | `GITHUB_CLIENT_SECRET` and `SESSION_SECRET` live only as encrypted Cloudflare Pages environment variables; nothing sensitive is in `functions/` source or the static bundle |
| Clickjacking / MIME sniffing / referrer leakage | `_headers` sets CSP `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`; Functions middleware applies the same to API responses |

## Out of scope / accepted residual risk
- GitHub's own Search API cannot be scoped to an installation's repo subset — `owner-issues` results are account-wide by GitHub's design; this is disclosed in the API response (`scope`) and the UI copy, not hidden.
- Cloudflare KV is eventually consistent across regions (rare stale read for a few seconds after a token refresh) — acceptable for this use case; a hard failure just forces a repeat sign-in, never a security downgrade.
