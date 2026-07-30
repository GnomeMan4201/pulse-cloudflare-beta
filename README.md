# Pulse — iPhone-only deployment guide

Two independent deployments, both from Safari, no terminal:
- **GitHub Pages** — Investigation Mode only (no login). Keep this running; don't touch it during Owner Mode setup.
- **Cloudflare Pages** — full app, including Owner Mode (sign-in, traffic, private repos you select).

## 0. Preserve the existing GitHub Pages deployment
Don't delete or modify your current Pages-hosted repo/branch. Cloudflare Pages will be a **separate** deployment of the same source — if anything goes wrong, your GitHub Pages URL keeps working untouched (rollback = just keep using it).

## 1. Upload the full directory to a GitHub repo
Include every file and folder, especially `functions/` (Cloudflare needs this folder structure intact — don't flatten it):
`index.html, manifest.json, sw.js, _headers, icon-192.png, icon-512.png, icon-180.png, functions/` (with all its subfolders).

On github.com: **Add file → Upload files** → drag/select everything (use the Files app on iPhone to pick multiple, or upload the project zip and let GitHub's "upload zip" flow — if unavailable, upload the folder contents one screen at a time; GitHub's uploader accepts nested folders from Safari's file picker).

## 2. Create the GitHub App
1. github.com → avatar → **Settings → Developer settings → GitHub Apps → New GitHub App**.
2. Name: `Pulse Analytics` (must be globally unique).
3. Homepage URL: placeholder for now (fix in step 4 once you know your `.pages.dev` domain).
4. **Callback URL**: placeholder for now, same reason — must become `https://<project>.pages.dev/api/auth/callback` exactly.
5. Check **Request user authorization (OAuth) during installation**.
6. Check **Expire user authorization tokens** (this is what enables refresh tokens).
7. Webhook: uncheck "Active".
8. Repository permissions — set exactly per `PERMISSIONS.md`:
   - Metadata: Read-only
   - Contents: Read-only
   - Issues: Read-only
   - Pull requests: Read-only
   - Actions: Read-only
   - Administration: Read-only (required specifically for traffic/views/clones/referrers/popular-content — see `PERMISSIONS.md` for the verified mapping)
9. "Where can this GitHub App be installed?" → **Only on this account**.
10. Create GitHub App. Copy the **Client ID**. Click **Generate a new client secret**, copy it now (shown once).
11. **Install App** → **Only select repositories** → choose exactly which repos Owner Mode may see.

## 3. Generate your session-encryption secret
Open `generate-secret.html` (this file, in Safari) → tap Generate → copy the value. This becomes `SESSION_SECRET`.

## 4. Create the Cloudflare Pages project
1. dash.cloudflare.com → sign up/in → **Workers & Pages → Create → Pages → Connect to Git**.
2. Authorize Cloudflare's GitHub connector, select this repository.
3. Build settings: Framework preset **None**, Build command **(empty)**, Output directory `/`.
4. Deploy once (it will 500 on `/api/*` until secrets + KV are set — expected).

## 5. Create the KV namespace and bind it
1. Cloudflare dashboard → **Workers & Pages → KV → Create a namespace** → name it `PULSE_SESSIONS`.
2. Go to your Pages project → **Settings → Functions → KV namespace bindings → Add binding**.
3. Variable name: `PULSE_SESSIONS` → select the namespace you just created. Save.

## 6. Add environment variables (encrypted secrets)
Pages project → **Settings → Environment variables** → add for **Production** (and Preview, if you use it):
| Name | Value |
|---|---|
| `GITHUB_CLIENT_ID` | from step 2.10 |
| `GITHUB_CLIENT_SECRET` | from step 2.10 — click "Encrypt" |
| `SESSION_SECRET` | from step 3 — click "Encrypt" |

Save, then **Deployments → Retry deployment** (or push any small change) so the new bindings/vars take effect.

## 7. Fix the callback URL
Your app is now live at `https://<project>.pages.dev`. Go back to the GitHub App settings (step 2.3/2.4) and set the real Homepage URL and **Callback URL**: `https://<project>.pages.dev/api/auth/callback`. Save.

## 8. Test OAuth end-to-end
1. Visit the Cloudflare URL. Investigation Mode should look and work identically to the GitHub Pages version.
2. Tap **Owner** tab → **Sign in with GitHub** → approve the install/authorization screen → you're redirected back signed in.
3. Confirm the permission chips shown match `PERMISSIONS.md`.

## 9. Verify traffic permissions
- Pick one of your authorized repos in the Owner tab.
- If it shows real numbers: Administration: Read-only was sufficient, as documented.
- If it shows "temporarily unavailable" with a permission reason: check that response's `acceptedPermissions` field (visible via Safari's page source / dev tools if you have them, or ask to inspect it) — that's GitHub's own authoritative answer for your App version; adjust the App's permissions to match and reinstall.

## 10. Sign out / revoke access
- Tap **Sign out** in the Owner tab. This calls `/api/auth/logout`, which revokes the GitHub token via GitHub's API, deletes the server-side KV session, clears the session cookie, and purges any lingering Service Worker caches.
- To fully revoke independent of Pulse: github.com → Settings → Applications → Authorized GitHub Apps → Pulse Analytics → Revoke.

## Rollback
Nothing about this deployment touches your existing GitHub Pages site. If Cloudflare Pages misbehaves, simply stop using that URL — GitHub Pages Investigation Mode is unaffected and always available as a fallback.
