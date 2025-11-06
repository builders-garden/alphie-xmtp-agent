import express from "express";
import { handleFixTokens } from "../controllers/fix.controller.js";

const router = express.Router();

// fix all token images
router.get("/fix", handleFixTokens);

export default router;
