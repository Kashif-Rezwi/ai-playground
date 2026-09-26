import router from "express";
const healthRouter = router();

healthRouter.get("/health", async (req, res) => {
    res.send({ status: "ok", message: "Conversation and Memory Service is running!" });
})

export { healthRouter };