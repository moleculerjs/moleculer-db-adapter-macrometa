"use strict";

const { ServiceBroker } = require("moleculer");
const MacroMetaAdapter = require("../../src");

jest.mock("jsc8");
const FabricClient = require("jsc8");

const lolex = require("lolex");

const mockCollection = {
	exists: jest.fn(() => Promise.resolve()),
	create: jest.fn(() => Promise.resolve()),
	onChange: jest.fn(() => Promise.resolve()),
	document: jest.fn(() => Promise.resolve()),
	save: jest.fn(() => Promise.resolve()),
	update: jest.fn(() => Promise.resolve()),
	remove: jest.fn(() => Promise.resolve()),
	truncate: jest.fn(() => Promise.resolve()),
	closeOnChangeConnection: jest.fn(() => Promise.resolve()),
};

const mockCollectionCreator = jest.fn((name) => {
	// set collection name
	mockCollection.name = name;
	return mockCollection;
});

const mockDB = {
	login: jest.fn(() => Promise.resolve()),
	close: jest.fn(() => Promise.resolve()),
	useTenant: jest.fn(() => Promise.resolve()),
	useFabric: jest.fn(() => Promise.resolve()),
	query: jest.fn(() => Promise.resolve()),
	// Mock the collection
	collection: mockCollectionCreator,
	listCollections: jest.fn(() => Promise.resolve()),
	saveQuery: jest.fn(() => Promise.resolve()),
	executeSavedQuery: jest.fn(() => Promise.resolve()),
};

FabricClient.mockImplementation(() =>  mockDB);

