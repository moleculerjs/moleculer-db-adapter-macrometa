![Moleculer logo](http://moleculer.services/images/banner.png)

[![Build Status](https://travis-ci.org/moleculerjs/moleculer-db-adapter-macrometa.svg?branch=master)](https://travis-ci.org/moleculerjs/moleculer-db-adapter-macrometa)
[![Coverage Status](https://coveralls.io/repos/github/moleculerjs/moleculer-db-adapter-macrometa/badge.svg?branch=master)](https://coveralls.io/github/moleculerjs/moleculer-db-adapter-macrometa?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/github/moleculerjs/moleculer-db-adapter-macrometa/badge.svg)](https://snyk.io/test/github/moleculerjs/moleculer-db-adapter-macrometa)

# [WIP] moleculer-db-adapter-macrometa [![NPM version](https://img.shields.io/npm/v/moleculer-db-adapter-macrometa.svg)](https://www.npmjs.com/package/moleculer-db-adapter-macrometa)

Moleculer Data access service for [MacroMeta.co](https://www.macrometa.co/).

## Features
- auto creating collection
- raw C8QL queries
- save & execute named queries
- subscription to collection changes

## Install
```
npm install moleculer-db-adapter-macrometa --save
```

## Usage
```js
"use strict";

const { ServiceBroker } = require("moleculer");
const DbService = require("moleculer-db");
const MacroMetaAdapter = require("moleculer-db-adapter-macrometa");
const Sequelize = require("sequelize");

const broker = new ServiceBroker();

// Create a Sequelize service for `post` entities
broker.createService({
    name: "posts",
    mixins: [DbService],
    adapter: new MacroMetaAdapter({
		config: "https://gdn1.macrometa.io",

		auth: {
			email: "macrometa@moleculer.services",
			password: "secretpass"
		},

		tenant: null, // use default
		fabric: null // use default
	}),
    collection: "posts" // Name of collection
});


broker.start()
// Create a new post 
.then(() => broker.call("posts.create", {
    title: "My first post",
    content: "Lorem ipsum...",
    votes: 0
}))

// Get all posts
.then(() => broker.call("posts.find").then(console.log));
```

### Raw queries
You can reach the `sequelize` instance via `this.adapter.db`. To call [Raw queries](http://docs.sequelizejs.com/manual/raw-queries.html):

```js
// posts.service.js
module.exports = {
	name: "posts",
	adapter: new MacroMetaAdapter(),
    actions: {
        findHello2() {
            return this.adapter.db.query("SELECT * FROM posts WHERE title = 'Hello 2' LIMIT 1")
                .then(([res, metadata]) => res);
        }
    }
}
```

### Subscribe to changes
```js
// posts.service.js
module.exports = {
	name: "posts",
	adapter: new MacroMetaAdapter(),
	methods: {
		onChanges(payload) {
			this.logger.info("Collection has been changed", payload);
		}
	},
	async started() {
		await this.adapter.subscribeToChanges((err msg) => {
			if (err)
				return this.logger.error("Subscription error", err);

			this.onChanges(msg.payload);
		});
	},

	async stopped() {
		await this.adapter.unsubscribeFromChanges();
	}
}
```

### Named queries
```js
await this.adapter.saveQuery(name, query, parameters);
await this.adapter.executeSavedQuery(name,variables);
```

## Test
```
$ npm test
```

In development with watching

```
$ npm run ci
```

## Contribution
Please send pull requests improving the usage and fixing bugs, improving documentation and providing better examples, or providing some testing, because these things are important.

## License
The project is available under the [MIT license](https://tldrlegal.com/license/mit-license).

## Contact
Copyright (c) 2019 MoleculerJS

[![@MoleculerJS](https://img.shields.io/badge/github-moleculerjs-green.svg)](https://github.com/moleculerjs) [![@MoleculerJS](https://img.shields.io/badge/twitter-MoleculerJS-blue.svg)](https://twitter.com/MoleculerJS)