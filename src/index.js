/*
 * moleculer-db-adapter-macrometa
 * Copyright (c) 2019 MoleculerJS (https://github.com/moleculerjs/moleculer-db-adapter-macrometa)
 * MIT Licensed
 */

"use strict";

const _ 			= require("lodash");
const Promise		= require("bluebird");
const { ServiceSchemaError, MoleculerError } = require("moleculer").Errors;

const FabricClient = require("jsc8");
const c8ql = FabricClient.c8ql;

// Imports to add some IntelliSense
const { Service, ServiceBroker } = require("moleculer");
const { DocumentCollection, Fabric } = require("jsc8");

class MacroMetaAdapter {

	/**
	 * Creates an instance of MacroMetaAdapter.
	 * 
	 * @param {Object|String|Array<String>?} opts
	 *
	 * @memberof MacroMetaAdapter
	 */
	constructor(opts) {
		if (_.isString(opts) || Array.isArray(opts))
			this.opts = { url: opts };
		else 
			this.opts = opts || {};
	}

	/**
	 * Initialize adapter
	 *
	 * @param {ServiceBroker} broker
	 * @param {Service} service
	 *
	 * @memberof MacroMetaAdapter
	 */
	init(broker, service) {
		this.broker = broker;
		this.service = service;
		this.logger = this.service.logger;

		const schema = this.service.schema;

		if (!schema.collection) {
			throw new ServiceSchemaError("Missing `collection` definition in schema of service!");
		}

		if (!this.opts.email || !this.opts.password) {
			throw new MoleculerError("The `email` and `password` fields are required to connect with Macrometa Services!");
		}
	}

	/**
	 * Connect to database
	 *
	 * @returns {Promise}
	 *
	 * @memberof MacroMetaAdapter
	 */
	async connect() {
		/**
		 * @type {Fabric}
		 */
		this.fabric = new FabricClient(this.opts.url);

		await this.login(this.opts.email, this.opts.password);

		/**
		 * @type {DocumentCollection}
		 */
		this.collection = await this.openCollection(this.service.schema.collection);
		this.logger.info("Fabric c8 connection has been established.");
	}

	/**
	 * Disconnect from database
	 *
	 * @returns {Promise}
	 *
	 * @memberof MacroMetaAdapter
	 */
	disconnect() {
		if (this.fabric) {
			return this.fabric.close();
		}
		return Promise.resolve();
	}

	/**
	 * Login to the server.
	 * 
	 * @param {String} email 
	 * @param {String} password 
	 */
	async login(email, password) {
		this.logger.info(`Logging in with '${email}'...`);
		await this.fabric.login(email, password);
		this.logger.info("Logged in.");

		if (this.opts.tenant) {
			this.logger.info(`Switch tenant to '${this.opts.tenant}'`);
			this.fabric.useTenant(this.opts.tenant);
		}

		if (this.opts.fabric) {
			this.logger.info(`Switch Fabric to '${this.opts.fabric}'`);
			this.fabric.useFabric(this.opts.fabric);
		}
	}

	/**
	 * Open or create a collection.
	 * 
	 * @param {String} name 
	 * @param {Boolean?} createIfNotExist 
	 */
	async openCollection(name, createIfNotExist = true) {
		this.logger.info(`Open '${name}' collection...`);
		const collection = this.fabric.collection(name);
		if (!(await collection.exists())) {
			if (createIfNotExist) {
				this.logger.info(`Create '${name}' collection...`);
				await collection.create();
			} else {
				throw new MoleculerError(`Collection '${name}' doesn't exist!`, 500, "COLLECTION_NOT_EXIST", { name });
			}
		}

		this.logger.info(`Collection '${name}' opened.`);

		return collection;
	}

	/**
	 * Find all entities by filters.
	 *
	 * Available filter props:
	 * 	- limit
	 *  - offset
	 *  - sort
	 *  - search
	 *  - searchFields
	 *  - query
	 *
	 * @param {Object} filters
	 * @returns {Promise<Array>}
	 *
	 * @memberof MacroMetaAdapter
	 */
	async find(filters) {
		const cursor = await this.createCursor(filters);
		const res = await cursor.all();
		//cursor.delete(); // no 'await' because we don't want to wait for it.

		return res;
	}

	/**
	 * Find an entity by query
	 *
	 * @param {Object} query
	 * @returns {Promise}
	 * @memberof MemoryDbAdapter
	 */
	async findOne(query) {
		const cursor = await this.createCursor({ query });
		if (cursor.hasNext()) {
			const res = await cursor.next();
			//cursor.delete(); // no 'await' because we don't want to wait for it.
			return res;
		} else {
			//cursor.delete(); // no 'await' because we don't want to wait for it.
			return null;
		}
	}

	/**
	 * Find an entities by key.
	 *
	 * @param {String} key
	 * @returns {Promise<Object>} Return with the found document.
	 *
	 * @memberof MacroMetaAdapter
	 */
	async findById(key) {
		return await this.collection.document(key);
	}

	/**
	 * Find any entities by IDs.
	 *
	 * @param {Array} idList
	 * @returns {Promise<Array>} Return with the found documents in an Array.
	 *
	 * @memberof MacroMetaAdapter
	 */
	findByIds(idList) {
		// TODO: not implemented
		throw new Error("not implemented");
		/*
		return this.collection.find({
			_id: {
				$in: idList.map(id => this.stringToObjectID(id))
			}
		}).toArray();
		*/
	}

