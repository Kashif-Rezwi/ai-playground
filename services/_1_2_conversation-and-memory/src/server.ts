import dotenv from "dotenv";
import express from "express";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
import healthRouter from "./routes/health.route";
import chatRouter from "./routes/chat.route";


const app = express();
const port = process.env.PORT || 3102;

// middleware
app.use(express.json());

// routes
app.use("/api/health", healthRouter);
app.use("/api/chat", chatRouter);

app.listen(port, () => {
    console.log(`[conversation-and-memory] Server is running on port ${port}`);
})