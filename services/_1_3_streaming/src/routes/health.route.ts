import router from 'express';

const healthRouter = router();

healthRouter.get("/", (req, res) => {
    res.send({ status: "ok", message: "Streaming service is running" });
})

export default healthRouter;