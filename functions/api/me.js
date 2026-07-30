import { jsonResponse, ghHeaders } from '../_lib.js';
import { resolveSession } from '../_session.js';

export async function onRequestGet({ request, env }) {
  const { token, reason } = await resolveSession(request, env);
  if (!token) return jsonResponse({ authenticated: false, reason: reason || 'no_session' }, 401);
  const res = await fetch('https://api.github.com/user', { headers: ghHeaders(token) });
  if (!res.ok) return jsonResponse({ authenticated: false, reason: res.status === 401 ? 'expired_authentication' : 'unknown_error' }, 401);
  const user = await res.json();
  return jsonResponse({ authenticated: true, user: { login: user.login, name: user.name, avatar_url: user.avatar_url }, syncedAt: Date.now() });
}
