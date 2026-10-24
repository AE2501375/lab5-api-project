// Each app gets its own in-memory collection. Restarting the server clears it.
function createUserModel() {
  const users = [];
  let nextId = 1;

  return {
    getAll() {
      return users;
    },

    findById(id) {
      for (let i = 0; i < users.length; i++) {
        if (users[i].id === id) {
          return users[i];
        }
      }
      return undefined;
    },

    create(name, email) {
      const user = { id: nextId++, name, email };
      users.push(user);
      return user;
    },

    update(id, name, email) {
      for (let i = 0; i < users.length; i++) {
        if (users[i].id === id) {
          users[i].name = name;
          users[i].email = email;
          return users[i];
        }
      }
      return undefined;
    },

    remove(id) {
      for (let i = 0; i < users.length; i++) {
        if (users[i].id === id) {
          users.splice(i, 1);
          return true;
        }
      }
      return false;
    }
  };
}

module.exports = { createUserModel };
