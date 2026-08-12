// File: pages/api/events.js
import pool from './db.js';
import { json, errorResponse, requireUser } from './_helpers.js';

export default async function handler(req, res) {
  // DELETE — wipe all events for a startup (owner only)
  if (req.method === 'DELETE') {
    const userId = await requireUser(req, res);
    if (!userId) return;

    const startupId = req.query.id;
    if (!startupId) return errorResponse(res, 'Missing startup id', 400);

    const [startupRows] = await pool.execute(
      'SELECT id, owner_id FROM startups WHERE id = ?',
      [startupId],
    );
    if (startupRows.length === 0) return errorResponse(res, 'Startup not found', 404);
    if (startupRows[0].owner_id !== userId) return errorResponse(res, 'Not authorized', 403);

    try {
      // Delete events where this startup is the promoted_id
      await pool.execute('DELETE FROM events WHERE promoted_id = ?', [startupId]);
      return json(res, { ok: true });
    } catch (err) {
      console.error('Events delete error:', err);
      return errorResponse(res, 'Could not delete events', 500);
    }
  }

  if (req.method !== 'GET') return errorResponse(res, 'Method not allowed', 405);

  const startupId = req.query.id;
  if (!startupId) return errorResponse(res, 'Missing startup id', 400);

  // Read the "type" parameter from the URL to decide what data to fetch
  const requestType = req.query.type; 

  // Check if the startup exists (removed the owner_id check)
  const [startupRows] = await pool.execute(
    'SELECT id FROM startups WHERE id = ?',
    [startupId],
  );
  
  // Return a pure empty array if no startup is found
  if (startupRows.length === 0) {
    return json(res, []);
  }

  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

  try {
    let rows = [];

    // 1. IF the dashboard asks for "gave"
    if (requestType === 'gave') {
      [rows] = await pool.query(
        `SELECT startup_id, promoted_id, event_data
         FROM events WHERE startup_id = ?
         ORDER BY created_at DESC
         LIMIT ${limit}`,
        [startupId],
      );
    } 
    // 2. IF the dashboard asks for "got"
    else if (requestType === 'got') {
      [rows] = await pool.query(
        `SELECT startup_id, promoted_id, event_data
         FROM events WHERE promoted_id = ?
         ORDER BY created_at DESC
         LIMIT ${limit}`,
        [startupId],
      );
    }
    // 3. IF the type is missing or invalid
    else {
      return errorResponse(res, 'Invalid request type. Must specify "got" or "gave".', 400);
    }

    const events = rows.map((r) => {
      let data = {};
      try {
        data = typeof r.event_data === 'string' ? JSON.parse(r.event_data) : r.event_data;
      } catch {
        data = {};
      }
      
      // Return only the exact data you want, stripping id and created_at
      return {
        startup_id: r.startup_id,
        promoted_id: r.promoted_id,
        event_data: data,
      };
    });

    // Return the pure array directly, with no wrapper keys
    return json(res, events);

  } catch (err) {
    console.error('Events load error:', err);
    return errorResponse(res, 'Could not load events', 500);
  }
}
