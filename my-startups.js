import pool from './db.js';
import { json, errorResponse, requireUser } from './_helpers.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return errorResponse(res, 'Method not allowed', 405);

  const userId = await requireUser(req, res);
  if (!userId) return;

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM startups WHERE owner_id = ? ORDER BY created_at DESC',
      [userId],
    );
    return json(res, { startups: rows });
  } catch {
    return errorResponse(res, 'Could not load startups', 500);
  }
}
