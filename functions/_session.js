import { getCookie, setCookie, encryptToken, decryptToken, randomId } from './_lib.js';

const SESSION_COOKIE = 'pulse_sid';
const IDLE_TTL_SECONDS = 60 * 60 * 24 * 7;
const ABSOLUTE_TTL_SECONDS = 60 * 60 * 24 * 30;

export function sessionCookieName() { return SESSION_COOKIE; }

export async function createSession(env, { accessToken, refreshToken, expiresIn, refreshExpiresIn }) {
  const sid = randomId(32);
  const now = Date.now();
  const record = {
    accessTokenEnc: await encryptToken(accessToken, env.SESSION_SECRET),
    refreshTokenEnc: refreshToken ? await encryptToken(refreshToken, env.SESSION_SECRET) : null,
    accessExpiresAt: now + Math.max(60, (expiresIn || 28800)) * 1000,
    refreshExpiresAt: refreshToken ? now + Math.max(3600, (refreshExpiresIn || ABSOLUTE_TTL_SECONDS)) * 1000 : null,
    absoluteExpiresAt: now + ABSOLUTE_TTL_SECONDS * 1000,
    idleExpiresAt: now + IDLE_TTL_SECONDS * 1000,
    createdAt: now,
  };
  await env.PULSE_SESSIONS.put(sid, JSON.stringify(record), { expirationTtl: ABSOLUTE_TTL_SECONDS });
  return sid;
}

export function setSessionCookie(headers, sid) {
  headers.append('Set-Cookie', setCookie(SESSION_COOKIE, sid, { maxAge: ABSOLUTE_TTL_SECONDS, sameSite: 'Lax' }));
}
export function clearSessionCookie(headers) {
  headers.append('Set-Cookie', setCookie(SESSION_COOKIE, '', { expirePast: true }));
}

async function refreshGithubToken(env, refreshTokenEnc) {
  const refreshToken = await decryptToken(refreshTokenEnc, env.SESSION_SECRET);
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.access_token) return null;
  return data;
}

export async function resolveSession(request, env) {
  const sid = getCookie(request, SESSION_COOKIE);
  if (!sid) return { token: null, reason: 'no_session' };
  const raw = await env.PULSE_SESSIONS.get(sid);
  if (!raw) return { token: null, reason: 'no_session' };
  let record;
  try { record = JSON.parse(raw); } catch (e) { return { token: null, reason: 'no_session' }; }

  const now = Date.now();
  if (now > record.absoluteExpiresAt || now > record.idleExpiresAt) {
    await env.PULSE_SESSIONS.delete(sid);
    return { token: null, reason: 'expired_authentication' };
  }

  let accessTokenEnc = record.accessTokenEnc;
  let changed = false;

  if (now > record.accessExpiresAt - 60000) {
    if (!record.refreshTokenEnc || (record.refreshExpiresAt && now > record.refreshExpiresAt)) {
      await env.PULSE_SESSIONS.delete(sid);
      return { token: null, reason: 'expired_authentication' };
    }
    const refreshed = await refreshGithubToken(env, record.refreshTokenEnc);
    if (!refreshed) {
      await env.PULSE_SESSIONS.delete(sid);
      return { token: null, reason: 'expired_authentication' };
    }
    accessTokenEnc = await encryptToken(refreshed.access_token, env.SESSION_SECRET);
    record.accessTokenEnc = accessTokenEnc;
    record.accessExpiresAt = now + Math.max(60, (refreshed.expires_in || 28800)) * 1000;
    if (refreshed.refresh_token) {
      record.refreshTokenEnc = await encryptToken(refreshed.refresh_token, env.SESSION_SECRET);
      record.refreshExpiresAt = now + Math.max(3600, (refreshed.refresh_token_expires_in || 60 * 60 * 24 * 30)) * 1000;
    }
    changed = true;
  }

  const newIdle = Math.min(now + IDLE_TTL_SECONDS * 1000, record.absoluteExpiresAt);
  if (newIdle - record.idleExpiresAt > 5 * 60 * 1000) { record.idleExpiresAt = newIdle; changed = true; }

  if (changed) {
    const ttl = Math.max(60, Math.floor((record.absoluteExpiresAt - now) / 1000));
    await env.PULSE_SESSIONS.put(sid, JSON.stringify(record), { expirationTtl: ttl });
  }

  const token = await decryptToken(accessTokenEnc, env.SESSION_SECRET);
  return { token, sid, reason: null };
}

export async function destroySession(request, env) {
  const sid = getCookie(request, SESSION_COOKIE);
  if (sid) await env.PULSE_SESSIONS.delete(sid);
}
