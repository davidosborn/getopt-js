'use strict'

import fs from 'fs'
import process from 'process'
import * as getopt from './getopt'

export default function main(args) {
	if (args.length === 0)
		getopt.usage({
			usage: '<settings-file> [options]... [parameters]...'
		})

	let settingsFile = args.shift()
	let settings
	try {
		settings = JSON.parse(fs.readFileSync(settingsFile))
	}
	catch (e) {
		throw new Error('Failed to parse \'' + settingsFile + '\'')
	}

	let result = getopt.default(args, settings)
	process.stdout.write(JSON.stringify(result))
}
