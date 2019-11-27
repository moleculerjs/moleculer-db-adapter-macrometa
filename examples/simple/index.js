"use strict";

const { ServiceBroker } = require("moleculer");
const StoreService = require("moleculer-db/index");
const ModuleChecker = require("../checker");
const MacroMetaAdapter = require("../../index");
const Promise = require("bluebird");

// Create broker
const broker = new ServiceBroker({
	logger: true,
	logLevel: "debug"
});
/**
 * @type {MacroMetaAdapter}
 */
let adapter;

// Load my service
broker.createService(StoreService, {
	name: "posts",
	adapter: new MacroMetaAdapter({
		config: "https://gdn1.macrometa.io",

		auth: {
			email: process.env.FABRIC_EMAIL,
			password: process.env.FABRIC_PASS,
		},

		tenant: null,
		fabric: null
	}),

	collection: "posts",
	settings: {},

	async afterConnected() {
		try {
			adapter = this.adapter;
			await this.adapter.clear();
			// Currently only supports one elem. More info: https://dev.macrometa.io/docs/indexes-1#collectioncreatefulltextindex
			// Throws an error if 2 elems.
			// await this.adapter.collection.createFulltextIndex(["title", "content"]);
			await this.adapter.collection.createFulltextIndex(["title"]);
		} catch (error) {
			this.broker.logger.error("An error ocurred in afterConnected() method");
			throw error;
		}
	}
});

// Start checks
async function start() {
	const checker = new ModuleChecker(26);

	let ids =[];
	let date = Date.now();

	await Promise.delay(500);
	try {

		// Count of posts
		await checker.check("COUNT", () => adapter.count(), res => {
			console.log(res);
			return res == 0;
		});

		// Insert a new Post
		await checker.check("INSERT", () => adapter.insert({ title: "Hello", content: "Post content", votes: 3, status: true, createdAt: date }), doc => {
			ids[0] = doc._id;
			console.log("Saved: ", doc);
			return doc._id && doc.title === "Hello" && doc.content === "Post content" && doc.votes === 3 && doc.status === true && doc.createdAt === date;
		});

		// Find
		await checker.check("FIND", () => adapter.find(), res => {
			console.log(res);
			return res.length == 1 && res[0]._id == ids[0];
		});

		// Find by ID
		await checker.check("GET", () => adapter.findById(ids[0]), res => {
			console.log(res);
			return res._id == ids[0];
		});

		// Count of posts
		await checker.check("COUNT", () => adapter.count(), res => {
			console.log(res);
			return res == 1;
		});

		// Insert many new Posts
		await checker.check("INSERT MANY", () => adapter.insertMany([
			{ title: "Second", content: "Second post content", votes: 8, status: true, createdAt: Date.now() },
			{ title: "Last", content: "Last document", votes: 1, status: false, createdAt: Date.now() }
		]), docs => {
			console.log("Saved: ", docs);
			ids[1] = docs[0]._id;
			ids[2] = docs[1]._id;

			return [
				docs.length == 2,
				ids[1] && docs[0].title === "Second" && docs[0].votes === 8,
				ids[1] && docs[1].title === "Last" && docs[1].votes === 1 && docs[1].status === false
			];
		});

		// Count of posts
		await checker.check("COUNT", () => adapter.count(), res => {
			console.log(res);
			return res == 3;
		});
		
		// Find by title
		await checker.check("FIND by query", () => adapter.find({ query: { title: "Last" } }), res => {
			console.log(res);
			return res.length == 1 && res[0]._id == ids[2];
		});
		
		// Find with limit, sort, offset
		await checker.check("FIND by limit, sort, query", () => adapter.find({ limit: 1, sort: ["votes", "-title"], offset: 1 }), res => {
			console.log(res);
			return res.length == 1 && res[0]._id == ids[0];
		});

		
		// Find
		await checker.check("FIND by query ($gt)", () => adapter.find({ query: "row.votes > 2", sort: "-votes" }), res => {
			console.log(res);
			return [
				res.length == 2,
				res[0].title == "Second" && res[0].votes == 8,
				res[1].title == "Hello" && res[1].votes == 3,
			];
		});
		
		// Count by query
		await checker.check("COUNT by query ($gt)", () => adapter.count({ query: "row.votes > 2" }), res => {
			console.log(res);
			return res == 2;
		});
		/*
		// Find
		await checker.check("FIND by text search", () => adapter.find({ search: "content" }), res => {
			console.log(res);
			return [
				res.length == 2,
				res[0]._score < 1 && res[0].title === "Hello",
				res[1]._score < 1 && res[1].title === "Second"
			];
		});
		*/
		// Get by IDs
		await checker.check("GET BY IDS", () => adapter.findByIds([ids[2], ids[0]]), res => {
			console.log(res);
			return [
				res.length == 2,
				(res[0]._id == ids[2] && res[0].title === "Last") || (res[0]._id == ids[0] && res[0].title === "Hello"),
				(res[1]._id == ids[2] && res[1].title === "Last") || (res[1]._id == ids[0] && res[1].title === "Hello"),
			];
		});

		// Raw query
		await checker.check("RAW QUERY", () => adapter.rawQuery(
			`FOR post IN posts
			  FILTER post.status == true && post.votes > @minVotes
			  SORT post.createdAt DESC
			  LIMIT 3
			  RETURN post._id
			`,
			{ minVotes: 2 },
			{}
		), res => {
			console.log(res);
			return [
				res.length == 2,
				res[0] == ids[1],
				res[1] == ids[0],
			];
		});
		
		// Update a posts
		const updatedAt = Date.now() - 123;
		await checker.check("UPDATE", () => adapter.updateById(ids[2], {
			title: "Last 2",
			updatedAt,
			status: true
		}), doc => {
			console.log("Updated: ", doc);
			return doc._id && doc.title === "Last 2" && doc.content === "Last document" && doc.votes === 1 && doc.status === true && doc.updatedAt == updatedAt;
		});
		
		// Update by query
		await checker.check("UPDATE BY QUERY", () => adapter.updateMany("row.votes < 5", {
			status: false
		}), count => {
			console.log("Updated: ", count);
			//return count == 2; TODO:
		});
		
		// Remove by query
		await checker.check("REMOVE BY QUERY", () => adapter.removeMany("row.votes < 5"), count => {
			console.log("Removed: ", count);
			//return count == 2; TODO:
		});

		// Count of posts
		await checker.check("COUNT", () => adapter.count(), res => {
			console.log(res);
			return res == 1;
		});
		
		// Remove by ID
		await checker.check("REMOVE BY ID", () => adapter.removeById(ids[1]), doc => {
			console.log("Removed: ", doc);
			return doc && doc._id == ids[1];
		});
		
		// Count of posts
		await checker.check("COUNT", () => adapter.count(), res => {
			console.log(res);
			return res == 0;
		});

		// Clear
		await checker.check("CLEAR", () => adapter.clear(), res => {
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
