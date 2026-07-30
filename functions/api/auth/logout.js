import { checkOrigin, jsonResponse } from '../../_lib.js';
import { resolveSession, destroySession, clearSessionCookie } from '../../_session.js';

export async function onRequestPost({ request, env }) {
  if (!checkOrigin(request, env)) {
    return jsonResponse({ ok: false, error: 'origin_check_failed' }, 403);
  }
  const { token } = await resolveSession(request, env);
  if (token) {
    try {
      await fetch(`https://api.github.com/applications/${env.GITHUB_CLIENT_ID}/token`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Basic ' + btoa(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`),
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ access_token: token }),
      });
    } catch (e) {}
  }
  await destroySession(request, env);
  const headers = new Headers({ 'Content-Type': 'application/json' });
  clearSessionCookie(headers);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
