export async function onRequest({ request, next }) {
  const res = await next();
  const headers = new Headers(res.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store, private');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
