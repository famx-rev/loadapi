import { randomUUID } from 'crypto';
import pool from './db.js';
import { json, errorResponse, requireUser, validateProfile } from './_helpers.js';

export async function create(req, res) {
  const userId = await requireUser(req, res);
  if (!userId) return;

  const body = req.body;
  if (!body) return errorResponse(res, 'Invalid request body', 400);

  const result = validateProfile(body);
  if (result.error) return errorResponse(res, result.error, 400);

  const id = randomUUID();
  const { name, domain, tagline, url, accent_from, accent_to } = result.data;

  try {
    await pool.execute(
      `INSERT INTO startups (id, owner_id, name, domain, tagline, url, accent_from, accent_to, verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, false, NOW(), NOW())`,
      [id, userId, name, domain, tagline, url, accent_from, accent_to],
    );
    const [rows] = await pool.execute('SELECT * FROM startups WHERE id = ?', [id]);
    return json(res, { startup: rows[0] }, 201);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return errorResponse(res, 'That domain is already taken by another startup', 409);
    }
    return errorResponse(res, 'Could not create startup', 500);
  }
}

export async function getOne(req, res) {
  const startupId = req.params.id;
  if (!startupId) return errorResponse(res, 'Missing startup id', 400);

  try {
    const [rows] = await pool.execute('SELECT * FROM startups WHERE id = ?', [startupId]);
    if (rows.length === 0) return errorResponse(res, 'Startup not found', 404);
    return json(res, { startup: rows[0] });
  } catch {
    return errorResponse(res, 'Could not load startup', 500);
  }
}

export async function update(req, res) {
  const userId = await requireUser(req, res);
  if (!userId) return;

  const startupId = req.params.id;
  if (!startupId) return errorResponse(res, 'Missing startup id', 400);

  const [existing] = await pool.execute(
    'SELECT id, owner_id FROM startups WHERE id = ?',
    [startupId],
  );
  if (existing.length === 0) return errorResponse(res, 'Startup not found', 404);
  if (existing[0].owner_id !== userId) return errorResponse(res, 'Not authorized', 403);

  const body = req.body;
  if (!body) return errorResponse(res, 'Invalid request body', 400);

  const result = validateProfile(body);
  if (result.error) return errorResponse(res, result.error, 400);

  const { name, domain, tagline, url, accent_from, accent_to } = result.data;

  try {
    await pool.execute(
      `UPDATE startups SET name = ?, domain = ?, tagline = ?, url = ?, accent_from = ?, accent_to = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, domain, tagline, url, accent_from, accent_to, startupId],
    );
    const [rows] = await pool.execute('SELECT * FROM startups WHERE id = ?', [startupId]);
    return json(res, { startup: rows[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return errorResponse(res, 'That domain is already taken', 409);
    return errorResponse(res, 'Could not update startup', 500);
  }
}

export async function deleteStartup(req, res) {
  const userId = await requireUser(req, res);
  if (!userId) return;

  const startupId = req.params.id;
  if (!startupId) return errorResponse(res, 'Missing startup id', 400);

  const [existing] = await pool.execute(
    'SELECT id, owner_id FROM startups WHERE id = ?',
    [startupId],
  );
  if (existing.length === 0) return errorResponse(res, 'Startup not found', 404);
  if (existing[0].owner_id !== userId) return errorResponse(res, 'Not authorized', 403);

  try {
    await pool.execute('DELETE FROM startups WHERE id = ?', [startupId]);
    return json(res, { ok: true });
  } catch {
    return errorResponse(res, 'Could not delete startup', 500);
  }
}

export default { create, getOne, update, delete: deleteStartup };
