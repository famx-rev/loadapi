// File: pages/api/track.js
import pool from './db.js';

// Helper function to extract the IP address from the request headers
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress;
  return ip || 'unknown';
}

export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Ensure database is connected
  if (!pool) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  try {
    const body = req.body;
    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    // 3. Read startup_id from the event data sent by the frontend widget
    const startupId = body.startup_id;
    if (!startupId) {
      return res.status(400).json({ error: 'startup_id is required' });
    }

    // 4. Validate that the startup actually exists in your DB (Optional but recommended)
    const [rows] = await pool.execute('SELECT id FROM startups WHERE id = ?', [startupId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Startup not found' });
    }

    // 5. Get the server-side IP address
    const ip = getClientIp(req);

    // 6. Bundle all the rich JSON data together
    const eventData = { 
      ...body, 
      ip: ip, 
      recordedVia: 'widget' 
    };

    // 7. Insert into the simplified events table
    // Table columns: id (auto), project_id, event_data, created_at
    // We map your frontend "startup_id" to the DB's "project_id" column
    await pool.execute(
      'INSERT INTO events (project_id, event_data, created_at) VALUES (?, ?, NOW())',
      [startupId, JSON.stringify(eventData)]
    );

    // 8. Return the exact success response from Code 2
    return res.status(200).json({ success: true, recorded: true });

  } catch (error) {
    console.error('API /track Error:', error.message);
    return res.status(500).json({ 
      error: 'Failed to save event', 
      details: error.message 
    });
  }
}
