
import { getCookie, setCookie } from '../../_lib.js';
import { createSession, setSessionCookie } from '../../_session.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const savedState = getCookie(request, 'pulse_oauth_state');
  const headers = new Headers({ 'Referrer-Policy': 'no-referrer' });
  // Clear the one-time OAuth state cookie on both success and failure paths.
  headers.append('Set-Cookie', setCookie('pulse_oauth_state', '', { expirePast: true }));

  if (!code || !state || !savedState || state !== savedState) {
    headers.set('Content-Type', 'text/plain');
    return new Response('OAuth state validation failed. Please try signing in again.', { status: 400, headers });
  }

  const redirectUri = `${url.origin}/api/auth/callback`;
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: redirectUri }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    headers.set('Content-Type', 'text/plain');
    return new Response('GitHub sign-in failed: ' + (tokenData.error_description || 'no token returned'), { status: 400, headers });
  }

  const sid = await createSession(env, {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || null,
    expiresIn: tokenData.expires_in,
    refreshExpiresIn: tokenData.refresh_token_expires_in,
  });
  setSessionCookie(headers, sid);
  headers.set('Location', `${url.origin}/?owner=1`);
  return new Response(null, { status: 302, headers });
}
