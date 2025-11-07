import express from "express";
import {
	checkJobStatus,
	handleTestWebhookGroupEvent,
	handleWebhookEvent,
} from "../controllers/neynar.controller.js";

const router = express.Router();

// handle copy trade route
router.get("/webhooks", (_req, res) => {
	res.json({ status: "ok" });
});
router.options("/webhooks", (_req, res) => {
	res.json({ status: "ok" });
});
router.head("/webhooks", (_req, res) => {
	res.json({ status: "ok" });
});
router.post("/webhooks", handleWebhookEvent);
router.post("/webhooks/test", handleTestWebhookGroupEvent);
router.get("/webhook/status/:jobId", checkJobStatus);

export default router;
