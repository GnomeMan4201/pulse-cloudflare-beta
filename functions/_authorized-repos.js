import { ghHeaders, classifyGithubFailure } from './_lib.js';

export async function getAuthorizedRepos(token) {
  const headers = ghHeaders(token);
  let installations = [];
  let page = 1;
  while (page <= 10) {
    const res = await fetch(`https://api.github.com/user/installations?per_page=100&page=${page}`, { headers });
    if (!res.ok) return { repos: null, error: classifyGithubFailure(res) };
    const data = await res.json();
    installations = installations.concat(data.installations || []);
    if (!data.installations || data.installations.length < 100) break;
    page++;
  }

  const repos = [];
  for (const inst of installations) {
    let rpage = 1;
    while (rpage <= 20) {
      const rRes = await fetch(`https://api.github.com/user/installations/${inst.id}/repositories?per_page=100&page=${rpage}`, { headers });
      if (!rRes.ok) break;
      const rData = await rRes.json();
      (rData.repositories || []).forEach((r) => repos.push({ full_name: r.full_name, name: r.name, private: r.private }));
      if (!rData.repositories || rData.repositories.length < 100) break;
      rpage++;
    }
  }
  return { repos, error: null };
}
