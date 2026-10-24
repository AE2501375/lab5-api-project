function createTripController(tripModel) {
  function readId(req, res) {
    const id = Number(req.params.id);
    if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({ status: 'fail', message: 'Trip ID must be a positive integer' });
      return null;
    }
    return id;
  }

  function notFound(res) {
    return res.status(404).json({ status: 'fail', message: 'Trip not found' });
  }

  return {
    getAllTrips(req, res) {
      const trips = tripModel.getAll();
      return res.json({
        status: 'success', message: 'Trips retrieved successfully',
        results: trips.length, data: trips
      });
    },

    getTripById(req, res) {
      const id = readId(req, res);
      if (id === null) return;
      const trip = tripModel.findById(id);
      if (!trip) return notFound(res);
      return res.json({ status: 'success', data: trip });
    },

    createTrip(req, res) {
      const trip = tripModel.create(req.tripData);
      return res.status(201).json({
        status: 'success', message: 'Trip created successfully', data: trip
      });
    },

    updateTrip(req, res) {
      const id = readId(req, res);
      if (id === null) return;
      const trip = tripModel.update(id, req.tripData);
      if (!trip) return notFound(res);
      return res.json({ status: 'success', message: 'Trip updated successfully', data: trip });
    },

    deleteTrip(req, res) {
      const id = readId(req, res);
      if (id === null) return;
      if (!tripModel.remove(id)) return notFound(res);
      return res.status(204).send();
    },

    compareTrips(req, res) {
      const { tripId1, tripId2 } = req.body || {};
      if (!Number.isSafeInteger(tripId1) || !Number.isSafeInteger(tripId2) ||
          tripId1 <= 0 || tripId2 <= 0 || tripId1 === tripId2) {
        return res.status(400).json({
          status: 'fail', message: 'Provide two different positive integer trip IDs'
        });
      }

      const first = tripModel.findById(tripId1);
      const second = tripModel.findById(tripId2);
      if (!first || !second) return notFound(res);

      let cheaperDestination = null;
      let message = 'Neither trip is cheaper; both trips cost the same';
      if (first.cost < second.cost) {
        cheaperDestination = first.destination;
        message = `${first.destination} is cheaper than ${second.destination}`;
      } else if (second.cost < first.cost) {
        cheaperDestination = second.destination;
        message = `${second.destination} is cheaper than ${first.destination}`;
      }

      return res.json({
        status: 'success',
        data: {
          destination1: first.destination,
          destination2: second.destination,
          costDifference: Math.abs(first.cost - second.cost),
          cheaperDestination,
          message
        }
      });
    }
  };
}

module.exports = createTripController;
