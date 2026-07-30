import { jsonResponse, ghHeaders, classifyGithubFailure } from '../_lib.js';
import { resolveSession } from '../_session.js';
import { getAuthorizedRepos } from '../_authorized-repos.js';

export async function onRequestGet({ request, env }) {
  const { token, reason } = await resolveSession(request, env);
  if (!token) return jsonResponse({ error: reason || 'not_authenticated' }, 401);
  const { repos, error } = await getAuthorizedRepos(token);
  if (error) return jsonResponse({ error: error.code, message: error.message }, 502);

  const headers = ghHeaders(token);
  const runs = [];
  const perRepoStatus = {};
  for (const repo of repos.slice(0, 15)) {
    try {
      const r = await fetch(`https://api.github.com/repos/${repo.full_name}/actions/runs?per_page=5`, { headers });
      if (!r.ok) { perRepoStatus[repo.full_name] = classifyGithubFailure(r); continue; }
      const data = await r.json();
      perRepoStatus[repo.full_name] = { unavailable: false };
      (data.workflow_runs || []).forEach((run) => {
        if (run.status !== 'completed' || run.conclusion === 'failure') {
          runs.push({ repo: repo.full_name, name: run.name, status: run.status, conclusion: run.conclusion, html_url: run.html_url, updated_at: run.updated_at });
        }
      });
    } catch (e) { perRepoStatus[repo.full_name] = classifyGithubFailure(null); }
  }
  return jsonResponse({ runs, perRepoStatus, syncedAt: Date.now() });
}
