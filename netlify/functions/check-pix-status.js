// Legacy route now uses the authenticated, server-side confirmation flow.
exports.handler = require("./confirm-purchase").handler;
