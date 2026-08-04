import { readFileSync } from 'fs';
import { join } from 'path';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405);
    return res.send('Method not allowed');
  }

  try {
    const filePath = join(process.cwd(), 'public', 'widget', 'loader.js');
    const script = readFileSync(filePath, 'utf-8');
    res.set('Content-Type', 'application/javascript; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300');
    return res.send(script);
  } catch {
    res.status(500);
    return res.send('Could not load widget script');
  }
}
