import express from "express";
import CountryController from "../controllers/countryController.js";

const router = express.Router();

// GET /api/countries?search=xyz
router.get("/", CountryController.findAll);

export default router;
