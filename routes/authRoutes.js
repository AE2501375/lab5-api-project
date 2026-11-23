const express = require('express');
const {
    registerUser, 
    loginUser,
    logoutUser
} = require('../controllers/authController');

const authRouter = express.Router();

// Register a new user
authRouter.post('/register', registerUser);

// Login a user
authRouter.post('/login', loginUser);

// Logout a user
authRouter.post('/logout', logoutUser);

module.exports = authRouter;