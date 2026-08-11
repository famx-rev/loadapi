// File: pages/api/leaders.js
import pool from './db.js';
import { json, errorResponse } from './_helpers.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return errorResponse(res, 'Method not allowed', 405);

  const limit = Math.min(parseInt(req.query.limit || '20', 10) || 20, 100);

  try {
    // 1. Fetch raw events from the last 7 days (no MySQL JSON functions)
    const [eventRows] = await pool.query(
      `SELECT startup_id, event_data 
       FROM events 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );

    if (eventRows.length === 0) return json(res, { leaderboard: [] });

    // 2. Parse event_data in JavaScript (avoids MySQL JSON function issues) and aggregate
    const statsMap = new Map();

    for (const row of eventRows) {
      let data = {};
      try {
        data = typeof row.event_data === 'string' ? JSON.parse(row.event_data) : (row.event_data || {});
      } catch {
        data = {};
      }

      const startupId = row.startup_id;
      if (!startupId) continue;

      const entry = statsMap.get(startupId) ?? { impressions: 0, clicks: 0 };

      if (data.eventName === 'impression') {
        entry.impressions++;
      } else if (data.eventName === 'click') {
        entry.clicks++;
      }

      statsMap.set(startupId, entry);
    }

    // 3. Sort the aggregated stats in JS to find the top leaders
    const sortedStats = Array.from(statsMap.entries())
      .map(([startup_id, stats]) => ({ startup_id, ...stats }))
      .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks)
      .slice(0, limit); // Apply the limit to the top results

    if (sortedStats.length === 0) return json(res, { leaderboard: [] });

    // 4. Fetch the startup details for ONLY the top IDs
    const startupIds = sortedStats.map(s => pool.escape(s.startup_id)).join(',');
    const [startups] = await pool.query(
      `SELECT id, name, domain, tagline, url, accent_from, accent_to, verified, created_at
       FROM startups 
       WHERE id IN (${startupIds})`
    );

    // 5. Merge the stats with the startup data and assign ranks
    const leaderboard = sortedStats.map((stats, index) => {
      const startupInfo = startups.find(s => s.id === stats.startup_id);
      return {
        ...startupInfo, // Spread startup data
        impressions: stats.impressions,
        clicks: stats.clicks,
        rank: index + 1
      };
    }).filter(item => item.name); // Filter out any events tied to deleted startups

    return json(res, { leaderboard });

  } catch (err) {
    console.error('leaderboard error:', err);
    return errorResponse(res, 'Could not load leaderboard', 500);
  }
}
