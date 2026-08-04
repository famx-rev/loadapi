import pool from './db.js';
import { applyCors, json, errorResponse } from './_helpers.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.end();
  if (req.method !== 'GET') return errorResponse(res, 'Method not allowed', 405);

  const startupId = req.query.startup_id;
  if (!startupId) return errorResponse(res, 'Missing startup_id', 400);

  const [startupRows] = await pool.execute(
    `SELECT id, name, domain, tagline, url, accent_from, accent_to, verified
     FROM startups WHERE id = ?`,
    [startupId],
  );
  if (startupRows.length === 0) return errorResponse(res, 'Startup not found', 404);

  const startup = startupRows[0];
  const exclude = req.query.exclude;

  let query = `SELECT id, name, domain, tagline, url, accent_from, accent_to, verified
    FROM startups WHERE id != ?`;
  const params = [startupId];

  if (exclude) {
    const excludeIds = exclude.split(',').filter(Boolean);
    if (excludeIds.length) {
      const placeholders = excludeIds.map(() => '?').join(',');
      query += ` AND id NOT IN (${placeholders})`;
      params.push(...excludeIds);
    }
  }

  query += ' ORDER BY created_at DESC LIMIT 20';

  const [candidates] = await pool.execute(query, params);

  if (candidates.length === 0) return json(res, { startup, promotion: null });

  const promotion = candidates[Math.floor(Math.random() * candidates.length)];
  return json(res, { startup, promotion });
}