describe("Test MacroMetaAdapter", () => {

	describe("Test the constructor", () => {
		it("should be created with a String", () => {
			const adapter = new MacroMetaAdapter("MY-C8-URL");
			expect(adapter.opts.config).toBe("MY-C8-URL");
		});

		it("should be created with a Array of string", () => {
			const adapter = new MacroMetaAdapter(["MY-C8-URL1", "MY-C8-URL2"]);
			expect(adapter.opts.config).toEqual(["MY-C8-URL1", "MY-C8-URL2"]);
		});

		it("should be created with an Object", () => {
			const adapter = new MacroMetaAdapter({
				config: "https://gdn1.macrometa.io",
				auth: {
					email: "FABRIC_EMAIL",
					password: "FABRIC_PASS",
				}
			});
			expect(adapter.opts.config).toEqual("https://gdn1.macrometa.io");
			expect(adapter.opts.auth.email).toEqual("FABRIC_EMAIL");
			expect(adapter.opts.auth.password).toEqual("FABRIC_PASS");
		});

		it("should be created without params", () => {
			const adapter = new MacroMetaAdapter();
			expect(adapter.opts).toEqual({auth:{}});
		});
	});


	describe("Test MacroMetaAdapter's methods", () => {
		const broker = new ServiceBroker( { logger: false});
		const service = broker.createService({
			name: "store",
			collection: "posts"
		});

		const adapter = new MacroMetaAdapter({
			config: "https://gdn1.macrometa.io",
	
			auth: {
				email: "FABRIC_EMAIL",
				password: "FABRIC_PASS"
			},
	
			tenant: "tenantName",
			fabric: "fabricName"
		});

		beforeEach(async () => {
			adapter.init(broker, service);
			await adapter.connect();
			await adapter.openCollection("posts");
		});

		afterEach(async () => {
			await adapter.disconnect();
			adapter.fabric.close.mockClear();
		});
		
		it("should be created", () => {
			expect(adapter).toBeDefined();
			expect(adapter.opts).toBeDefined();
			expect(adapter.init).toBeDefined();
			expect(adapter.connect).toBeDefined();
			expect(adapter.disconnect).toBeDefined();
			expect(adapter.login).toBeDefined();
			expect(adapter.openCollection).toBeDefined();
			expect(adapter.find).toBeDefined();
			expect(adapter.findOne).toBeDefined();
			expect(adapter.findById).toBeDefined();
			expect(adapter.count).toBeDefined();
			expect(adapter.insert).toBeDefined();
			expect(adapter.updateMany).toBeDefined();
			expect(adapter.updateById).toBeDefined();
			expect(adapter.removeMany).toBeDefined();
			expect(adapter.removeById).toBeDefined();
			expect(adapter.clear).toBeDefined();
			expect(adapter.createCursor).toBeDefined();
			expect(adapter.transformSort).toBeDefined();
		});
		
		describe("Test init", () => {
			it("should throw an error - no collection name", () => {
				const svc = broker.createService({
					name: "store",
				});

				try {
					adapter.init(broker, svc);	
				} catch (error) {
					expect(error.message).toBe("Missing `collection` definition in schema of service!");	
				}
			});
			
			it("should throw an error - no email", () => {
				const svc = broker.createService({
					name: "store",
					collection: "posts"
				});
				const adapter = new MacroMetaAdapter({config: "https://gdn1.macrometa.io"});

				try {
					adapter.init(broker, svc);	
				} catch (error) {
					expect(error.message).toBe("The `email` and `password` fields are required to connect to Macrometa!");	
				}
			});

			it("should throw an error - no password", () => {
				const svc = broker.createService({
					name: "store",
					collection: "posts"
				});
				const adapter = new MacroMetaAdapter({
					config: "https://gdn1.macrometa.io",
					auth: { email: "example@example.com" }
				});

				try {
					adapter.init(broker, svc);	
				} catch (error) {
					expect(error.message).toBe("The `email` and `password` fields are required to connect to Macrometa!");	
				}
			});
		});

		describe("Test connect and disconnect", () => {
			it("should connect", async () => {
				expect.assertions(2);

				adapter.init(broker, service);	

				await adapter.connect();

				expect(adapter.fabric).toBeDefined();
				expect(adapter.collection).toBeDefined();
			});

			it("should disconnect", async () => {
				expect.assertions(1);

				await adapter.disconnect();

				expect(adapter.fabric.close).toHaveBeenCalledTimes(1);
			});			
		});


		describe("Test openCollection", () => {
			it("should throw an error while 'openCollection' - collection doesn't exists", async () => {
				expect.assertions(1);
				adapter.init(broker, service);
				try {
					await adapter.openCollection("dummy", false);
				} catch (error) {
					expect(error.message).toBe("Collection 'dummy' doesn't exist!");
				}
			});

			it("should successfully 'openCollection'", async () => {
				adapter.init(broker, service);

				mockDB.collection.mockClear();
				mockCollection.exists.mockClear();
				
				expect.assertions(3);

				const collection = await adapter.openCollection("dummy");
				
				expect(collection).toBeDefined();
				expect(adapter.fabric.collection).toHaveBeenCalledTimes(1);
				expect(mockCollection.exists).toHaveBeenCalledTimes(1);
			});
		});
		
		describe("Test createCursor", () => {
			it("call without params", () => {
				adapter.fabric.query.mockClear();

				adapter.createCursor();
				
				expect(adapter.fabric.query).toHaveBeenCalledTimes(1);
				expect(adapter.fabric.query).toHaveBeenCalledWith("FOR row IN posts RETURN row", {}, undefined);
			});


			it("call with params - text search and searchFields as Array", () => {
				adapter.fabric.query.mockClear();

				adapter.createCursor({ search: "%content%", searchFields: ["content"] });
				
				expect(adapter.fabric.query).toHaveBeenCalledTimes(1);
				const expectedQuery = "FOR row IN posts\n  FILTER row.content LIKE \"%content%\"\n  RETURN row";
				expect(adapter.fabric.query).toHaveBeenCalledWith(expectedQuery, {}, undefined);
			});

			it("call with params - text search and searchFields as String", () => {
				adapter.fabric.query.mockClear();

				adapter.createCursor({ search: "%content%", searchFields: "content" });
				
				expect(adapter.fabric.query).toHaveBeenCalledTimes(1);
				const expectedQuery = "FOR row IN posts\n  FILTER row.content LIKE \"%content%\"\n  RETURN row";
				expect(adapter.fabric.query).toHaveBeenCalledWith(expectedQuery, {}, undefined);
			});

			it("call with params - query", () => {
				adapter.fabric.query.mockClear();

				adapter.createCursor({ query: "row.votes > 2" });
				
				expect(adapter.fabric.query).toHaveBeenCalledTimes(1);
				const expectedQuery = "FOR row IN posts\n  FILTER row.votes > 2\n  RETURN row";
				expect(adapter.fabric.query).toHaveBeenCalledWith(expectedQuery, {}, undefined);
			});

			it("call with params - sort", () => {
				adapter.fabric.query.mockClear();

				adapter.createCursor({sort: ["votes", "-title"]});
				
				expect(adapter.fabric.query).toHaveBeenCalledTimes(1);
				const expectedQuery = "FOR row IN posts\n  SORT row.votes, row.title DESC\n  RETURN row";
				expect(adapter.fabric.query).toHaveBeenCalledWith(expectedQuery, {}, undefined);
			});

			it("call with params - limit without offset", () => {
				adapter.fabric.query.mockClear();

				adapter.createCursor({ limit: 1 });
				
				expect(adapter.fabric.query).toHaveBeenCalledTimes(1);
				const expectedQuery = "FOR row IN posts\n  LIMIT 0, 1\n  RETURN row";
				expect(adapter.fabric.query).toHaveBeenCalledWith(expectedQuery, {}, undefined);
			});

			it("call with params - limit with offset", () => {
				adapter.fabric.query.mockClear();

				adapter.createCursor({ limit: 1, offset: 1 });
				
				expect(adapter.fabric.query).toHaveBeenCalledTimes(1);
				const expectedQuery = "FOR row IN posts\n  LIMIT 1, 1\n  RETURN row";
				expect(adapter.fabric.query).toHaveBeenCalledWith(expectedQuery, {}, undefined);
			});
		});

		describe("Test transformQuery", () => {
			it("call with query as String", () => {
				const query = "row.votes > 2";

				const actual = adapter.transformQuery(query);
				const expected = "  FILTER row.votes > 2";

				expect(actual).toBe(expected);
			});

			it("call with query as Object", () => {
				const query = { title: "Last" };
				
				const actual = adapter.transformQuery(query);
				const expected = "  FILTER row.title == \"Last\"";

				expect(actual).toBe(expected);
			});
		});

		describe("Test transformSort", () => {
			it("call with undefined", () => {
				const actual = adapter.transformSort();
				expect(actual).toBe(null);
			});

			it("call with query as String - Ascending", () => {
				const query = "votes";

				const actual = adapter.transformSort(query);
				const expected = "row.votes";

				expect(actual).toBe(expected);
			});

			it("call with query as String - Descending", () => {
				const query = "-votes";

				const actual = adapter.transformSort(query);
				const expected = "row.votes DESC";

				expect(actual).toBe(expected);
			});
		});

		it("call listCollections", () => {
			adapter.listCollections();
			expect(adapter.fabric.listCollections).toHaveBeenCalledTimes(1);
			expect(adapter.fabric.listCollections).toHaveBeenCalledWith(true);
		});

		it("call find", async () => {
			// mock cursor's methods
			const mockCursor = {
				all: jest.fn(() => Promise.resolve()),
			};
			adapter.createCursor = jest.fn(() => Promise.resolve(mockCursor)); 

			await adapter.find();

			expect(adapter.createCursor).toHaveBeenCalledTimes(1);
			expect(mockCursor.all).toHaveBeenCalledTimes(1);
		});

		it("call findOne - hasNext: true", async () => {
			// mock cursor's methods
			const mockCursor = {
				hasNext: jest.fn(() => true),
				next: jest.fn(() => Promise.resolve())				
			};

			adapter.createCursor = jest.fn(() => Promise.resolve(mockCursor)); 

			await adapter.findOne();

			expect(adapter.createCursor).toHaveBeenCalledTimes(1);
			expect(mockCursor.hasNext).toHaveBeenCalledTimes(1);
			expect(mockCursor.next).toHaveBeenCalledTimes(1);
		});

		it("call findOne - hasNext: false", async () => {
			// mock cursor's methods
			const mockCursor = {
				hasNext: jest.fn(() => false),
				next: jest.fn(() => Promise.resolve())				
			};

			adapter.createCursor = jest.fn(() => Promise.resolve(mockCursor)); 

			let result = await adapter.findOne();

			expect(result).toEqual(null);
			expect(adapter.createCursor).toHaveBeenCalledTimes(1);
			expect(mockCursor.hasNext).toHaveBeenCalledTimes(1);
			expect(mockCursor.next).toHaveBeenCalledTimes(0);
		});

		it("call findById", async () => {
			await adapter.findById("myID");

			expect(adapter.collection.document).toHaveBeenCalledTimes(1);
			expect(adapter.collection.document).toHaveBeenCalledWith("myID");
		});

		it("call findByIds", async () => {
			mockDB.query.mockClear();

			const mockCursor = jest.fn(() => Promise.resolve());
			adapter.fabric.query = jest.fn(() => Promise.resolve({
				// mock cursor's methods
				all: mockCursor
			})); 

			await adapter.findByIds(["1", "2"]);
		
			expect(adapter.fabric.query).toHaveBeenCalledTimes(1);
			expect(mockCursor).toHaveBeenCalledTimes(1);
		});


		it("call count", async () => {
			// mock cursor's methods
			const mockCursor = { count: 123 };

			adapter.createCursor = jest.fn(() => Promise.resolve(mockCursor)); 

			let result = await adapter.count();

			expect(adapter.createCursor).toHaveBeenCalledTimes(1);
			expect(result).toBe(123);
		});

		it("call insert", async () => {

			adapter.collection.save = jest.fn(() => Promise.resolve({new: {id: 123}})); 

			let result = await adapter.insert();

			expect(adapter.collection.save).toHaveBeenCalledTimes(1);
			expect(result).toEqual({id: 123});
		});


		it("call insertMany", async () => {
			const mockCursor = jest.fn(() => Promise.resolve());
			adapter.fabric.query = jest.fn(() => Promise.resolve({
				// mock cursor's methods
				all: mockCursor
			})); 

			await adapter.insertMany();
		
			expect(adapter.fabric.query).toHaveBeenCalledTimes(1);
			expect(mockCursor).toHaveBeenCalledTimes(1);
		});

		it("call updateMany", async () => {
			const mockCursor = jest.fn(() => Promise.resolve([{id: 123}, {id: 456}]));
			adapter.fabric.query = jest.fn(() => Promise.resolve({
				// mock cursor's methods
				all: mockCursor
			})); 

			let result = await adapter.updateMany();
		
			expect(adapter.fabric.query).toHaveBeenCalledTimes(1);
			expect(mockCursor).toHaveBeenCalledTimes(1);
			expect(result).toBe(2);
		});

		it("call updateById - with result", async () => {

			adapter.collection.update = jest.fn(() => Promise.resolve({new: {id: 123}}));

			let result = await adapter.updateById("myID", {update: "updateData"});

			expect(adapter.collection.update).toHaveBeenCalledTimes(1);
			expect(adapter.collection.update).toHaveBeenCalledWith("myID", {update: "updateData"}, { returnNew : true });
			expect(result).toEqual({id: 123});
		});

		it("call updateById - with result", async () => {

			adapter.collection.update = jest.fn(() => undefined);

			let result = await adapter.updateById("myID", {update: "updateData"});

			expect(adapter.collection.update).toHaveBeenCalledTimes(1);
			expect(adapter.collection.update).toHaveBeenCalledWith("myID", {update: "updateData"}, { returnNew : true });
			expect(result).toEqual(null);
		});

		it("call removeMany", async () => {
			const mockCursor = jest.fn(() => Promise.resolve([{id: 123}, {id: 456}]));
			adapter.fabric.query = jest.fn(() => Promise.resolve({
				// mock cursor's methods
				all: mockCursor
			})); 

			let result = await adapter.removeMany();
		
			expect(adapter.fabric.query).toHaveBeenCalledTimes(1);
			expect(mockCursor).toHaveBeenCalledTimes(1);
			expect(result).toBe(2);
		});

		it("call removeById", async () => {

			adapter.collection.remove = jest.fn(() => Promise.resolve({new: {id: 123}})); 

			await adapter.removeById(123);

			expect(adapter.collection.remove).toHaveBeenCalledTimes(1);
			expect(adapter.collection.remove).toHaveBeenCalledWith(123, undefined);
		});

		it("call clear", async () => {
			await adapter.clear();
			expect(adapter.collection.truncate).toHaveBeenCalledTimes(1);
		});


		it("call rawQuery", async () => {
			const mockCursor = jest.fn(() => Promise.resolve());
			adapter.fabric.query = jest.fn(() => Promise.resolve({
				// mock cursor's methods
				all: mockCursor
			})); 

			await adapter.rawQuery("myQuery", {bindArguments: "bindArguments"}, {opts: "opts"});
		
			expect(adapter.fabric.query).toHaveBeenCalledTimes(1);
			expect(adapter.fabric.query).toHaveBeenCalledWith("myQuery", {bindArguments: "bindArguments"}, {opts: "opts"});
			expect(mockCursor).toHaveBeenCalledTimes(1);
		});

		it("call saveQuery", () => {
			adapter.saveQuery("myName", "myQuery");
		
			expect(adapter.fabric.saveQuery).toHaveBeenCalledTimes(1);
			expect(adapter.fabric.saveQuery).toHaveBeenCalledWith("myName", {} ,"myQuery");
		});

		it("call executeSavedQuery", () => {
			adapter.executeSavedQuery("myName", {variables: "myVariables"});
		
			expect(adapter.fabric.executeSavedQuery).toHaveBeenCalledTimes(1);
			expect(adapter.fabric.executeSavedQuery).toHaveBeenCalledWith("myName", {variables: "myVariables"});
		});

		describe("Test openCollection", () => {

			let clock;
			beforeAll(()=> clock = lolex.install());
			afterAll(() => clock.uninstall());

			it("call subscribeToChanges - onopen", async () => {
				const cb = jest.fn((error, data) => {
					if (error) return error;
					return data;
				});
	
				adapter.collection.onChange = jest.fn((callbackObj, dcName, subscriptionName) => {
					const  { onopen } = callbackObj;
					setTimeout(() => onopen(), 1000);
				});
	
				let promise = adapter.subscribeToChanges(cb);
	
				clock.tick(5000);
	
				
				expect(promise).toBeTruthy();
				expect(adapter.collection.onChange).toBeCalledTimes(1);
				expect(cb).toBeCalledTimes(0);
			});
	
			it("call subscribeToChanges - onclose", async () => {
				const cb = jest.fn((error, data) => {
					if (error) return error;
					return data;
				});
	
				adapter.collection.onChange = jest.fn((callbackObj, dcName, subscriptionName) => {
					const  { onclose } = callbackObj;
					setTimeout(() => onclose(), 1000);
				});
	
				let promise = adapter.subscribeToChanges(cb);
	
				clock.tick(5000);
				
				expect(promise).toBeTruthy();
				expect(adapter.collection.onChange).toBeCalledTimes(1);
				expect(cb).toBeCalledTimes(0);
			});
	
			it("call subscribeToChanges - onmessage - callback data", async () => {
				const cb = jest.fn((error, data) => {
					if (error) return error;
					return data;
				});
	
				adapter.collection.onChange = jest.fn((callbackObj, dcName, subscriptionName) => {
					const  { onmessage } = callbackObj;
					setTimeout(() => onmessage("{ \"payload\":  \"eyAiZGF0YSI6ICJjaGFuZ2UgbWVzc2FnZSIgfQ==\" }"), 1000);
				});
	
				let promise = adapter.subscribeToChanges(cb);
	
				clock.tick(5000);
				
				expect(promise).toBeTruthy();
				expect(adapter.collection.onChange).toBeCalledTimes(1);
				expect(cb).toBeCalledTimes(1);
				expect(cb).toBeCalledWith(null, {payload: { data: "change message"} });
			});

			it("call subscribeToChanges - onmessage - callback data", async () => {
				const cb = jest.fn((error, data) => {
					if (error) return error;
					return data;
				});
	
				adapter.collection.onChange = jest.fn((callbackObj, dcName, subscriptionName) => {
					const  { onmessage } = callbackObj;
					setTimeout(() => onmessage("{ \"payload\":  \"dummy\" }"), 1000);
				});
	
				let promise = adapter.subscribeToChanges(cb);
	
				clock.tick(5000);
				
				expect(promise).toBeTruthy();
				expect(adapter.collection.onChange).toBeCalledTimes(1);
				expect(cb).toBeCalledTimes(1);
				expect(cb.mock.calls[0][0].message).toBe("Unexpected token v in JSON at position 0");
				expect(cb.mock.calls[0][1]).toBe("{ \"payload\":  \"dummy\" }");
			});
	
			it("call subscribeToChanges - onerror & disconnected", async () => {
				const cb = jest.fn((error, data) => {
					if (error) return error;
					return data;
				});
	
				adapter.collection.onChange = jest.fn((callbackObj, dcName, subscriptionName) => {
					const  { onerror } = callbackObj;
					setTimeout(() => onerror("ERROR"), 1000);
				});
	
				let promise = adapter.subscribeToChanges(cb);
	
				clock.tick(5000);
	
				expect.assertions(3);
				try {
					await promise;
				} catch (error) {
					expect(error).toBe("ERROR");
					expect(adapter.collection.onChange).toBeCalledTimes(1);
					expect(cb).toBeCalledTimes(0);
				}
			});
		});

		it("call unsubscribeFromChanges", () => {
			adapter.unsubscribeFromChanges();
		
			expect(adapter.collection.closeOnChangeConnection).toHaveBeenCalledTimes(1);
		});
	});
});