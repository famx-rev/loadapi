// File: pages/api/leaders.js
import pool from './db.js';
import { json, errorResponse } from './_helpers.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return errorResponse(res, 'Method not allowed', 405);

  const limit = Math.min(parseInt(req.query.limit || '20', 10) || 20, 100);

  try {
    const [startups] = await pool.query(
      `SELECT id, name, domain, tagline, url, accent_from, accent_to, verified, created_at
       FROM startups`
    );

    if (startups.length === 0) return json(res, { leaderboard: [] });

    // FIX: Changed startup_id to promoted_id to match analytics.js
    const [eventRows] = await pool.query(
      `SELECT promoted_id, event_data 
       FROM events 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );

    const statsMap = new Map();

    for (const row of eventRows) {
      let data = {};
      try {
        data = typeof row.event_data === 'string' ? JSON.parse(row.event_data) : (row.event_data || {});
      } catch {
        data = {};
      }

      // FIX: Grouping by promoted_id now
      const targetId = row.promoted_id; 
      if (!targetId) continue;

      const entry = statsMap.get(targetId) ?? { impressions: 0, clicks: 0, hovers: 0 };

      if (data.eventName === 'impression') {
        entry.impressions++;
      } else if (data.eventName === 'click') {
        entry.clicks++;
      }
      if (data.hovered === true) {
        entry.hovers++;
      }

      statsMap.set(targetId, entry);
    }

    const leaderboardFull = startups.map((startup) => {
      const stats = statsMap.get(startup.id) ?? { impressions: 0, clicks: 0, hovers: 0 };
      
      const impressions = stats.impressions;
      const clicks = stats.clicks;
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

      return {
        ...startup,
        impressions,
        clicks,
        hovers: stats.hovers,
        ctr: Number(ctr.toFixed(2)),
      };
    });

    leaderboardFull.sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks);

    const leaderboard = leaderboardFull.slice(0, limit).map((s, index) => ({
      ...s,
      rank: index + 1
    }));

    return json(res, { leaderboard });

  } catch (err) {
    console.error('leaderboard error:', err);
    return errorResponse(res, 'Could not load leaderboard', 500);
  }
}
