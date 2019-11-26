/*
 * moleculer-db
 * Copyright (c) 2019 MoleculerJS (https://github.com/moleculerjs/moleculer-db)
 * MIT Licensed
 */

"use strict";

const _ = require("lodash");
const kleur = require("kleur");

class ModuleChecker {

	constructor(okCount) {
		this.okCount = okCount;
		this.ok = 0;
		this.fail = 0;
	}

	async check(title, fn, cb) {
		this.printTitle(title);
		const startTime = process.hrtime();
		let dur;
		try {
			const rsp = await fn();

			const diff = process.hrtime(startTime);
			dur = (diff[0] + diff[1] / 1e9) * 1000;
			
			let res = cb(rsp);
			if (Array.isArray(res))
				res.map(r => this.checkValid(r));
			else if (res != null)
				this.checkValid(res);

		} catch(err) {
			console.error(kleur.red().bold(err.name, err.message));
			console.error(err);
			this.fail++;
		}
		console.log(kleur.grey(`Time: ${dur.toFixed(2)} ms`));
	}

	printTitle(text) {
		console.log();
		console.log(kleur.yellow().bold(`--- ${text} ---`));
	}

	checkValid(cond) {
		let res = cond;
		if (_.isFunction(cond))
			res = cond();

		if (res) {
			this.ok++;
			console.log(kleur.bgGreen().yellow().bold("--- OK ---"));
		} else {
			this.fail++;
			console.log(kleur.bgRed().yellow().bold("!!! FAIL !!!"));
		}
	}

	printTotal() {
		const failed = this.fail > 0 || this.ok < this.okCount;
		console.log("");
		if (!failed)
			console.log(kleur.bgGreen().yellow().bold(`--- OK: ${this.ok} of ${this.okCount} ---`));
		else
			console.log(kleur.bgRed().yellow().bold(`--- OK: ${this.ok} of ${this.okCount} --- FAILED!`));

		console.log("");
	}
}


module.exports = ModuleChecker;
