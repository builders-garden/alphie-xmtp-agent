import express from "express";
import {
	checkJobStatus,
	handleWebhookEvent,
} from "../controllers/neynar.controller.js";

const router = express.Router();

// handle copy trade route
router.post("/webhooks", handleWebhookEvent);
router.get("/webhook/status/:jobId", checkJobStatus);

export default router;
