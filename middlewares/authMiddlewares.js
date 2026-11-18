const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const token = req.cookies.jwt;

    if (!token){
        return res.status(401).json({
            message: "Authentication required: No token provided"
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = {
            id: decoded.id,
            role: decoded.role
        }

        next();

    } catch (error){
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }

}

const verifyAdmin = (req, res, next) =>{
    verifyToken(req, res, ()=>{
        if (req.user.role != 'admin'){
            return res.status(403).json({
                message: "Access denied: admin only"
            });
        }
    });

    next();
}

module.exports = {
    verifyToken,
    verifyAdmin
}