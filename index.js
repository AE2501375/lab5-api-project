const express = require('express');
const { createUserRouter } = require('./routes/userRouter');
const createTripModel = require('./models/Trip');
const createTripRouter = require('./routes/tripRoutes');

function createApp() {
  const app = express();
  app.use(express.json());

  app.use('/api/v1/users', createUserRouter());
  const tripRouter = createTripRouter(createTripModel());
  app.use('/trips', tripRouter);
  app.use('/api/v1/trips', tripRouter);

  app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
  });

  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ message: 'Invalid JSON request body' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ message: 'Request body too large' });
    }
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  });
  return app;
}

module.exports = createApp;
module.exports.createApp = createApp;
