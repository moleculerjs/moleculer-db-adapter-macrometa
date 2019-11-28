"use strict";

const { ServiceBroker } = require("moleculer");
const StoreService = require("moleculer-db/index");
const MacroMetaAdapter = require("../../index");
const ModuleChecker = require("../checker");
const Promise = require("bluebird");

// Create broker
const broker = new ServiceBroker({
	logger: console,
	logLevel: "debug"
});

// Load my service
broker.createService(StoreService, {
	name: "posts",
	adapter: new MacroMetaAdapter({
		config: "https://gdn1.macrometa.io",

		auth: {
			email: process.env.FABRIC_EMAIL,
			password: process.env.FABRIC_PASS
		}
	}),
	collection: "posts",
	settings: {
		fields: ["_id", "title", "content", "votes", "status", "updatedAt"]
	},

	actions: {
		async vote(ctx) {
			const res = await this.adapter.rawQuery(`
				FOR p IN posts
					FILTER p._id == @id
					UPDATE p WITH { votes: p.votes + 1 } IN posts
					RETURN NEW
			`, ctx.params);

			return res[0];
		},

		async unvote(ctx) {
			const res = await this.adapter.rawQuery(`
				FOR p IN posts
					FILTER p._id == @id
					UPDATE p WITH { votes: p.votes - 1 } IN posts
					RETURN NEW
			`, ctx.params);
			
			return res[0];
		}
	},

	async afterConnected() {
		await this.adapter.clear();
	}
});

async function start() {
	const checker = new ModuleChecker(11);

	let id =[];

	await Promise.delay(1000);

	try {
		// Count of posts
		await checker.check("COUNT", () => broker.call("posts.count"), res => {
			console.log(res);
			return res == 0;
		});

		// Create new Posts
		await checker.check("--- CREATE ---", () => broker.call("posts.create", { title: "Hello", content: "Post content", votes: 2, status: true }), doc => {
			id = doc._id;
			console.log("Saved: ", doc);
			return doc._id && doc.title === "Hello" && doc.content === "Post content" && doc.votes === 2 && doc.status === true;
		});

		// List posts
		await checker.check("--- FIND ---", () => broker.call("posts.find", { fields: ["_id", "title"]}), res => {
			console.log(res);
			return res.length == 1 && res[0]._id == id && res[0].content == null && res[0].votes == null && res[0].status == null;
		});
	
		// Get a post
		await checker.check("--- GET ---", () => broker.call("posts.get", { id }), res => {
			console.log(res);
			return res._id == id;
		});

		// Vote a post
		await checker.check("--- VOTE ---", () => broker.call("posts.vote", {
			id
		}), res => {
			console.log(res);
			return res._id == id && res.votes === 3;
		});

		// Update a posts
		await checker.check("--- UPDATE ---", () => broker.call("posts.update", {
			id,
			title: "Hello 2",
			content: "Post content 2",
			updatedAt: new Date()
		}), doc => {
			console.log(doc);
			return doc._id && doc.title === "Hello 2" && doc.content === "Post content 2" && doc.votes === 3 && doc.status === true && doc.updatedAt;
		});

		// Get a post
		await checker.check("--- GET ---", () => broker.call("posts.get", { id }), doc => {
			console.log(doc);
			return doc._id == id && doc.title == "Hello 2" && doc.votes === 3;
		});

		// Unvote a post
		await checker.check("--- UNVOTE ---", () => broker.call("posts.unvote", {
			id
		}), res => {
			console.log(res);
			return res._id == id && res.votes === 2;
		});

		// Count of posts
		await checker.check("--- COUNT ---", () => broker.call("posts.count"), res => {
			console.log(res);
			return res == 1;
		});

		// Remove a post
		await checker.check("--- REMOVE ---", () => broker.call("posts.remove", { id }), res => {
			console.log(res);
			return res._id == id;
		});

		// Count of posts
		await checker.check("--- COUNT ---", () => broker.call("posts.count"), res => {
			console.log(res);
			return res == 0;
		});
		
	} catch(err) {
		console.error(err);
	}

	try {
		await broker.stop();
		checker.printTotal();

	} catch(err) {
		console.error(err);
	}
}

// --- TEST CASES ---

broker.start()
	.then(() => start());
