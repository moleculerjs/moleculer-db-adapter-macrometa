"use strict";

let { ServiceBroker } 	= require("moleculer");
let MyService 			= require("../../index");

// Create broker
let broker = new ServiceBroker({
});

// Load my service
broker.createService(MyService, {
	settings: {
		fabric: {
			collection: "posts"
		}
	}
});

// Start server
broker.start().then(async () => {
	try {
	// Call action
	//const res = await broker.call("macrometa.create", { name: "Jane Doe" })
		const res = await broker.call("macrometa.find", {});
		broker.logger.info("Result:", res);

	} catch(err) {
		broker.logger.error(err);
	}

	broker.repl();
});
