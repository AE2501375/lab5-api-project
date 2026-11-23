const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const userRouter = require('./routes/userRoutes');
const authRouter = require('./routes/authRoutes');
const tripRouter = require('./routes/tripRoutes');

// Create an instance of the Express application
const app = express(); 

// Rate limiting middleware to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
 
// Use middleware to parse JSON data from request bodies
app.use(express.json());
app.use(cors({
  origin: 'http://127.0.0.1:5500',
  credentials: true
}));
app.use(cookieParser());
app.use(limiter); // Apply rate limiting to all requests

app.use('/users', userRouter);
app.use('/auth', authRouter);
app.use('/trips', tripRouter);

module.exports = {
  app,
};