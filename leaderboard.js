// File: pages/api/leaders.js
import pool from './db.js';
import { json, errorResponse } from './_helpers.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return errorResponse(res, 'Method not allowed', 405);

  const limit = Math.min(parseInt(req.query.limit || '20', 10) || 20, 100);

  try {
    // 1. Fetch ALL startups so we can include those with 0 stats
    const [startups] = await pool.query(
      `SELECT id, name, domain, tagline, url, accent_from, accent_to, verified, created_at
       FROM startups`
    );

    if (startups.length === 0) return json(res, { leaderboard: [] });

    // 2. Fetch raw events from the last 7 days
    // Note: I used 'startup_id' based on your previous leaders.js. 
    // If you need it to match analytics exactly, you might need to change 'startup_id' to 'promoted_id' here.
    const [eventRows] = await pool.query(
      `SELECT startup_id, event_data 
       FROM events 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );

    // 3. Parse event_data in JavaScript and aggregate stats
    const statsMap = new Map();

    for (const row of eventRows) {
      let data = {};
      try {
        // Same parsing logic as analytics.js
        data = typeof row.event_data === 'string' ? JSON.parse(row.event_data) : (row.event_data || {});
      } catch {
        data = {};
      }

      const targetId = row.startup_id; 
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

    // 4. Map the calculated stats to ALL startups and calculate CTR
    const leaderboardFull = startups.map((startup) => {
      const stats = statsMap.get(startup.id) ?? { impressions: 0, clicks: 0, hovers: 0 };
      
      const impressions = stats.impressions;
      const clicks = stats.clicks;
      // Calculate CTR just like analytics.js
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

      return {
        ...startup,
        impressions,
        clicks,
        hovers: stats.hovers,
        ctr: Number(ctr.toFixed(2)),
      };
    });

    // 5. Sort by impressions descending, then clicks descending
    leaderboardFull.sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks);

    // 6. Slice to the requested limit and assign ranks
    const leaderboard = leaderboardFull.slice(0, limit).map((s, index) => {
      return {
        ...s,
        rank: index + 1
      };
    });

    return json(res, { leaderboard });

  } catch (err) {
    console.error('leaderboard error:', err);
    return errorResponse(res, 'Could not load leaderboard', 500);
  }
}
