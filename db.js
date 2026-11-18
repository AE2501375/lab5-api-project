const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
dotenv.config();

const db = mysql.createPool({
    host: "localhost",
    port: 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
}); // configs

// Create User Table
const createUserTable = `CREATE TABLE IF NOT EXISTS USERS (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        USERNAME VARCHAR(255) NOT NULL,
        EMAIL VARCHAR(255) UNIQUE NOT NULL,
        PASSWORD VARCHAR(255) NOT NULL,
        ROLE ENUM('admin', 'user') NOT NULL DEFAULT 'user',
        MANAGER_ID INT NULL,
        FOREIGN KEY (MANAGER_ID) REFERENCES USERS(ID)
    );
`;

const createTripTable = `CREATE TABLE IF NOT EXISTS TRIPS (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        DESTINATION VARCHAR(150) NOT NULL,
        COUNTRY VARCHAR(150) NOT NULL,
        COST DECIMAL(10,2) NOT NULL
)`;

const createReviewTable = `CREATE TABLE IF NOT EXISTS REVIEWS (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        USER_ID INT NOT NULL,
        TRIP_ID INT NOT NULL,
        RATING INT NOT NULL CHECK (RATING BETWEEN 1 AND 5),
        FOREIGN KEY (USER_ID) REFERENCES USERS(ID),
        FOREIGN KEY (TRIP_ID) REFERENCES TRIPS(ID),
        UNIQUE (USER_ID, TRIP_ID)
)`;

module.exports = {
    db,
    createUserTable,
    createTripTable,
    createReviewTable
}