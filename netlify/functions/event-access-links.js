const { getAdmin, verifyFirebaseUser } = require("../shared/firebase-admin");
const { createEventAccessHandler } = require("../shared/event-access");

exports.handler = createEventAccessHandler({ getAdmin, verifyFirebaseUser });
