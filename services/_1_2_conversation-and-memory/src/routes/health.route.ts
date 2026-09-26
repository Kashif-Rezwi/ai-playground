import router from "express";
const healthRouter = router();

healthRouter.get("/", async (req, res) => {
    res.send({ status: "ok", message: "Conversation and Memory Service is running!" });
})

export { healthRouter };