// File: pages/api/leaders.js
import pool from './db.js';
import { json, errorResponse } from './_helpers.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return errorResponse(res, 'Method not allowed', 405);

  const limit = Math.min(parseInt(req.query.limit || '20', 10) || 20, 100);

  try {
    const [startups] = await pool.query(
      `SELECT id, name, domain, tagline, url, accent_from, accent_to, verified, created_at
       FROM startups ORDER BY created_at DESC LIMIT ${limit}`,
    );

    if (startups.length === 0) return json(res, { leaderboard: [] });

    const ids = startups.map((s) => s.id);
    const quotedIds = ids.map((id) => pool.escape(id)).join(',');

    // FIX: Extract 'eventName' directly from the JSON column using ->>
    const [agg] = await pool.query(
      `SELECT startup_id, event_data->>'$.eventName' as kind, COUNT(*) as count
       FROM events
       WHERE startup_id IN (${quotedIds}) AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY startup_id, kind`,
    );

    const stats = new Map();
    for (const e of agg) {
      const entry = stats.get(e.startup_id) ?? { impressions: 0, clicks: 0 };
      // Map the JSON eventName ('impression' or 'click') to the stats
      if (e.kind === 'impression') entry.impressions += e.count;
      if (e.kind === 'click') entry.clicks += e.count;
      stats.set(e.startup_id, entry);
    }

    const leaderboard = startups.map((s) => {
      const st = stats.get(s.id) ?? { impressions: 0, clicks: 0 };
      return { ...s, impressions: st.impressions, clicks: st.clicks };
    });

    leaderboard.sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks);
    leaderboard.forEach((s, i) => { s.rank = i + 1; });

    return json(res, { leaderboard });
  } catch (err) {
    console.error('leaderboard error:', err);
    return errorResponse(res, 'Could not load leaderboard', 500);
  }
}
