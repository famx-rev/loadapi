// File: pages/api/events.js
import pool from './db.js';
import { json, errorResponse, requireUser } from './_helpers.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return errorResponse(res, 'Method not allowed', 405);

  const userId = await requireUser(req, res);
  if (!userId) return;

  const startupId = req.query.id; // This is the founder's startup ID
  if (!startupId) return errorResponse(res, 'Missing startup id', 400);

  // Security check: Ensure the logged-in user actually owns this startup
  const [startupRows] = await pool.execute(
    'SELECT id, owner_id FROM startups WHERE id = ?',
    [startupId],
  );
  if (startupRows.length === 0) return json(res, { events: [] });
  if (startupRows[0].owner_id !== userId) return errorResponse(res, 'Not authorized', 403);

  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

  try {
    // FIX: We select by promoted_id to see who clicked/viewed THIS founder's ad
    const [rows] = await pool.query(
      `SELECT id, startup_id, promoted_id, event_data, created_at
       FROM events WHERE promoted_id = ?
       ORDER BY created_at DESC
       LIMIT ${limit}`,
      [startupId], // Match the dashboard's startup to the promoted_id column
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
        startup_id: r.startup_id, // The network partner who hosted the ad
        promoted_id: r.promoted_id, // This founder's startup
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
