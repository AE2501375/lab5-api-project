const { db } = require('../db');
const bcrypt = require('bcrypt');
const {
    validatePassword
} = require('../utils/validators');

// Retrieve all users
const retrieveAllUsers = async (req, res) => {
    try {
        const query = "SELECT * FROM USERS";
        const [users] = await db.query(query);
    
        return res.status(200).json({
            status: "success",
            results: users.length,
            data: users
        });
    } catch (error) {
        return res.status(500).json({
            message: "Database error",
        });
    }
};

const createUser = async (req, res) => {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
        return res.status(400).json({
            message: "Please provide all required fields"
        });
    }

    const query = `INSERT INTO USERS (USERNAME, EMAIL, PASSWORD, ROLE)
    VALUES(?, ?, ?, ?)
    `;
    
    const passwordError = validatePassword(password);
    if (passwordError) {
        return res.status(400).json({
            message: passwordError
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 12);

        const [result] = await db.query(query, [username, email, hashedPassword, role]);

        const createdUserQuery = `SELECT * FROM USERS WHERE ID = ?`;

        const [newUser] = await db.query(createdUserQuery, [result.insertId]);

        return res.status(201).json({
            message: "User created successfully",
            data: newUser[0]
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: 'Email already exists'
            });
        }

        return res.status(500).json({
            message: "Database error"
        });
    }
};  

// Retrieve a specific user by ID
const retrieveUserById = async (req, res) => {
    const id = req.params.id;
    const query = `SELECT * FROM USERS WHERE ID = ?`;
    console.log(query)

    try {
        const [users] = await db.query(query, [id]);
        console.log(users);

        if (users.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            status: "success",
            data: users
        });

    } catch (error) {
        return res.status(500).json({
            message: "Database error",
        });
    }
};

// Update a specific user by ID partial update
const updateUserById = async (req, res) => {
    const id = Number(req.params.id);
    const { username, email, password, role } = req.body;

    if (!username && !email && !password && !role) {
        return res.status(400).json({
            message: "Please provide at least one field to update."
        });
    }

    const selectQuery = `SELECT * FROM USERS WHERE ID = ${id}`;
    const [users] = await db.query(selectQuery);

    if (users.length === 0) {
        return res.status(404).json({
            message: "User not found"
        });
    }

    const updatedUsername = username || users[0].USERNAME;
    const updatedEmail = email || users[0].EMAIL;
    const updatedPassword = password || users[0].PASSWORD;
    const updatedRole = role || users[0].ROLE;

    const query = `
        UPDATE USERS
        SET USERNAME = '${updatedUsername}',
            EMAIL = '${updatedEmail}',
            PASSWORD = '${updatedPassword}',
            ROLE = '${updatedRole}'
        WHERE ID = ${id}
    `;

    try {
        const [result] = await db.query(query);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const updatedUserQuery = `SELECT * FROM USERS WHERE ID = ${id}`;
        const [updatedUser] = await db.query(updatedUserQuery);

        return res.status(200).json({
            message: "User updated successfully",
            data: updatedUser
        });

    } catch (error) {
        return res.status(500).json({
            message: "Database error",
        });
    }
};

// Delete a specific user by ID
const deleteUserById = async (req, res) => {
    const id = Number(req.params.id);
    const query = `DELETE FROM USERS WHERE ID = ${id}`;

    try {
        const [result] = await db.query(query);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            message: "User deleted successfully"
        });
    } catch (error) {
        return res.status(500).json({
            message: "Database error",
        });
    }
};

const getEmployeesAndManagers = async (req, res) => {
    try {
        const query = `SELECT
            e.ID,
            e.USERNAME AS Employee,
            m.USERNAME AS Manager

            FROM USERS AS e

            LEFT JOIN USERS AS m
                ON e.MANAGER_ID = m.ID;
        `;
        const [users] = await db.query(query);

        return res.status(200).json({
            status: "success",
            results: users.length,
            data: users
        });
    } catch (error) {
        return res.status(500).json({
            message: "Database error",
        });
    }
}

module.exports = {
    retrieveAllUsers,
    createUser,
    retrieveUserById,
    updateUserById,
    deleteUserById,
    getEmployeesAndManagers
};