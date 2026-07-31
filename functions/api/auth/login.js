import { randomId, setCookie } from '../../_lib.js';

export async function onRequestGet({ request, env }) {
  const clientId = String(env.GITHUB_CLIENT_ID || '').trim();
  if (!/^Ov23[A-Za-z0-9]+$/.test(clientId)) {
    return new Response(
      'Pulse OAuth is not configured correctly. Check GITHUB_CLIENT_ID in Cloudflare. GitHub OAuth client IDs normally begin with capital O followed by v23.',
      {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
        },
      },
    );
  }

  const url = new URL(request.url);
  const state = randomId(24);
  const redirectUri = `${url.origin}/api/auth/callback`;
  const authorizeUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl,
      'Set-Cookie': setCookie('pulse_oauth_state', state, { maxAge: 600, sameSite: 'Lax' }),
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
