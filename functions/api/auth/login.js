import { randomId, setCookie } from '../../_lib.js';
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const state = randomId(24);
  const redirectUri = `${url.origin}/api/auth/callback`;
  const authorizeUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl,
      'Set-Cookie': setCookie('pulse_oauth_state', state, { maxAge: 600, sameSite: 'Lax' }),
      'Referrer-Policy': 'no-referrer',
    },
  });
}
