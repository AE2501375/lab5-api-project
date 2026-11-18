const express = require('express');
const {
  retrieveAllUsers,
  createUser,
  retrieveUserById,
  updateUserById,
  deleteUserById,
  getEmployeesAndManagers
} = require('../controllers/userController');

const { verifyAdmin } = require('../middlewares/authMiddlewares');

const userRouter = express.Router();

userRouter.use(verifyAdmin);

// All users
userRouter.post('/', createUser)        // Add new user
userRouter.get('/', retrieveAllUsers);  // Get all users

// Specific user
userRouter.get('/:id', retrieveUserById); // Get a specific user
userRouter.put('/:id', updateUserById); // Update a specific user
userRouter.delete('/:id', deleteUserById); // Delete a specific user

// Get employees and their managers
userRouter.get('/managers', getEmployeesAndManagers);

module.exports = userRouter; 