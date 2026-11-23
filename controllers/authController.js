const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { db } = require('../db');
const dotenv = require('dotenv');
const {
    sanitizeInput,
    validateRequired,
    validateEmail,
    validatePassword
} = require('../utils/validators');
const signToken = require('../utils/signToken')

dotenv.config();

const registerUser = async (req, res) => {
    const { username, email, password } = req.body;

    // 1. Clean input
    const cleanUsername = sanitizeInput(username);
    const cleanEmail = sanitizeInput(email);

    // Do NOT trim or lowercase passwords
    const cleanPassword = password;

    // 2. Check required fields
    const requiredError = validateRequired(
        {
            username: cleanUsername,
            email: cleanEmail,
            password: cleanPassword
        },
        ['username', 'email', 'password']
    );

    if (requiredError) {
        return res.status(400).json({
            message: requiredError
        });
    }

    // 3. Validate email
    const emailError = validateEmail(cleanEmail);

    if (emailError) {
        return res.status(400).json({
            message: emailError
        });
    }

    // 4. Validate password
    const passwordError = validatePassword(cleanPassword);

    if (passwordError) {
        return res.status(400).json({
            message: passwordError
        });
    }

    // 5. Hash password using bcrypt
    try {
        const hashedPassword = await bcrypt.hash(cleanPassword, 12);

        // 6. Parameterized query
        const query = `
            INSERT INTO USERS (USERNAME, EMAIL, PASSWORD, ROLE)
            VALUES (?, ?, ?, ?)
        `;

        const [result] = await db.query(query, [
            cleanUsername,
            cleanEmail,
            hashedPassword,
            'user'
        ]);

        // create token
        const token = signToken(result.insertId, 'user');

        // set token in cookie
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: false, // Set to true in production
            sameSite: 'lax', // Adjust based on your needs
            maxAge: 60 * 60 * 1000 // 1 hour
        });

        return res.status(201).json({
            message: 'User registered successfully',
            token: token
        });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: 'Email already exists'
            });
        }

        return res.status(500).json({
            message: 'Registration error'
        });
    }
};

const loginUser = async (req, res) => {
    const { email, password } = req.body;

    const cleanEmail = sanitizeInput(email);

    if (!cleanEmail || !password) {
        return res.status(400).json({
            message: 'Please provide both email and password.'
        });
    }

    // Parameterized query prevents SQL injection
    const query = `
        SELECT * FROM USERS WHERE EMAIL = ?
    `;

    try {
        const [users] = await db.query(query, [
            cleanEmail
        ]);

        if (users.length === 0) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        const user = users[0];

        // Compare entered password with stored hash
        const isMatch = await bcrypt.compare(
            password,
            user.PASSWORD
        );

        if (!isMatch) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        // create token
        const token = signToken(user.ID, user.ROLE);

        // Set token in cookie
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: false, // Set to true in production
            sameSite: 'lax', 
            maxAge: 60 * 60 * 1000 // 1 hour
        });

        return res.status(200).json({
            message: 'User logged in successfully',
            user: {
                id: user.ID,
                username: user.USERNAME,
                email: user.EMAIL,
                role: user.ROLE
            }
        });

    } catch (error) {
        return res.status(500).json({
            message: 'Login error'
        });
    }
};

const logoutUser = (req, res) => {
    res.clearCookie('jwt', {
        httpOnly: true,
        secure: false, // Set to true in production
        sameSite: 'lax'
    });

    return res.status(200).json({
        message: 'User logged out successfully'
    });
}

module.exports = {
    registerUser,
    loginUser,
    logoutUser
};