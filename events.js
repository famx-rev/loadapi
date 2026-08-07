// File: pages/api/events.js
import pool from './db.js';
import { json, errorResponse, requireUser } from './_helpers.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return errorResponse(res, 'Method not allowed', 405);

  const userId = await requireUser(req, res);
  if (!userId) return;

  const startupId = req.query.id;
  if (!startupId) return errorResponse(res, 'Missing startup id', 400);

  const [startupRows] = await pool.execute(
    'SELECT id, owner_id FROM startups WHERE id = ?',
    [startupId],
  );
  if (startupRows.length === 0) return json(res, { events: [] });
  if (startupRows[0].owner_id !== userId) return errorResponse(res, 'Not authorized', 403);

  // Safely parse the limit to a strict integer
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

  try {
    // FIX: Inject ${limit} directly instead of using 'LIMIT ?' to prevent MySQL syntax crashes
    const [rows] = await pool.execute(
      `SELECT id, startup_id, event_data, created_at
       FROM events WHERE startup_id = ?
       ORDER BY created_at DESC
       LIMIT ${limit}`,
      [startupId]
    );

    const events = rows.map((r) => {
      let data = {};
      try {
        data = typeof r.event_data === 'string' ? JSON.parse(r.event_data) : r.event_data;
      } catch {
        data = {};
      }
      return {
        id: r.id,
        startup_id: r.startup_id,
        event_data: data,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      };
    });

    return json(res, { events });
  } catch (err) {
    console.error('Events load error:', err);
    return errorResponse(res, 'Could not load events', 500);
  }
}
