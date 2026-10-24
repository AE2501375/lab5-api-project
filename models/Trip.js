// Each app instance gets its own in-memory store. Restarting clears changes.
const initialTrips = [
  { id: 1, destination: 'Paris', country: 'France', cost: 400 },
  { id: 2, destination: 'Tokyo', country: 'Japan', cost: 800 },
  { id: 3, destination: 'Cairo', country: 'Egypt', cost: 150 }
];

function createTripModel(seed = initialTrips) {
  const trips = seed.map((trip) => ({ ...trip }));
  let nextId = 1;
  for (let i = 0; i < trips.length; i++) {
    if (trips[i].id >= nextId) nextId = trips[i].id + 1;
  }

  return {
    getAll() {
      return trips;
    },

    findById(id) {
      for (let i = 0; i < trips.length; i++) {
        if (trips[i].id === id) return trips[i];
      }
      return null;
    },

    create(fields) {
      const trip = {
        id: nextId++,
        ...fields,
        description: fields.description || 'No description available'
      };
      trips.push(trip);
      return trip;
    },

    update(id, fields) {
      for (let i = 0; i < trips.length; i++) {
        if (trips[i].id === id) {
          Object.assign(trips[i], fields);
          return trips[i];
        }
      }
      return null;
    },

    remove(id) {
      for (let i = 0; i < trips.length; i++) {
        if (trips[i].id === id) {
          trips.splice(i, 1);
          return true;
        }
      }
      return false;
    }
  };
}

module.exports = createTripModel;
