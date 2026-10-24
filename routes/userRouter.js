const express = require("express");
const { createUserModel } = require("../models/userModel");
const { createUserController } = require("../controllers/userController");

function createUserRouter() {
  const router = express.Router();
  const controller = createUserController(createUserModel());

  router.get("/", controller.getAll);
  router.post("/", controller.create);
  router.get("/:id", controller.getById);
  router.put("/:id", controller.update);
  router.delete("/:id", controller.remove);

  return router;
}

module.exports = { createUserRouter };
