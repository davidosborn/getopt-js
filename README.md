# Getopt

A full-featured parser for command-line arguments.

## Library usage

You can import ``getopt`` as a module to parse the arguments of a JavaScript program.
Look at the following example for how to use this module.

```javascript
'use strict'

import process from 'process'
import getopt, {usage} from '@davidosborn/getopt'

main(process.argv.slice(2))

function main(args) {
	// Parse the arguments.
	let opts = getopt(args, {
		options: [
			{
				short: 'h',
				long: 'help',
				description: 'Display this usage information and exit.',
				callback: usage
			},
			{
				short: 'o',
				long: 'output',
				argument: 'file',
				description: 'Write to the specified file.'
			},
			{
				short: 'q',
				long: 'quiet',
				description: 'Do not write to the console.'
			},
			{
				short: 'v',
				long: 'verbose',
				description: 'Write extra information to the console.'
			}
		],
		usage: {
			footer: 'Header content',
			header: 'Footer content',
			program: 'example',
			spec: '[option]... <input-file>...'
		},
		callback: function(opts, args, settings) {
			// Show the usage when there is no input.
			if (opts.parameters.length < 1 || !opts.parameters[0].value)
				usage(settings)
		}
	})

	// Use the parsed arguments.
	let sources = opts.parameters.map(function(p) {return p.value})
	let destination = opts.options.output?.value

	if (opt.options.verbose)
		console.log('Verbose output!');
}
```

## Command-line usage

You can run ``getopt`` from the command line to parse the arguments of a shell script.
The first argument must be a path to a JSON file that contains the settings.
The remaining arguments will be parsed according to the settings.
