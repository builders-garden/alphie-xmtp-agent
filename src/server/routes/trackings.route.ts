import express from "express";
import {
	checkJobStatus,
	handleUpdateTrackings,
} from "../controllers/trackings.controller.js";

const router = express.Router();

// handle update trackings route
router.post("/users", handleUpdateTrackings);
router.get("/users/status/:jobId", checkJobStatus);

export default router;
