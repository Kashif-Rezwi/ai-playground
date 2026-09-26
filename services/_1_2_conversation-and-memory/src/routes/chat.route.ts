import router from "express";
const chatRouter = router();

chatRouter.post("/chat", async (req, res) => {
    res.send({ status: "ok", message: "Chat endpoint is working!" })
});

export { chatRouter };