	/**
	 * Get count of filtered entities.
	 *
	 * Available query props:
	 *  - search
	 *  - searchFields
	 *  - query
	 *
	 * @param {Object} [filters={}]
	 * @returns {Promise<Number>} Return with the count of documents.
	 *
	 * @memberof MacroMetaAdapter
	 */
	async count(filters) {
		const cursor = await this.createCursor(filters, { count: true });
		const res = cursor.count;
		//cursor.delete(); // no 'await' because we don't want to wait for it.

		return res;
	}

	/**
	 * Insert an entity.
	 *
	 * @param {Object} entity
	 * @param {Object?} opts
	 * @returns {Promise<Object>} Return with the inserted document.
	 *
	 * @memberof MacroMetaAdapter
	 */
	async insert(entity, opts) {
		const res = await this.collection.save(entity, Object.assign({ returnNew : true }, opts));
		return res["new"];
	}

	/**
	 * Insert many entities
	 *
	 * @param {Array} entities
	 * @param {Object?} opts
	 * @returns {Promise<Array<Object>>} Return with the inserted documents in an Array.
	 *
	 * @memberof MacroMetaAdapter
	 */
	insertMany(entities, opts) {
		// TODO: is there bulk insert method?
		return Promise.all(entities.map(entity => this.insert(entity, opts)));
	}

	/**
	 * Update many entities by `query` and `update`
	 *
	 * @param {Object} query
	 * @param {Object} update
	 * @returns {Promise<Number>} Return with the count of modified documents.
	 *
	 * @memberof MacroMetaAdapter
	 */
	updateMany(query, update) {
		// TODO: not implemented
		throw new Error("not implemented");
	}

	/**
	 * Update an entity by ID and `update`
	 *
	 * @param {String} _id - ObjectID as hexadecimal string.
	 * @param {Object} update
	 * @param {Object?} opts
	 * @returns {Promise<Object>} Return with the updated document.
	 *
	 * @memberof MacroMetaAdapter
	 */
	updateById(_id, update, opts) {
		return this.collection.update(_id, update, Object.assign({ returnNew : true }, opts));
	}

	/**
	 * Remove entities which are matched by `query`
	 *
	 * @param {Object} query
	 * @returns {Promise<Number>} Return with the count of deleted documents.
	 *
	 * @memberof MacroMetaAdapter
	 */
	removeMany(query) {
		// TODO: not implemented
		throw new Error("not implemented");
	}

	/**
	 * Remove an entity by ID.
	 *
	 * @param {String} _id
	 * @param {Object?} opts
	 * @returns {Promise<Object>} Return with the removed document.
	 *
	 * @memberof MacroMetaAdapter
	 */
	removeById(_id, opts) {
		return this.collection.remove(_id, opts);
	}

	/**
	 * Clear all entities from collection
	 *
	 * @param {Object?} opts
	 * @returns {Promise}
	 *
	 * @memberof MacroMetaAdapter
	 */
	clear(opts) {
		return this.collection.truncate(opts);
	}

	/**
	 * Create a filtered cursor.
	 *
	 * Available filters in `params`:
	 *  - search
	 * 	- sort
	 * 	- limit
	 * 	- offset
	 *  - query
	 *
 	 * @param {Object} params
 	 * @param {Object} opts
	 * @returns {MongoCursor}
	 */
	async createCursor(params, opts) {
		let q;
		if (params) {
			// TODO: not implemented
			throw new Error("not implemented");

			// Full-text search
			// More info: https://docs.mongodb.com/manual/reference/operator/query/text/
			if (_.isString(params.search) && params.search !== "") {
				q = fn.call(this.collection, Object.assign(params.query || {}, {
					$text: {
						$search: params.search
					}
				}));

				if (q.project && !isCounting)
					q.project({ _score: { $meta: "textScore" } });

				if (q.sort && !isCounting) {
					q.sort({
						_score: {
							$meta: "textScore"
						}
					});
				}
			} else {
				q = fn.call(this.collection, params.query);

				// Sort
				if (params.sort && q.sort) {
					let sort = this.transformSort(params.sort);
					if (sort)
						q.sort(sort);
				}
			}

			// Offset
			if (_.isNumber(params.offset) && params.offset > 0)
				q.skip(params.offset);

			// Limit
			if (_.isNumber(params.limit) && params.limit > 0)
				q.limit(params.limit);

			return q;
		}

		// If not params
		return await this.fabric.query(`FOR row IN ${this.collection.name} RETURN row`, {}, opts);
	}

	/**
	 * Convert the `sort` param to a `sort` object to Mongo queries.
	 *
	 * @param {String|Array<String>|Object} paramSort
	 * @returns {Object} Return with a sort object like `{ "votes": 1, "title": -1 }`
	 * @memberof MacroMetaAdapter
	 */
	transformSort(paramSort) {
		let sort = paramSort;
		if (_.isString(sort))
			sort = sort.replace(/,/, " ").split(" ");

		if (Array.isArray(sort)) {
			let sortObj = {};
			sort.forEach(s => {
				if (s.startsWith("-"))
					sortObj[s.slice(1)] = -1;
				else
					sortObj[s] = 1;
			});
			return sortObj;
		}

		return sort;
	}

}

module.exports = MacroMetaAdapter;
