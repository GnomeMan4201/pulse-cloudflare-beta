
import { jsonResponse, ghHeaders, classifyGithubFailure } from '../_lib.js';
import { resolveSession } from '../_session.js';

// NOTE: these searches are account-wide (GitHub's Search API has no per-installation repo filter),
// scoped only to issues/PRs where the authenticated user is assignee/reviewer/author. The GitHub App
// user-to-server token cannot return data for repositories the user cannot themselves see, but this
// is not limited to the installation's repository selection — surfaced here explicitly.
export async function onRequestGet({ request, env }) {
  const { token, reason } = await resolveSession(request, env);
  if (!token) return jsonResponse({ error: reason || 'not_authenticated' }, 401);
  const headers = ghHeaders(token);
  const meRes = await fetch('https://api.github.com/user', { headers });
  if (!meRes.ok) return jsonResponse({ error: classifyGithubFailure(meRes).code }, 502);
  const me = await meRes.json();

  const queries = {
    assignedIssues: `is:issue is:open assignee:${me.login}`,
    requestedReviews: `is:pr is:open review-requested:${me.login}`,
    authoredOpenPRs: `is:pr is:open author:${me.login}`,
  };
  const out = {};
  const meta = {};
  for (const [key, q] of Object.entries(queries)) {
    try {
      const r = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=10`, { headers });
      if (r.ok) {
        const data = await r.json();
        out[key] = data.items.map((i) => ({ title: i.title, repo: i.repository_url.split('/').slice(-2).join('/'), html_url: i.html_url, updated_at: i.updated_at }));
        meta[key] = { unavailable: false, empty: out[key].length === 0 };
      } else {
        out[key] = [];
        meta[key] = { unavailable: true, ...classifyGithubFailure(r) };
      }
    } catch (e) { out[key] = []; meta[key] = { unavailable: true, ...classifyGithubFailure(null) }; }
  }
  return jsonResponse({ ...out, scope: 'account-wide (not limited to installation-selected repositories)', meta, syncedAt: Date.now() });
}
