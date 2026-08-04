import pool from './db.js';
import { applyCors, json, errorResponse, readBody } from './_helpers.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.end();
  if (req.method !== 'POST') return errorResponse(res, 'Method not allowed', 405);

  const body = await readBody(req);
  if (!body) return errorResponse(res, 'Invalid request body', 400);

  const startupId = typeof body.startup_id === 'string' ? body.startup_id : '';
  const kind = typeof body.kind === 'string' ? body.kind : '';
  if (!startupId || !['impression', 'click'].includes(kind)) {
    return errorResponse(res, 'startup_id and kind (impression|click) are required', 400);
  }

  const [rows] = await pool.execute('SELECT id FROM startups WHERE id = ?', [startupId]);
  if (rows.length === 0) return errorResponse(res, 'Startup not found', 404);

  const fields = ['startup_id', 'kind'];
  const values = [startupId, kind];
  for (const f of ['country', 'country_code', 'city', 'device', 'referrer']) {
    const v = body[f];
    if (typeof v === 'string' && v.length > 0 && v.length < 100) {
      fields.push(f);
      values.push(v);
    }
  }

  const columns = fields.join(', ');
  const placeholders = fields.map(() => '?').join(', ');

  try {
    await pool.execute(
      `INSERT INTO events (${columns}, created_at) VALUES (${placeholders}, NOW())`,
      values,
    );
    return json(res, { ok: true }, 202);
  } catch {
    return errorResponse(res, 'Could not track event', 500);
  }
}
