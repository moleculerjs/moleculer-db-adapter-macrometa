"use strict";

const { ServiceBroker } = require("moleculer");
const MacroMetaAdapter = require("../../src");

jest.mock("jsc8");
const FabricClient = require("jsc8");

const mockExists = jest.fn(() => Promise.resolve());
const mockCreate = jest.fn(() => Promise.resolve());

const mockCollection = jest.fn(() => {
	return { 
		exists: mockExists,
		create: mockCreate
	};
});
const mockDB = {
	login: jest.fn(() => Promise.resolve()),
	close: jest.fn(() => Promise.resolve()),
	useTenant: jest.fn(() => Promise.resolve()),
	useFabric: jest.fn(() => Promise.resolve()),
	query: jest.fn(() => Promise.resolve()),
	// Mock the collection
	collection: mockCollection
};

FabricClient.mockImplementation(() => {
	return mockDB;
});

describe("Test MacroMetaAdapter", () => {

	describe("Test the constructor", () => {
		it("should be created with a String", () => {
			const adapter = new MacroMetaAdapter("MY-C8-URL");
			expect(adapter.opts.url).toBe("MY-C8-URL");
		});

		it("should be created with a Array of string", () => {
			const adapter = new MacroMetaAdapter(["MY-C8-URL1", "MY-C8-URL2"]);
			expect(adapter.opts.url).toEqual(["MY-C8-URL1", "MY-C8-URL2"]);
		});

		it("should be created with an Object", () => {
			const adapter = new MacroMetaAdapter({
				url: "https://gdn1.macrometa.io",
				email: "FABRIC_EMAIL",
				password: "FABRIC_PASS",
			});
			expect(adapter.opts.url).toEqual("https://gdn1.macrometa.io");
			expect(adapter.opts.email).toEqual("FABRIC_EMAIL");
			expect(adapter.opts.password).toEqual("FABRIC_PASS");
		});

		it("should be created without params", () => {
			const adapter = new MacroMetaAdapter();
			expect(adapter.opts).toEqual({});
		});
	});

	describe("Test MacroMetaAdapter's methods", () => {
		const broker = new ServiceBroker();
		const service = broker.createService({
			name: "store"
		});

		const opts = {
			url: "https://gdn1.macrometa.io",

			email: "FABRIC_EMAIL",
			password: "FABRIC_PASS",

			tenant: "tenantName",
			fabric: "fabricName"
		};
		const adapter = new MacroMetaAdapter(opts);

		beforeAll(() => broker.start());
		afterAll(() => broker.stop());

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
				const service = broker.createService({
					name: "store"
				});

				try {
					adapter.init(broker, service);	
				} catch (error) {
					expect(error.message).toBe("Missing `collection` definition in schema of service!");	
				}
			});

			it("should throw an error - no email", () => {
				const service = broker.createService({
					name: "store",
					collection: "posts"
				});
				const adapter = new MacroMetaAdapter({url: "https://gdn1.macrometa.io"});

				try {
					adapter.init(broker, service);	
				} catch (error) {
					expect(error.message).toBe("The `email` and `password` fields are required to connect with Macrometa Services!");	
				}
			});

			it("should throw an error - no password", () => {
				const service = broker.createService({
					name: "store",
					collection: "posts"
				});
				const adapter = new MacroMetaAdapter({
					url: "https://gdn1.macrometa.io",
					email: "example@example.com"
				});

				try {
					adapter.init(broker, service);	
				} catch (error) {
					expect(error.message).toBe("The `email` and `password` fields are required to connect with Macrometa Services!");	
				}
			});
		});

		describe("Test connect and disconnect", () => {
			it("should connect", async () => {
				expect.assertions(2);

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

		it("should throw an error while 'openCollection' - collection doesn't exists", async () => {
			expect.assertions(1);

			try {
				await adapter.openCollection("dummy", false);
			} catch (error) {
				expect(error.message).toBe("Collection 'dummy' doesn't exist!");
			}
		});

		it("should successfully 'openCollection'", async () => {
			mockCollection.mockClear();
			mockExists.mockClear();
			
			expect.assertions(3);

			const collection = await adapter.openCollection("dummy");
			
			expect(collection).toBeDefined();
			expect(adapter.fabric.collection).toHaveBeenCalledTimes(1);
			expect(mockExists).toHaveBeenCalledTimes(1);
		});
	});
});

