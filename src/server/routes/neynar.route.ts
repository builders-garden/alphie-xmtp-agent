import express from "express";
import {
	cancelJob,
	checkJobStatus,
	handleCopyTrade,
} from "../controllers/neynar.controller.js";

const router = express.Router();

// handle copy trade route
router.post("/copy-trade", handleCopyTrade);
router.get("/copy-trade/status/:jobId", checkJobStatus);
router.delete("/copy-trade/cancel/:jobId", cancelJob);

export default router;
