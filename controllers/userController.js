function parseId(value) {
  const id = Number(value);
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(id) ? id : null;
}

function validUserInput(body) {
  return body !== null && typeof body === "object" &&
    typeof body.name === "string" && body.name.trim() !== "" &&
    typeof body.email === "string" && body.email.trim() !== "";
}

function createUserController(model) {
  return {
    getAll(req, res) {
      res.status(200).json(model.getAll());
    },

    getById(req, res) {
      const id = parseId(req.params.id);
      if (id === null) {
        return res.status(400).json({ message: "ID must be a positive integer" });
      }
      const user = model.findById(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      return res.status(200).json(user);
    },

    create(req, res) {
      if (!validUserInput(req.body)) {
        return res.status(400).json({ message: "Provide a non-empty name and email" });
      }
      const user = model.create(req.body.name.trim(), req.body.email.trim());
      return res.status(201).json(user);
    },

    update(req, res) {
      const id = parseId(req.params.id);
      if (id === null) {
        return res.status(400).json({ message: "ID must be a positive integer" });
      }
      if (!validUserInput(req.body)) {
        return res.status(400).json({ message: "Provide a non-empty name and email" });
      }
      const user = model.update(id, req.body.name.trim(), req.body.email.trim());
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      return res.status(200).json(user);
    },

    remove(req, res) {
      const id = parseId(req.params.id);
      if (id === null) {
        return res.status(400).json({ message: "ID must be a positive integer" });
      }
      if (!model.remove(id)) {
        return res.status(404).json({ message: "User not found" });
      }
      return res.status(200).json({ message: "User deleted successfully" });
    }
  };
}

module.exports = { createUserController };
