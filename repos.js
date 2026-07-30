
import { jsonResponse } from '../_lib.js';
import { resolveSession } from '../_session.js';
import { getAuthorizedRepos } from '../_authorized-repos.js';

export async function onRequestGet({ request, env }) {
  const { token, reason } = await resolveSession(request, env);
  if (!token) return jsonResponse({ error: reason || 'not_authenticated' }, 401);
  const { repos, error } = await getAuthorizedRepos(token);
  if (error) return jsonResponse({ error: error.code, message: error.message }, 502);
  return jsonResponse({ repos, syncedAt: Date.now() });
}
