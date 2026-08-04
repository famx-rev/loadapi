const AUTH_BASE =
  'https://api-eight-navy-68.vercel.app/api/authx/cb705c5d-4e34-491d-91c0-e795d7b7da10/user';

export function json(res, body, status = 200) {
  return res.status(status).json(body);
}

export function errorResponse(res, message, status) {
  return res.status(status).json({ error: message });
}

export function getAuthHeader(req) {
  const auth = req.headers.authorization;
  if (!auth) return null;
  return auth.replace(/^Bearer\s+/i, '').trim() || null;
}

export async function fetchMe(token) {
  try {
    const r = await fetch(`${AUTH_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const data = await r.json().catch(() => null);
    if (!data || typeof data !== 'object') return null;
    const src = data.user || data.data || data.profile || data;
    return src.id || src._id || src.userId || src.user_id || null;
  } catch {
    return null;
  }
}

export async function requireUser(req, res) {
  const token = getAuthHeader(req);
  if (!token) {
    errorResponse(res, 'Authentication required', 401);
    return null;
  }
  const userId = await fetchMe(token);
  if (!userId) {
    errorResponse(res, 'Invalid or expired token', 401);
    return null;
  }
  return userId;
}

export function normalizeUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export function validateProfile(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const domain = typeof body.domain === 'string' ? body.domain.trim() : '';
  const tagline = typeof body.tagline === 'string' ? body.tagline.trim() : '';
  const url = typeof body.url === 'string' ? normalizeUrl(body.url) : '';

  if (!name || name.length > 60) return { error: 'Name is required (max 60 characters)' };
  if (!domain || domain.length > 100) return { error: 'Domain is required (max 100 characters)' };
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(domain)) {
    return { error: 'Enter a valid domain (e.g. acme.ai)' };
  }
  if (!tagline || tagline.length > 120) return { error: 'Tagline is required (max 120 characters)' };
  if (!url || url.length > 300) return { error: 'A valid URL is required' };

  const accent_from = typeof body.accent_from === 'string' ? body.accent_from : '#3dd79e';
  const accent_to = typeof body.accent_to === 'string' ? body.accent_to : '#0b9a6c';

  return { data: { name, domain, tagline, url, accent_from, accent_to } };
}
