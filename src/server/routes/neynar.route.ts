import express from "express";
import { handleCopyTrade } from "../controllers/neynar.controller.js";

const router = express.Router();

// handle copy trade route
router.post("/copy-trade", handleCopyTrade);

export default router;
