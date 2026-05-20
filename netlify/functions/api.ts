/**
 * Single catch-all Netlify Function that proxies /api/* to the Express router.
 * netlify.toml redirects /api/* → /.netlify/functions/api/*.
 */
import "dotenv/config";
import serverless from "serverless-http";
import express from "express";
import cors from "cors";
import { buildRouter } from "../../server/routes";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/api", buildRouter());
// Netlify strips the function prefix; route both with and without /api.
app.use("/", buildRouter());

export const handler = serverless(app);
