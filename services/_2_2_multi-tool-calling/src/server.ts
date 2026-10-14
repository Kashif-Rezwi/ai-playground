import express from "express";
import dotenv from "dotenv";
import path from "path";
import healthRouter from "./routes/health.route";
import chatRouter from "./routes/chat.route";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
const port = process.env.PORT || 3106;

// Middleware to parse JSON requests
app.use(express.json());

// Routes
app.use("/api/health", healthRouter);
app.use("/api/chat", chatRouter);

app.listen(port, () => {
    console.log(`[multi-tool-calling] Server is running on port ${port}`);
})