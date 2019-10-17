/*
 * moleculer-macrometa
 * Copyright (c) 2019 MoleculerJS (https://github.com/moleculerjs/moleculer-macrometa)
 * MIT Licensed
 */

"use strict";

const { MoleculerClientError } = require("moleculer").Errors;

const Fabric = require("jsc8");
const c8ql = Fabric.c8ql;

module.exports = {

	name: "macrometa",

	/**
	 * Default settings
	 */
	settings: {
		fabric: {
			// https://dev.macrometa.io/docs/overview-3#connect-to-c8
			config: "https://gdn1.macrometa.io",

			// https://dev.macrometa.io/docs/overview-3#login
			email: process.env.FABRIC_EMAIL,
			password: process.env.FABRIC_PASS,

			tenant: null,
			fabric: null,
			collection: null
		}

	},

	/**
	 * Actions
	 */
	actions: {
		/**
		 * 
		 */
		find: {
			handler(ctx) {
				return this.findDocuments(ctx, ctx.params);
			}
		},

		/**
		 * 
		 */
		create: {
			rest: "POST /",
			handler(ctx) {
				return this.createDocument(ctx, ctx.params);
			}
		},


	},

	/**
	 * Methods
	 */
	methods: {
		/**
		 * 
		 * @param {*} email 
		 * @param {*} password 
		 */
		async login(email, password) {
			this.logger.info(`Logging in with '${email}'...`);
			await this.fabric.login(email, password);
			this.logger.info("Logged in.");

			if (this.settings.fabric.tenant) {
				this.logger.info(`Switch tenant to '${this.settings.fabric.tenant}'`);
				await this.fabric.useTenant(this.settings.fabric.tenant);
			}

			if (this.settings.fabric.fabric) {
				this.logger.info(`Switch Fabric to '${this.settings.fabric.fabric}'`);
				await this.fabric.usefabric(this.settings.fabric.fabric);
			}
		},

		/**
		 * 
		 * @param {*} name 
		 * @param {*} createIfNotExist 
		 */
		async openCollection(name, createIfNotExist = true) {
			this.logger.info(`Open '${this.settings.fabric.collection}' collection...`);
			const collection = this.fabric.collection(name);
			if (!(await collection.exists())) {
				if (createIfNotExist) {
					this.logger.info(`Create '${this.settings.fabric.collection}' collection...`);
					await collection.create();
				} else {
					throw new MoleculerClientError("Collection '${name}' is not exist!", 500, "COLLECTION_NOT_EXIST", { name });
				}
			}

			this.logger.info(`Collection '${this.settings.fabric.collection}' is opened.`);

			return collection;
		},

		/**
		 *
		 * More info: https://dev.macrometa.io/docs/documentcollection#documentcollectionsave
		 * 
		 * @param {*} ctx
		 * @param {*} params
		 * @returns
		 */
		async createDocument(ctx, params) {
			return await this.collection.save(params);
		},

		/**
		 *
		 * More info: https://dev.macrometa.io/docs/queries-1#queries
		 * 
		 * @param {*} ctx
		 * @param {*} params
		 */
		async findDocuments(ctx, params) {
			const cursor = await this.fabric.query(`FOR row IN ${this.collection.name} RETURN row`);
			const result = await cursor.all();

			return result;
		},

		async getDocument(ctx, key) {
			try {
				const doc = await this.collection.document(key);
				return doc;
			} catch(err) {
				throw new MoleculerClientError("Document is not found", 404, "NO_DOCUMENT", { key });
			}
		}
	},

	/**
	 * Service created lifecycle event handler
	 */
	created() {
		this.fabric = new Fabric(this.settings.fabric.config);
	},

	/**
	 * Service started lifecycle event handler
	 */
	async started() {
		await this.login(this.settings.fabric.email, this.settings.fabric.password);

		if (this.settings.fabric.collection) {
			this.collection = await this.openCollection(this.settings.fabric.collection);
		}

	},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped() {

	}
};