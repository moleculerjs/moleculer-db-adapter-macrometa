"use strict";

const { ServiceBroker } = require("moleculer");
const MacroMetaAdapter = require("../../src");

describe("Test MacroMetaAdapter", () => {

	describe('Test the constructor', () => {
		it("should be created with a String", () => {
			const adapter = new MacroMetaAdapter("MY-C8-URL")
			expect(adapter.opts.url).toBe("MY-C8-URL")
		})

		it("should be created with a Array of string", () => {
			const adapter = new MacroMetaAdapter(["MY-C8-URL1", "MY-C8-URL2"])
			expect(adapter.opts.url).toEqual(["MY-C8-URL1", "MY-C8-URL2"])
		})

		it("should be created with an Object", () => {
			const adapter = new MacroMetaAdapter({
				url: "https://gdn1.macrometa.io",
				email: "FABRIC_EMAIL",
				password: "FABRIC_PASS",
			})
			expect(adapter.opts.url).toEqual("https://gdn1.macrometa.io")
			expect(adapter.opts.email).toEqual("FABRIC_EMAIL")
			expect(adapter.opts.password).toEqual("FABRIC_PASS")
		})

		it("should be created without params", () => {
			const adapter = new MacroMetaAdapter()
			expect(adapter.opts).toEqual({})
		})
	})

	describe("Test MacroMetaAdapter's methods", () => {
		const broker = new ServiceBroker();
		const service = broker.createService({
			name: "store",
		});

		const opts = {
			url: "https://gdn1.macrometa.io",

			email: "FABRIC_EMAIL",
			password: "FABRIC_PASS",

			tenant: null,
			fabric: null
		}
		const adapter = new MacroMetaAdapter(opts)

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
	});
});

