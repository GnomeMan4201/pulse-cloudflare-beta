import { onRequestGet as login } from './functions/api/auth/login.js';
import { onRequestGet as callback } from './functions/api/auth/callback.js';
import { onRequestPost as logout } from './functions/api/auth/logout.js';
import { onRequestGet as me } from './functions/api/me.js';
import { onRequestGet as repos } from './functions/api/repos.js';
import { onRequestGet as traffic } from './functions/api/traffic.js';
import { onRequestGet as ownerActions } from './functions/api/owner-actions.js';
import { onRequestGet as ownerIssues } from './functions/api/owner-issues.js';

const routes = new Map([
  ['GET /api/auth/login', login],
  ['GET /api/auth/callback', callback],
  ['POST /api/auth/logout', logout],
  ['GET /api/me', me],
  ['GET /api/repos', repos],
  ['GET /api/traffic', traffic],
  ['GET /api/owner-actions', ownerActions],
  ['GET /api/owner-issues', ownerIssues],
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const handler = routes.get(`${request.method} ${url.pathname}`);
    if (handler) {
      try {
        return await handler({ request, env, waitUntil: ctx.waitUntil.bind(ctx), next: () => env.ASSETS.fetch(request) });
      } catch (error) {
        console.error('Pulse API route failed', url.pathname, error);
        return new Response(JSON.stringify({ error: 'internal_error', message: 'Pulse could not complete this request.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }
    }

    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
