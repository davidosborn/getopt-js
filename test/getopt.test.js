'use strict'

import getopt from '../src/getopt'

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
