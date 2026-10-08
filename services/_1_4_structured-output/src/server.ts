import express from "express";
import dotenv from "dotenv";
import healthRouter from "./routes/health.route";
import chatRouter from "./routes/chat.route";
dotenv.config({ path: "../../.env" });

const app = express();
const port = process.env.PORT || 3001;

// Middleware to parse JSON requests
app.use(express.json());

// Health check endpoint
app.use("/api/health", healthRouter);
app.use("/api/chat", chatRouter);

// Start the server
app.listen(port, () => {
    console.log(`[structured-output] Server is running on port ${port}`);
})



