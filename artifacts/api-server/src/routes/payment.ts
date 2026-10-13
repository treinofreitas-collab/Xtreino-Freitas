import { Router, type IRouter } from "express";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const router: IRouter = Router();
const require = createRequire(import.meta.url);
// esbuild moves this module into dist/index.mjs; source-relative require paths
// would point outside the workspace there. Resolve the workspace root once.
let workspaceRoot = process.cwd();
while (!existsSync(join(workspaceRoot, "pnpm-workspace.yaml")) &&
       dirname(workspaceRoot) !== workspaceRoot) {
  workspaceRoot = dirname(workspaceRoot);
}

// Preview and Netlify execute the same authenticated payment handlers.
const routes: Record<string, string> = {
  "check-availability": "check-availability",
  "event-access-links": "event-access-links",
  "create-preference": "create-preference",
  "create-token-preference": "create-token-preference",
  "confirm-token-purchase": "confirm-token-purchase",
  "confirm-purchase": "confirm-purchase",
  "check-payment-status": "confirm-purchase",
  "check-pix-status": "confirm-purchase",
  "pay-with-tokens": "pay-with-tokens",
  "mp-webhook": "mp-webhook",
};
for (const [route, handlerName] of Object.entries(routes)) {
  router.post(`/${route}`, async (req, res) => {
    try {
      const { handler } = require(join(workspaceRoot, "netlify", "functions", `${handlerName}.js`));
      const result = await handler({
        httpMethod: req.method,
        headers: req.headers,
        queryStringParameters: req.query,
        body: JSON.stringify(req.body || {}),
      });
      res.status(result.statusCode).set(result.headers).send(result.body);
    } catch (error) {
      req.log.error({ err: error }, "Payment handler failed");
      res.status(503).json({ error: "Pagamento temporariamente indisponível." });
    }
  });
}
export default router;
