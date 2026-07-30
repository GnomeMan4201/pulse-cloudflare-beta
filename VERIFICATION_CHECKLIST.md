# Post-deployment verification checklist

- [ ] GitHub Pages URL still loads Investigation Mode unaffected
- [ ] Cloudflare Pages URL loads Investigation Mode identically to Pages
- [ ] `/api/me` returns 401 with `reason` when signed out (not a crash)
- [ ] Sign-in redirects to GitHub, approves, redirects back signed in
- [ ] OAuth state mismatch (e.g. reloading an old callback URL) shows the state-validation error, not a silent failure
- [ ] Session cookie (`pulse_sid`) is HttpOnly + Secure + SameSite=Lax (inspect via Safari's "Show Page Source" won't reveal it — that's expected; confirm via response headers if you have dev tools)
- [ ] No `GITHUB_CLIENT_SECRET` or `SESSION_SECRET` value appears anywhere in the deployed frontend JS or HTML (view-source check)
- [ ] Traffic tab shows real numbers or an explicit "temporarily unavailable" reason — never a silently blank 0
- [ ] Selecting a repo NOT in your GitHub App installation via a hand-edited URL returns 403 `not_authorized`, not data
- [ ] Sign out clears the session (reload → Owner tab shows signed-out state again)
- [ ] After sign out, browser DevTools → Application → Cache Storage shows only the current `pulse-static-v2` cache, no lingering API entries
- [ ] Waiting past the access-token lifetime (or forcing it) still works transparently via refresh — Owner Mode doesn't bounce you to sign-in every 8 hours
- [ ] Revoking the app from github.com/settings/applications forces Pulse back to signed-out state on next load
- [ ] `_headers` security headers present on the deployed static response (view-source or response headers)
- [ ] KV namespace `PULSE_SESSIONS` bound in Cloudflare Pages Functions settings — without it, all `/api/*` calls 500
