const { db } = require('../db');

const retrieveAllTrips = async (req, res) => {
    try {
        query = "SELECT * FROM TRIPS";
        const [trips] = await db.query(query);
    
        return res.status(200).json({
            status: "success",
            results: trips.length,
            data: trips
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Database error',
        });
    }
};

const createTrip = async (req, res) => {
    const { destination, country, cost } = req.body;

    if (!destination || !country || !cost) {
        return res.status(400).json({
            message: "Please provide all required fields"
        });
    }

    try {
        const query = `INSERT INTO TRIPS (DESTINATION, COUNTRY, COST) VALUES (?, ?, ?)`;
        const [result] = await db.query(query, [destination, country, cost]);

        return res.status(201).json({
            message: "Trip created successfully",
            data: result
        });
    } catch (error) {
        return res.status(500).json({
            message: "Database error"
        });
    }
};

const retrieveTripById = async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
            message: "Invalid trip ID"
        });
    }

    try {
        const query = "SELECT * FROM TRIPS WHERE ID = ?";
        const [trips] = await db.query(query, [id]);

        if (trips.length === 0) {
            return res.status(404).json({
                message: "Trip not found"
            });
        }

        // Remember the last viewed trip
        res.cookie('lastViewedTrip', String(id), {
            maxAge: 24 * 60 * 60 * 1000, // 1 ho
            httpOnly: true,
            secure: true,
            sameSite: 'lax'
        });

        return res.status(200).json({
            data: trips[0]
        });

    } catch (error) {
        return res.status(500).json({
            error: error.message,
            message: "Database error"
        });
    }
};

const getLastViewedTrip = async (req, res) => {
    const id = Number(req.cookies.lastViewedTrip);

    if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
            message: "No valid last viewed trip"
        });
    }

    try {
        const query = "SELECT * FROM TRIPS WHERE ID = ?";
        const [trips] = await db.query(query, [id]);

        if (trips.length === 0) {
            return res.status(404).json({
                message: "Trip not found"
            });
        }

        return res.status(200).json({
            data: trips[0]
        });

    } catch (error) {
        return res.status(500).json({
            message: "Database error"
        });
    }
};

const getTripReviews = async (req, res) => {
  try {
    const query = `SELECT 
      t.DESTINATION, r.RATING, u.USERNAME
      FROM TRIPS AS t
      INNER JOIN REVIEWS AS r ON t.ID = r.TRIP_ID
      INNER JOIN USERS AS u ON r.USER_ID = u.ID`;
    const [rows] = await db.query(query);

    return res.status(200).json({ 
      data: rows 
    });

  } catch (error) { 
    console.error(error); 
    return res.status(500).json({ 
      message: 'Database error' 
    }); 
  }
};

const allTripsWithRatings = async (req, res) => {
  try {
    const query = `SELECT t.DESTINATION, r.RATING FROM TRIPS AS t
      LEFT JOIN REVIEWS AS r ON t.ID = r.TRIP_ID`;
    const [results] = await db.query(query);
    return res.status(200).json({ data: results });
  } catch (error) { 
    console.error(error); 
    return res.status(500).json({ 
      message: 'Database error' 
    }); 
  }
};

module.exports = { 
  createTrip,
  retrieveAllTrips, 
  retrieveTripById,
  getLastViewedTrip,
  getTripReviews, 
  allTripsWithRatings 
};