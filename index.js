import express from 'express';
import serveRoute from './serve.js';
import trackRoute from './track.js';
import analyticsRoute from './analytics.js';
import leaderboardRoute from './leaderboard.js';
import myStartupsRoute from './my-startups.js';
import startupsRoute from './startups.js';
import eventsRoute from './events.js';
import widgetLoaderRoute from './widget/loader.js';

const app = express();

app.use(express.json());
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info, Apikey');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'API is working' });
});

app.get('/api/serve', serveRoute);
app.post('/api/track', trackRoute);
app.get('/api/analytics', analyticsRoute);
app.get('/api/leaderboard', leaderboardRoute);
app.get('/api/my-startups', myStartupsRoute);
app.get('/api/events', eventsRoute);
app.delete('/api/events', eventsRoute);

app.get('/api/startups/:id', startupsRoute.getOne);
app.post('/api/startups', startupsRoute.create);
app.put('/api/startups/:id', startupsRoute.update);
app.delete('/api/startups/:id', startupsRoute.delete);

app.get('/api/widget/loader.js', widgetLoaderRoute);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Loadbar API running on port ${PORT}`);
});

export default app;
