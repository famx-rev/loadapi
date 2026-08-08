// File: pages/api/serve.js
import pool from './db.js';

// Global variables act as an in-memory cache for Vercel Serverless functions.
let cachedStartups = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60000; // 60 seconds

export default async function handler(req, res) {
  // CORS setup - Allow any website on the internet to fetch this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const hostStartupId = req.query.startup_id;
  if (!hostStartupId) {
    return res.status(400).json({ error: 'startup_id is required' });
  }

  try {
    const now = Date.now();

    // 1. Refresh the cache only if it's empty or older than 60 seconds
    if (!cachedStartups || now - cacheTimestamp > CACHE_TTL_MS) {
      
      // FIX: Removed "WHERE verified = 1" so ALL startups are eligible to be shown!
      const [rows] = await pool.execute(
        `SELECT id, name, tagline, url, domain, accent_from, accent_to 
         FROM startups 
         ORDER BY RAND() 
         LIMIT 100`
      );
      
      cachedStartups = rows;
      cacheTimestamp = now;
    }

    // 2. Filter out the host's own startup so they don't serve their own ad
    const eligibleStartups = cachedStartups.filter(s => s.id !== hostStartupId);

    if (eligibleStartups.length === 0) {
      return res.status(404).json({ error: 'No eligible startups available' });
    }

    // 3. Pick a random ad from the eligible cached pool
    const randomIndex = Math.floor(Math.random() * eligibleStartups.length);
    const selectedStartup = eligibleStartups[randomIndex];

    // 4. Return in the exact JSON format your frontend loader.js expects
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json({
      promotion: selectedStartup
    });

  } catch (error) {
    console.error('API /serve Error:', error.message);
    return res.status(500).json({ error: 'Failed to serve promotion' });
  }
}
