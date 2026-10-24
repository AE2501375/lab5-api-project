const express = require('express');
const createTripController = require('../controllers/tripController');
const verifyAdmin = require('../middleware/verifyAdmin');
const validateTrip = require('../middleware/validateTrip');
const logRequest = require('../middleware/logRequest');

function createTripRouter(tripModel) {
  const router = express.Router();
  const controller = createTripController(tripModel);

  router.use(logRequest);

  router.get('/', controller.getAllTrips);
  router.post('/compare', controller.compareTrips);
  router.get('/:id', controller.getTripById);
  router.post('/', verifyAdmin, validateTrip, controller.createTrip);
  router.put('/:id', verifyAdmin, validateTrip, controller.updateTrip);
  router.delete('/:id', verifyAdmin, controller.deleteTrip);

  return router;
}

module.exports = createTripRouter;
