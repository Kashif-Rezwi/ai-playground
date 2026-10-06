import express from 'express';

const app = express();
const port = 3001;

app.get("/api/health", (req, res) => {
    res.send({ status: "ok", message: "Streaming service is running" });
})

app.listen(port, () => {
    console.log(`[streaming] Server is running on port ${port}`);
})