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
const { DocumentCollection, Fabric, ArrayCursor } = require("jsc8");

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
			this.opts = { config: opts };
		else 
			this.opts = _.defaultsDeep({
				auth: {}
			}, opts);
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

		if (!this.opts.auth.email || !this.opts.auth.password) {
			throw new MoleculerError("The `email` and `password` fields are required to connect to Macrometa!");
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
		this.fabric = new FabricClient(this.opts.config);

		await this.login(this.opts.auth.email, this.opts.auth.password);

		/**
		 * @type {DocumentCollection}
		 */
		this.collection = await this.openCollection(this.service.schema.collection);
		this.logger.info("Fabric c8 connection has been established.");

		// Create shortcuts in service instance.
		this.service.collection = this.collection;
		this.service.fabric = this.fabric;
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
	 * List all collections.
	 * @param {Boolean} excludeSystem 
	 */
	listCollections(excludeSystem = true) {
		return this.fabric.listCollections(excludeSystem);
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
	async findByIds(idList, opts) {
		const cursor = await this.fabric.query(`
			FOR row IN ${this.collection.name} 
			  FILTER row._id IN @idList
			  RETURN row`, { idList }, opts);

		const res = await cursor.all();
		//cursor.delete(); // no 'await' because we don't want to wait for it.

		return res;
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
	async insertMany(entities, opts) {
		// TODO: is there bulk insert method?
		// return Promise.all(entities.map(entity => this.insert(entity, opts)));
		const cursor = await this.fabric.query(`
			FOR entity IN ${JSON.stringify(entities)}
				INSERT entity INTO ${this.collection.name}
				RETURN NEW`, {}, opts);

		const res = await cursor.all();
		//cursor.delete(); // no 'await' because we don't want to wait for it.

		return res;
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
	async updateMany(query, update, opts) {
		const cursor = await this.fabric.query(`
			FOR row IN ${this.collection.name} 
			  ${this.transformQuery(query)}
			  UPDATE row WITH
			    ${JSON.stringify(update)}
			  IN ${this.collection.name}
			  RETURN NEW._id
			  `, {}, opts);

		const res = await cursor.all();
		//cursor.delete(); // no 'await' because we don't want to wait for it.

		return res.length;		
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
	async updateById(_id, update, opts) {
		const res = await this.collection.update(_id, update, Object.assign({ returnNew : true }, opts));
		return res ? res["new"] : null;
	}

	/**
	 * Remove entities which are matched by `query`
	 *
	 * @param {Object} query
	 * @returns {Promise<Number>} Return with the count of deleted documents.
	 *
	 * @memberof MacroMetaAdapter
	 */
	async removeMany(query, opts) {
		const cursor = await this.fabric.query(`
			FOR row IN ${this.collection.name} 
			  ${this.transformQuery(query)}
			  REMOVE row IN ${this.collection.name}
			  RETURN OLD._id`, {}, opts);

		const res = await cursor.all();
		//cursor.delete(); // no 'await' because we don't want to wait for it.

		return res.length;	
	}

	/**
	 * Remove an entity by ID.
	 *
	 * @param {String} _id
	 * @param {Object?} opts
	 * @returns {Promise<Object>} Return with the removed _id & _key.
	 *
	 * @memberof MacroMetaAdapter
	 */
	removeById(_id, opts) {
		return this.collection.remove(_id, opts);
	}

	/**
	 * Clear all entities from collection.
	 *
	 * @returns {Promise}
	 *
	 * @memberof MacroMetaAdapter
	 */
	async clear() {
		await this.collection.truncate();

		return 0;
	}

	/**
	 * Execute a RAW C8 query.
	 * @param {String} query 
	 * @param {Object?} bindArguments 
	 * @param {Object?} opts 
	 */
	async rawQuery(query, bindArguments, opts) {
		const cursor = await this.fabric.query(query, bindArguments, opts);
		
		const res = await cursor.all();
		//cursor.delete(); // no 'await' because we don't want to wait for it.

		return res;
	}

	subscribeToChanges(cb, subscriptionName) {
		const dcName = Array.isArray(this.opts.config)
			? this.opts.config[0]
			: this.opts.config;

		this.collection.onChange({
			onmessage(msg) {
				try {
					const d = JSON.parse(msg);
					if (d.payload != "") {
						const payload = Buffer.from(d.payload, "base64");
						d.payload = JSON.parse(payload.toString());
						cb(null, d);
					}
				} catch(err) {
					cb(err, msg);	
				}
			},
			onerror(err) {
				cb(err);
			}
		}, dcName.split("://")[1], subscriptionName);
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
	 * @returns {ArrayCursor}
	 */
	async createCursor(params, opts) {
		let q = [];
		if (params) {
			q.push(`FOR row IN ${this.collection.name}`);
			
			// Use `LIKE` operator for text search
			// More info: https://dev.macrometa.io/docs/operators#comparison-operators
			// Example:
			// FOR doc IN @@collection
			// FILTER doc.content LIKE "%content%" OR doc.content LIKE "%Last%"
			// RETURN doc
			if (_.isString(params.search) && params.search !== "") {
				let fields = [];
				if (params.searchFields) {
					fields = _.isString(params.searchFields) ? params.searchFields.split(" ") : params.searchFields;
				}
				let filters = fields.map(field => `row.${field} LIKE "${params.search}"`).join(" OR ");

				// console.log(filters)
				q.push(`  FILTER ${filters}`);
			}

			/*
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
			*/

			// Filtering
			if (params.query) {
				q.push(this.transformQuery(params.query));
			}

			// Sort
			if (params.sort && q.sort) {
				let sort = this.transformSort(params.sort);
				if (sort)
					q.push(`  SORT ${sort}`);
			}

			// Limit
			if (_.isNumber(params.limit) && params.limit > 0) {
				// Offset
				if (_.isNumber(params.offset) && params.offset > 0)
					q.push(`  LIMIT ${params.offset}, ${params.limit}`);
				else
					q.push(`  LIMIT 0, ${params.limit}`);
			}

			q.push("  RETURN row");

			const qStr = q.join("\n");
			//console.log(qStr);
			return await this.fabric.query(qStr, {}, opts);
		}

		// If not params
		return await this.fabric.query(`FOR row IN ${this.collection.name} RETURN row`, {}, opts);
	}

	/**
	 * Transform a query object or string to C8QL filters.
	 * 
	 * @param {Object|String} query 
	 * @returns {String}
	 */
	transformQuery(query) {
		if (_.isObject(query)) {
			return Object.keys(query).map(key => `  FILTER row.${key} == ${JSON.stringify(query[key])}`).join("\n");
		} else if (_.isString(query)) {
			return `  FILTER ${query}`;
		}
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
			return sort.map(s => {
				if (s.startsWith("-"))
					return `row.${s.slice(1)} DESC`;
				else
					return `row.${s}`;
			}).join(", ");
		}

		return null;
	}

}

module.exports = MacroMetaAdapter;
