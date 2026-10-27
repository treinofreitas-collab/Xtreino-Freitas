import { Router, type IRouter } from "express";
import healthRouter from "./health";
import paymentRouter from "./payment";
import freeFireScoringRouter from "./freefire-scoring";
import specLogosRouter from "./spec-logos";

const router: IRouter = Router();

router.use(healthRouter);
router.use(paymentRouter);
router.use(freeFireScoringRouter);
router.use(specLogosRouter);

export default router;
