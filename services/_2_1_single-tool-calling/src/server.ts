import express from "express";
import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

const app = express();
const port = process.env.PORT || 3001;

// Middleware to parse JSON requests
app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", message: "Single tool calling server is healthy" });
});

// Start the server
app.listen(port, () => {
    console.log(`[single-tool-calling] Server is running on port ${port}`);
})