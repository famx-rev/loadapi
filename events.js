// File: pages/api/events.js
import pool from './db.js';
import { json, errorResponse, requireUser } from './_helpers.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return errorResponse(res, 'Method not allowed', 405);

  // Security: Check if user is logged in
  const userId = await requireUser(req, res);
  if (!userId) return;

  const startupId = req.query.id;
  if (!startupId) return errorResponse(res, 'Missing startup id', 400);

  // Security: Ensure the logged-in user actually owns this startup
  const [startupRows] = await pool.execute(
    'SELECT id, owner_id FROM startups WHERE id = ?',
    [startupId],
  );
  
  if (startupRows.length === 0) {
    return json(res, { trafficReceived: [], trafficGiven: [] });
  }
  
  if (startupRows[0].owner_id !== userId) {
    return errorResponse(res, 'Not authorized', 403);
  }

  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

  try {
    // 1. Traffic RECEIVED (The founder's ad being clicked/viewed on other websites)
    const [receivedRows] = await pool.query(
      `SELECT id, startup_id, promoted_id, event_data, created_at
       FROM events WHERE promoted_id = ?
       ORDER BY created_at DESC
       LIMIT ${limit}`,
      [startupId]
    );

    // 2. Traffic GIVEN (The widget running on the founder's own website)
    const [givenRows] = await pool.query(
      `SELECT id, startup_id, promoted_id, event_data, created_at
       FROM events WHERE startup_id = ?
       ORDER BY created_at DESC
       LIMIT ${limit}`,
      [startupId]
    );

    // Helper function to safely parse and format the event data
    const formatEvent = (r) => {
      let data = {};
      try {
        data = typeof r.event_data === 'string' ? JSON.parse(r.event_data) : r.event_data;
      } catch {
        data = {};
      }
      return {
        id: r.id,
        startup_id: r.startup_id,     // The website hosting the ad
        promoted_id: r.promoted_id,   // The startup being advertised
        event_data: data,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      };
    };

    // Return both lists cleanly to the dashboard
    return json(res, { 
      trafficReceived: receivedRows.map(formatEvent),
      trafficGiven: givenRows.map(formatEvent)
    });

  } catch (err) {
    console.error('Events load error:', err);
    return errorResponse(res, 'Could not load events', 500);
  }
}
