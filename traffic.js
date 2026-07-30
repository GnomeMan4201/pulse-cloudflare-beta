
import { jsonResponse, ghHeaders, ghMeta, classifyGithubFailure, isValidRepoFullName } from '../_lib.js';
import { resolveSession } from '../_session.js';
import { getAuthorizedRepos } from '../_authorized-repos.js';

// Permission-to-endpoint mapping (see PERMISSIONS.md): traffic/views and traffic/clones require
// Administration: Read-only on the repository per GitHub App permission docs; referrers/paths ride
// the same permission. This is verified against GitHub's REST API reference for the traffic endpoints,
// not assumed from Contents/Metadata alone.
export async function onRequestGet({ request, env }) {
  const { token, reason } = await resolveSession(request, env);
  if (!token) return jsonResponse({ error: reason || 'not_authenticated' }, 401);

  const url = new URL(request.url);
  const fullName = url.searchParams.get('repo');
  if (!fullName || !isValidRepoFullName(fullName)) return jsonResponse({ error: 'invalid_repo', message: 'Repository must match owner/repo format.' }, 400);

  const { repos, error: authError } = await getAuthorizedRepos(token);
  if (authError) return jsonResponse({ error: authError.code, message: authError.message }, 502);
  if (!repos.some((r) => r.full_name === fullName)) {
    return jsonResponse({ error: 'not_authorized', message: 'This repository is not in your authorized GitHub App installation.' }, 403);
  }

  const headers = ghHeaders(token);
  const endpoints = ['views', 'clones', 'popular/referrers', 'popular/paths'];
  const results = {};
  let meta = null;
  for (const ep of endpoints) {
    try {
      const r = await fetch(`https://api.github.com/repos/${fullName}/traffic/${ep}`, { headers });
      meta = ghMeta(r);
      if (r.ok) {
        const body = await r.json();
        const isEmpty = Array.isArray(body) ? body.length === 0 : (Array.isArray(body.views) && body.views.length === 0) || (Array.isArray(body.clones) && body.clones.length === 0);
        results[ep] = isEmpty ? { ...body, unavailable: false, empty: true } : { ...body, unavailable: false };
      } else {
        results[ep] = { unavailable: true, ...classifyGithubFailure(r) };
      }
    } catch (e) {
      results[ep] = { unavailable: true, ...classifyGithubFailure(null) };
    }
  }
  return jsonResponse({ repo: fullName, coverage: 'last 14 days (GitHub traffic API window)', data: results, githubMeta: meta, syncedAt: Date.now() });
}
