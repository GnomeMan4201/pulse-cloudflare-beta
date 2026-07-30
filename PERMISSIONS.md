# GitHub App permission → endpoint matrix

Verified against GitHub's REST API reference for each endpoint (permissions listed on each endpoint's docs page) and cross-checked at runtime via the `X-Accepted-GitHub-Permissions` response header, which every function now records into its structured error payload on a 403.

| Data shown in Pulse | Endpoint(s) | Required GitHub App permission | Notes |
|---|---|---|---|
| Repo metadata, languages, topics, license | `GET /repos/{owner}/{repo}` | Metadata: Read-only | Metadata is granted automatically to every installation |
| Issues (public investigation) | `GET /repos/{owner}/{repo}/issues` | Metadata: Read-only (public data, no auth) | Investigation Mode only — unauthenticated |
| Commit activity / releases / contributors | `GET /repos/{o}/{r}/stats/commit_activity`, `/releases`, `/contributors` | Metadata: Read-only | Public, unauthenticated |
| **Traffic: views** | `GET /repos/{o}/{r}/traffic/views` | **Administration: Read-only** | Per GitHub's traffic API docs, the caller must have push access to the repo; for a GitHub App this is exposed under the Administration permission, not Contents or Metadata |
| **Traffic: clones** | `GET /repos/{o}/{r}/traffic/clones` | **Administration: Read-only** | Same as views |
| **Top referrers** | `GET /repos/{o}/{r}/traffic/popular/referrers` | **Administration: Read-only** | Same permission family as views/clones |
| **Popular content (paths)** | `GET /repos/{o}/{r}/traffic/popular/paths` | **Administration: Read-only** | Same permission family |
| Assigned issues / requested reviews / authored PRs | `GET /search/issues` | Issues: Read-only, Pull requests: Read-only | Account-wide search — not filtable to installation repos by GitHub's Search API; labeled in the UI and API response as `scope: account-wide` |
| Actions run status | `GET /repos/{o}/{r}/actions/runs` | Actions: Read-only | Restricted server-side to the installation's authorized repo set |
| Installation repo list | `GET /user/installations`, `/user/installations/{id}/repositories` | (implicit — user-to-server OAuth scope from the App install) | Paginated, drives the authorization allow-list for traffic/Actions |

**Every traffic response now carries `X-Accepted-GitHub-Permissions` verbatim (when GitHub returns it on a 403) inside `data.<endpoint>.acceptedPermissions`** — if GitHub's actual requirement differs from Administration in your account's App version, that field is the authoritative source, not this document.

If a repository owner has NOT granted Administration: Read-only, traffic/referrers/paths return `{unavailable: true, code: "missing_permission", acceptedPermissions: "..."}` per endpoint — never silently zero.
