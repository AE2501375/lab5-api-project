const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');

const userRouter = require('./routes/userRoutes');
const authRouter = require('./routes/authRoutes');
const tripRouter = require('./routes/tripRoutes');

// Create an instance of the Express application
const app = express(); 

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
});

// Use middleware to parse JSON data from request bodies
app.use(express.json());
app.use(cookieParser());
app.use(limiter); // Apply rate limiting to all requests
app.use(cors({
  origin: 'http://127.0.0.1:30095/',
  credentials: true,
}));


app.use('/users', userRouter);
app.use('/auth', authRouter);
app.use('/trips', tripRouter);


module.exports = {
  app,
};