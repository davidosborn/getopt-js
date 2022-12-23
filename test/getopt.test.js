import process from 'process'
import {expect, jest, test} from '@jest/globals'
import getopt from '../index.js'

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

	const result = getopt(args, settings)
	expect(Object.keys(result.options)).toEqual(
		expect.arrayContaining(settings.options
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
			{short: 'h', callback: getopt.usage}
		]
	}

	const mockExit = jest.spyOn(process, 'exit').mockImplementation()
	getopt(args, settings)
	expect(mockExit).toHaveBeenCalled()
	mockExit.mockRestore()
})
