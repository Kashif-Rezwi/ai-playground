import dotenv from "dotenv";
import express from "express";
import { healthRouter } from "./routes/health.route";
import { chatRouter } from "./routes/chat.route";

dotenv.config({ path: "../../.env" });

const app = express();
const port = process.env.PORT || 3001;

// middleware
app.use(express.json());

// routes
app.use("/api", healthRouter);
app.use("/api", chatRouter);

app.listen(port, () => {
    console.log(`[conversation-and-memory] Server is running on port ${port}`);
})