const express = require('express');
const { 
    createTrip,
    retrieveAllTrips, 
    retrieveTripById,
    getLastViewedTrip,
    getTripReviews, 
    allTripsWithRatings 
} = require('../controllers/tripController');

const { verifyToken, verifyAdmin } = require('../middlewares/authMiddlewares');

const tripRouter = express.Router();

tripRouter.get('/', verifyToken, retrieveAllTrips);
tripRouter.get('/:id', verifyToken, retrieveTripById);
tripRouter.get('/last-viewed', verifyToken, getLastViewedTrip);
tripRouter.get('/reviews', verifyToken, getTripReviews);
tripRouter.get('/ratings', verifyToken, allTripsWithRatings);
tripRouter.post('/', verifyAdmin, createTrip);

module.exports = tripRouter;