
export function b64urlEncode(bytes) {
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
async function deriveKey(secret) {
  const enc = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function encryptToken(plain, secret) {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plain);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc));
  const combined = new Uint8Array(iv.length + cipher.length);
  combined.set(iv, 0); combined.set(cipher, iv.length);
  return b64urlEncode(combined);
}
export async function decryptToken(payload, secret) {
  const key = await deriveKey(secret);
  const combined = b64urlDecode(payload);
  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plainBuf);
}
export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.split(/;\s*/).find((c) => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
export function setCookie(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'Secure', `SameSite=${opts.sameSite || 'Lax'}`];
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.expirePast) parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  return parts.join('; ');
}
export function randomId(bytes = 24) {
  return b64urlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
}

// --- Security headers applied to every API response ---
export const SECURITY_HEADERS = {
  'Cache-Control': 'no-store, private',
  'Pragma': 'no-cache',
  'Vary': 'Cookie',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()',
};

export function jsonResponse(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS, ...extraHeaders } });
}

// Structured "why unavailable" classification — never collapse a real failure into an empty/zero result.
export function classifyGithubFailure(res, body) {
  if (!res) return { code: 'network_failure', message: 'Network error reaching GitHub.' };
  if (res.status === 401) return { code: 'expired_authentication', message: 'Your session with GitHub has expired. Please sign in again.' };
  if (res.status === 202) return { code: 'processing_delay', message: 'GitHub is still calculating this data. Try again shortly.' };
  if (res.status === 403) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining === '0') return { code: 'rate_limited', message: 'GitHub API rate limit reached. Try again after the limit resets.', resetAt: res.headers.get('x-ratelimit-reset') };
    const accepted = res.headers.get('x-accepted-github-permissions');
    return { code: 'missing_permission', message: 'The authorized GitHub App installation does not grant this data.', acceptedPermissions: accepted || null };
  }
  if (res.status === 404) return { code: 'missing_permission', message: 'Not found or not authorized for this repository.' };
  if (res.status === 422) return { code: 'invalid_request', message: 'GitHub rejected the request parameters.' };
  return { code: 'unknown_error', message: `GitHub returned HTTP ${res.status}.` };
}

// Consistent outbound request headers GitHub expects/recommends.
export function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Pulse-Analytics-App',
  };
}

export function ghMeta(res) {
  return {
    rateLimit: { remaining: res.headers.get('x-ratelimit-remaining'), limit: res.headers.get('x-ratelimit-limit'), resetAt: res.headers.get('x-ratelimit-reset') },
    requestId: res.headers.get('x-github-request-id'),
  };
}

export function isValidRepoFullName(name) {
  return typeof name === 'string' && /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})\/[A-Za-z0-9._-]{1,100}$/.test(name);
}

export function checkOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true; // same-origin form posts / non-browser clients without Origin header
  try {
    const o = new URL(origin);
    const self = new URL(request.url);
    return o.host === self.host;
  } catch (e) { return false; }
}
