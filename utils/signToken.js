const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

// sign the token 
const signToken = (id, role) =>{
    return jwt.sign({id, role}, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    })
}

module.exports = signToken