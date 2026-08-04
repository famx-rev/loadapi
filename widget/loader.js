import { readFileSync } from 'fs';
import { join } from 'path';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.setHeader(k, v);
  }
  if (req.method === 'OPTIONS') return res.end();
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method not allowed');
  }

  try {
    const filePath = join(process.cwd(), 'public', 'widget', 'loader.js');
    const script = readFileSync(filePath, 'utf-8');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.end(script);
  } catch {
    res.statusCode = 500;
    return res.end('Could not load widget script');
  }
}
