import { Router, type IRouter } from "express";
import healthRouter from "./health";
import paymentRouter from "./payment";
import freeFireScoringRouter from "./freefire-scoring";

const router: IRouter = Router();

router.use(healthRouter);
router.use(paymentRouter);
router.use(freeFireScoringRouter);

export default router;
