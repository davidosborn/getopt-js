'use strict'

import getopt, {usage} from '../src/getopt'
import process from 'process'

test('multi-character short-option sequence', function() {
	let args = [
		'-MMGMPMFfile'
	]
	let settings = {
		options: [
			{short: 'M'},
			{short: 'MF', argument: true},
			{short: 'MG'},
			{short: 'MP'}
		]
	}
	let result = getopt(args, settings)
	expect(Object.keys(result.options)).toEqual(
		expect.arrayContaining(...settings.options
			.map(function(option) {
				return option.short
			})
		)
	)
	expect(result.parameters).toHaveLength(0)
})

test('usage callback', function() {
	let args = ['-h']
	let settings = {
		options: [
			{short: 'h', callback: usage}
		]
	}

	var processExit = process.exit
	var processExitCalled = false
	process.exit = function() {
		processExitCalled = true
	}

	getopt(args, settings)

	expect(processExitCalled).toBeTruthy()
	process.exit = processExit
})
