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
  if (startupRows.length === 0) return json(res, { analytics: null });
  if (startupRows[0].owner_id !== userId) return errorResponse(res, 'Not authorized', 403);

  try {
    // Fetch raw rows and parse JSON in JS — same pattern as events.js
    const [rows] = await pool.execute(
      `SELECT event_data, created_at
       FROM events WHERE promoted_id = ?
       ORDER BY created_at DESC
       LIMIT 5000`,
      [startupId],
    );

    if (rows.length === 0) {
      return json(res, {
        analytics: {
          totals: { impressions: 0, clicks: 0, hovers: 0, ctr: 0 },
          daily: [],
          topCountries: [],
          deviceBreakdown: [],
          topReferrers: [],
          activity: [],
        },
      });
    }

    // Parse event_data in JavaScript (avoids MySQL JSON function issues)
    const events = rows.map((r) => {
      let data = {};
      try {
        data = typeof r.event_data === 'string' ? JSON.parse(r.event_data) : (r.event_data || {});
      } catch {
        data = {};
      }
      return {
        ...data,
        _created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at || ''),
      };
    });

    // ---- Totals ----
    let impressions = 0;
    let clicks = 0;
    let hovers = 0;
    for (const e of events) {
      if (e.eventName === 'impression') impressions++;
      else if (e.eventName === 'click') clicks++;
      if (e.hovered === true) hovers++;
    }
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

    // ---- Daily breakdown (last 14 days) ----
    const dayMap = new Map();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    for (const e of events) {
      const ts = e.timestamp || e._created_at;
      if (!ts) continue;
      const d = new Date(ts);
      if (d < fourteenDaysAgo) continue;
      const day = d.toISOString().slice(0, 10);
      const entry = dayMap.get(day) ?? { impressions: 0, clicks: 0 };
      if (e.eventName === 'impression') entry.impressions++;
      else if (e.eventName === 'click') entry.clicks++;
      dayMap.set(day, entry);
    }
    const daily = Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, v]) => ({ day, ...v }));

    // ---- Top countries ----
    const countryMap = new Map();
    for (const e of events) {
      if (!e.country) continue;
      const entry = countryMap.get(e.country) ?? { count: 0, code: e.country_code ?? '' };
      entry.count++;
      countryMap.set(e.country, entry);
    }
    const topCountries = Array.from(countryMap.entries())
      .map(([country, v]) => ({ country, country_code: v.code, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // ---- Device breakdown ----
    const deviceMap = new Map();
    for (const e of events) {
      const dev = e.device || 'unknown';
      deviceMap.set(dev, (deviceMap.get(dev) ?? 0) + 1);
    }
    const totalDevices = Array.from(deviceMap.values()).reduce((a, b) => a + b, 0);
    const deviceBreakdown = Array.from(deviceMap.entries())
      .map(([device, count]) => ({ device, count, pct: totalDevices > 0 ? (count / totalDevices) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);

    // ---- Top referrers ----
    const refMap = new Map();
    for (const e of events) {
      const ref = e.referrer || e.url || '';
      let label = 'Direct';
      if (ref) {
        try {
          label = new URL(ref).hostname;
        } catch {
          label = ref;
        }
      }
      refMap.set(label, (refMap.get(label) ?? 0) + 1);
    }
    const topReferrers = Array.from(refMap.entries())
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // ---- Recent activity (last 8 impressions) ----
    const activity = events
      .filter((e) => e.eventName === 'impression')
      .slice(0, 8)
      .map((e) => ({
        country: e.country || '',
        country_code: e.country_code || '',
        city: e.city || '',
        device: e.device || '',
        referrer: e.referrer || '',
        created_at: e.timestamp || e._created_at,
      }));

    return json(res, {
      analytics: {
        totals: {
          impressions,
          clicks,
          hovers,
          ctr: Number(ctr.toFixed(2)),
        },
        daily,
        topCountries,
        deviceBreakdown,
        topReferrers,
        activity,
      },
    });
  } catch (err) {
    console.error('Analytics load error:', err);
    return errorResponse(res, 'Could not load analytics', 500);
  }
}
