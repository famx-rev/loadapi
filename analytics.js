import pool from './db.js';
import { applyCors, json, errorResponse, requireUser } from './_helpers.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.end();
  if (req.method !== 'GET') return errorResponse(res, 'Method not allowed', 405);

  const userId = await requireUser(req, res);
  if (!userId) return;

  const startupId = req.query.id;
  if (!startupId) return errorResponse(res, 'Missing startup id', 400);

  const [startupRows] = await pool.execute(
    'SELECT id, owner_id FROM startups WHERE id = ?',
    [startupId],
  );
  if (startupRows.length === 0) return json(res, { analytics: null });
  if (startupRows[0].owner_id !== userId) return errorResponse(res, 'Not authorized', 403);

  try {
    const [impressionRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM events WHERE startup_id = ? AND kind = ?',
      [startupId, 'impression'],
    );
    const [clickRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM events WHERE startup_id = ? AND kind = ?',
      [startupId, 'click'],
    );
    const impressionCount = impressionRows[0].count;
    const clickCount = clickRows[0].count;
    const ctr = impressionCount > 0 ? (clickCount / impressionCount) * 100 : 0;

    const [dailyRows] = await pool.execute(
      `SELECT DATE(created_at) as day, kind, COUNT(*) as count
       FROM events WHERE startup_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
       GROUP BY DATE(created_at), kind`,
      [startupId],
    );
    const dayMap = new Map();
    for (const r of dailyRows) {
      const day = typeof r.day === 'object' && r.day instanceof Date
        ? r.day.toISOString().slice(0, 10)
        : String(r.day);
      const entry = dayMap.get(day) ?? { impressions: 0, clicks: 0 };
      if (r.kind === 'impression') entry.impressions += r.count;
      else entry.clicks += r.count;
      dayMap.set(day, entry);
    }
    const daily = Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, v]) => ({ day, ...v }));

    const [recentRows] = await pool.execute(
      `SELECT country, country_code, city, device, referrer, kind, created_at
       FROM events WHERE startup_id = ?
       ORDER BY created_at DESC LIMIT 20`,
      [startupId],
    );

    const countryMap = new Map();
    for (const e of recentRows) {
      if (!e.country) continue;
      const entry = countryMap.get(e.country) ?? { count: 0, code: e.country_code ?? '' };
      entry.count += 1;
      countryMap.set(e.country, entry);
    }
    const topCountries = Array.from(countryMap.entries())
      .map(([country, v]) => ({ country, country_code: v.code, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const deviceMap = new Map();
    for (const e of recentRows) {
      if (!e.device) continue;
      deviceMap.set(e.device, (deviceMap.get(e.device) ?? 0) + 1);
    }
    const totalDevices = Array.from(deviceMap.values()).reduce((a, b) => a + b, 0);
    const deviceBreakdown = Array.from(deviceMap.entries())
      .map(([device, count]) => ({ device, count, pct: totalDevices > 0 ? (count / totalDevices) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);

    const referrerMap = new Map();
    for (const e of recentRows) {
      if (!e.referrer) continue;
      referrerMap.set(e.referrer, (referrerMap.get(e.referrer) ?? 0) + 1);
    }
    const topReferrers = Array.from(referrerMap.entries())
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const activity = recentRows
      .filter((e) => e.kind === 'impression')
      .slice(0, 8)
      .map((e) => ({
        country: e.country,
        country_code: e.country_code,
        city: e.city,
        device: e.device,
        referrer: e.referrer,
        created_at: e.created_at instanceof Date ? e.created_at.toISOString() : e.created_at,
      }));

    return json(res, {
      analytics: {
        totals: {
          impressions: impressionCount,
          clicks: clickCount,
          ctr: Number(ctr.toFixed(2)),
        },
        daily,
        topCountries,
        deviceBreakdown,
        topReferrers,
        activity,
      },
    });
  } catch {
    return errorResponse(res, 'Could not load analytics', 500);
  }
}
