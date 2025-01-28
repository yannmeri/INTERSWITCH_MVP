const express = require("express");
const { registerUser } = require("../controllers/userController");
const paymentService = require('../services/paymentService');
const router = express.Router();

router.post("/register", registerUser);

module.exports = router;
