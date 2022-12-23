import path from 'path'
import process from 'process'
import wordWrap from 'word-wrap'
import ArgumentError from './argument-error.js'
import './shims/string.js' // String.isString

/**
 * The configuration of the parser.
 * @typedef {object} getopt~Settings
 * @property {getopt~Callback}       [callback]      A function that will be called after parsing.
 * @property {getopt~ErrorCallback}  [error]         A function that will be called when an error occurs.
 * @property {boolean}               [first]         A value indicating whether to only show the first short and long option.
 * @property {array.<getopt~Option>} [options]       The specification of the optional parameters.
 * @property {object|string}         [usage]         The configuration of the usage.
 * @property {string}                [usage.footer]  The content that will be displayed after the usage specification.
 * @property {string}                [usage.header]  The content that will be displayed before the usage specification.
 * @property {string}                [usage.program] The executable name of the calling program.
 * @property {string}                [usage.spec]    A line that contains the usage specification.
 * @property {string}                [version]       The version of the calling program.
 * @property {boolean|number}        [wrap]          @c true to enable word wrap, or the width at which to wrap.
 */

/**
 * @constant {getopt~Settings}
 * @default
 */
const _defaultSettings = {
	first: true,
	options: [],
	usage: '[option]... [parameter]...',
	wrap: true
}

/**
 * The default width at which to wrap the usage.
 * @constant {number}
 * @default
 */
const _defaultWrapWidth = 80

/**
 * The specification of an optional parameter.
 * @typedef {object} getopt~Option
 * @property {array.<string>|string} [name]           The name(s) by which the option will be indexed.
 * @property {array.<string>|string} [short]          The short form(s) by which the option can be specified on the command line.
 * @property {array.<string>|string} [long]           The long form(s) by which the option can be specified on the command line.
 * @property {string}                [description]    A description that will be displayed in the usage documentation.
 * @property {boolean|String}        [argument]       A value indicating whether the option expects an argument.
 * @property {boolean}               [optional=false] A value indicating whether the argument is optional.
 * @property {getopt~Callback}       [callback]       A function that will be called when this option is parsed.
 */

/**
 * @constant {getopt~Option}
 * @default
 */
const _defaultOption = {
	description: '',
	optional: false
}

/**
 * A function that will be called when a command-line argument is parsed.
 * @callback getopt~Callback
 * @param {getopt~Result}   result   The parsed result.
 * @param {array.<string>}  args     The command-line arguments.
 * @param {getopt~Settings} settings The configuration of the parser.
 */

/**
 * A parsed result.
 * @typedef {object} getopt~Result
 * @property {getopt~ParsedOption|getopt~ParsedParameter} parameter   The parameter that was generated.
 * @property {number}                                     index       The index of the command-line argument that was parsed to generate the parameter.
 * @property {number}                                     [subIndex]  The index of the portion of the command-line argument that was parsed to generate the parameter.
 * @property {number}                                     [subLength] The length of the portion of the command-line argument that was parsed to generate the parameter.
 */

/**
 * The sanitized results.
 * @typedef {object} getopt~Results
 * @property {array.<getopt~ParsedOption|getopt~ParsedParameter> sequence   The optional and positional parameters in order of appearance.
 * @property {object.<string, getopt~ParsedOption>}              options    The optional parameters indexed by their name.
 * @property {array.<getopt~ParsedParameter>}                    parameters The positional parameters indexed by their position.
 */

/**
 * An optional parameter that was parsed from the command-line arguments.
 * @typedef {object} getopt~ParsedOption
 * @property {getopt~Option}         option The specification of the parameter.
 * @property {array.<string>|string} value  The value(s) that were assigned to the parameter.
 */

/**
 * A positional parameter that was parsed from the command-line arguments.
 * @typedef {object} getopt~ParsedParameter
 * @property {number} position The position of the parameter.
 * @property {string} value    The content of the parameter.
 */

/**
 * A function that will be called when an error occurs.
 * @callback getopt~ErrorCallback
 * @param {Error} error The error.
 */

/**
 * Parses the options from the command-line arguments and sanitizes the results.
 * @param {array.<string>}  args       The command-line arguments.
 * @param {getopt~Settings} [settings] The configuration of the parser.
 * @returns {getopt~Results} The sanitized results.
 * @throws {ArgumentError} Thrown if any of the options are invalid.
 */
export default function getopt(args, settings) {
	requireValid(args, settings)
	settings = _normalize(settings)

	// Parse the arguments.
	let parameters
	try {
		parameters = Array.from(_parse1(args, settings),
			function(result) {
				// Execute the callback that is defined for the option.
				if (result.parameter.option?.callback != null)
					result.parameter.option.callback(result, args, settings)
				return result.parameter
			})
	}
	catch (e) {
		if (settings.error)
			settings.error(e)
		throw e
	}

	// Build the results.
	let results = {
		sequence: parameters,
		options: {},
		parameters: []
	}

	// Index the parameters.
	// Index the optional parameters by their keys.
	// Index the positional parameters by their position.
	// If there are multiple instances of the same option, then merge their values.
	for (let parameter of parameters)
		if ('option' in parameter) {
			let keys = parameter.option.name.concat(parameter.option.short, parameter.option.long)
			for (let key of keys) {
				let option = results.options[key]
				if (option === undefined)
					results.options[key] = option = parameter
				else {
					if (!Array.isArray(option.value))
						option.value = [option.value]
					option.value.push(parameter.value)
				}
			}
		}
		else
			results.parameters.push(parameter)

	// Execute the callback.
	if (settings.callback)
		settings.callback(results, args, settings)

	return results
}

/**
 * Parses the options from the command-line arguments.
 * @generator
 * @param {array.<string>}  args       The command-line arguments.
 * @param {getopt~Settings} [settings] The configuration of the parser.
 * @yields {getopt~Result} The parsed results.
 * @throws {ArgumentError} Thrown if any of the options are invalid.
 */
export function* parse(args, settings) {
	requireValid(args, settings)
	settings = _normalize(settings)

	yield* _parse0(args, settings)
}

/**
 * Parses the options from the command-line arguments.
 * @generator
 * @param {array.<string>}  args       The command-line arguments.
 * @param {getopt~Settings} [settings] The configuration of the parser.
 * @yields {getopt~Result} The parsed results.
 * @throws {ArgumentError} Thrown if any of the options are invalid.
 */
function* _parse0(args, settings) {
	for (let result of _parse1(args, settings)) {
		// Execute the callback that is defined for the option.
		if (result.parameter.option?.callback != null)
			result.parameter.option.callback(result, args, settings)

		yield result
	}
}

/**
 * Parses the options from the command-line arguments.
 * @generator
 * @param {array.<string>}  args       The command-line arguments.
 * @param {getopt~Settings} [settings] The configuration of the parser.
 * @yields {getopt~Result} The parsed results.
 * @throws {ArgumentError} Thrown if any of the options are invalid.
 */
function* _parse1(args, settings) {
	// Index the options by their short forms.
	let shortOptions = new Map(settings.options
		.flatMap(function(option) {
			return option.short.map(function(x) { return [x, option] })
		}))

	// Index the options by their long forms.
	let longOptions = new Map(settings.options
		.flatMap(function(option) {
			return option.long.map(function(x) { return [x, option] })
		}))

	let argIndex = 0
	let endOptions = false
	let position = 0
	let resultAwaitingArgument = null

	for (let arg of args) {
		if (!endOptions) {
			// Finish processing a parsed option that is waiting for an argument.
			if (resultAwaitingArgument) {
				if (!resultAwaitingArgument.parameter.option.optional || arg[0] !== '-')
					resultAwaitingArgument.parameter.value = arg
				yield resultAwaitingArgument
				resultAwaitingArgument = null
				continue
			}

			if (arg[0] === '-' && arg.length > 1) {
				if (arg[1] === '-') {
					// Handle the case where we have reached the end of the options.
					if (arg.length === 2) {
						endOptions = true
						continue
					}

					// Extract the long option and the value from the argument.
					let i = arg.indexOf('=', 2)
					if (i < 0)
						i = arg.length
					let longOption = arg.substring(2, i)
					let value = i < arg.length ? arg.substring(i + 1) : undefined

					// Look up the specification of the long option.
					let option = longOptions.get(longOption)
					if (option === undefined)
						throw new Error('Unrecognized option \'--' + longOption + '\'.')

					// Validate the value of the long option.
					if (value) {
						if (!option.argument) {
							throw new Error('Option \'--' + longOption + '\' doesn\'t take an argument.')
						}
					}
					else if (option.argument && !option.optional)
						throw new Error('Option \'--' + longOption + '\' requires an argument.')

					// Generate the optional parameter.
					yield {
						parameter: {
							option: option,
							value: value
						},
						index: argIndex
					}
				}
				else {
					// Handle a sequence of one or more short options.
					outer:
					for (let i = 1; i < arg.length;) {
						let shortOption
						for (let j = arg.length; j > i; --j) {
							shortOption = arg.substring(i, j)
							let option = shortOptions.get(shortOption)
							if (option === undefined)
								continue

							// Generate the optional parameter.
							let result = {
								parameter: {
									option: option,
									value: undefined
								},
								index: argIndex,
								subIndex: i - 1,
								subLength: j - i,
							}

							// Handle the cases where the option may expect an argument.
							if (!option.argument)
								yield result
							else if (j < arg.length) {
								result.parameter.value = arg.substring(j)
								yield result
								j = arg.length
							}
							else
								resultAwaitingArgument = result

							i = j
							continue outer
						}

						throw new Error('Unrecognized option \'-' + shortOption + '\'.')
					}
				}

				continue
			}
		}

		// Generate the positional parameter.
		yield {
			parameter: {
				position: position++,
				value: arg
			},
			index: argIndex
		}

		++argIndex
	}
}

/**
 * Validates the configuration of the parser.
 * @param {array.<string>}  args       The command-line arguments.
 * @param {getopt~Settings} [settings] The configuration of the parser.
 * @throws {ArgumentError} Thrown if any of the options are invalid.
 */
function requireValid(args, settings) {
	for (let err of _validate(args, settings))
		throw new ArgumentError(err)
}

/**
 * Validates the configuration of the parser.
 * @param {array.<string>}  args       The command-line arguments.
 * @param {getopt~Settings} [settings] The configuration of the parser.
 * @yields {string} The validation errors.
 */
function* _validate(args, settings) {
	// Validate 'args'.
	if (args == null)
		yield 'args is required'
	if (typeof args[Symbol.iterator] !== 'function')
		yield 'args must be iterable'

	// Validate 'settings'.
	if (settings == null)
		return

	// Validate 'settings.options'.
	if (settings.options != null) {
		if (!Array.isArray(settings.options))
			yield 'settings.options must be an array'

		for (let [i, option] of settings.options.entries()) {
			// Validate 'settings.options[i].name'.
			if (option.name != null) {
				if (String.isString(option.name)) {
					if (option.name.length === 0)
						yield 'settings.options[' + i + '].name must not be an empty string'
				}
				else if (Array.isArray(option.name)) {
					for (let [j, name] of option.name.entries()) {
						// Validate 'settings.options[i].name[j]'.
						if (!String.isString(name))
							yield 'settings.options[' + i + '].name[' + j + '] must be a string'
						if (name.length === 0)
							yield 'settings.options[' + i + '].name[' + j + '] must not be an empty string'
					}
				}
				else
					yield 'settings.options[' + i + '].name must be a string or an array of strings'
			}

			// Validate 'settings.options[i].short'.
			if (option.short != null) {
				if (String.isString(option.short)) {
					if (option.short.length === 0)
						yield 'settings.options[' + i + '].short must not be an empty string'
				}
				else if (Array.isArray(option.short)) {
					for (let [j, short] of option.short.entries()) {
						// Validate 'settings.options[i].short[j]'.
						if (!String.isString(short))
							yield 'settings.options[' + i + '].short[' + j + '] must be a string'
						if (short.length === 0)
							yield 'settings.options[' + i + '].short[' + j + '] must not be an empty string'
					}
				}
				else
					yield 'settings.options[' + i + '].short must be a string or an array of strings'
			}

			// Validate 'settings.options[i].long'.
			if (option.long != null) {
				if (String.isString(option.long)) {
					if (option.long.length === 0)
						yield 'settings.options[' + i + '].long must not be an empty string'
				}
				else if (Array.isArray(option.long)) {
					for (let [j, long] of option.long.entries()) {
						// Validate 'settings.options[i].long[j]'.
						if (!String.isString(long))
							yield 'settings.options[' + i + '].long[' + j + '] must be a string'
						if (long.length === 0)
							yield 'settings.options[' + i + '].long[' + j + '] must not be an empty string'
					}
				}
				else
					yield 'settings.options[' + i + '].long must be a string or an array of strings'
			}

			// Validate that 'settings.options[i]' has a short or long name.
			if ((option.short == null || option.short.length === 0) && (option.long == null || option.long.length === 0))
				yield 'settings.options[' + i + '] must have a short or long name'

			// Validate 'option.options[i].description'.
			if (option.description != null)
				if (!String.isString(option.description))
					yield 'settings.options[' + i + '].description must be a string'

			// Validate 'settings.options[i].callback'.
			if (option.callback != null)
				if (typeof option.callback !== 'function')
					yield 'settings.options[' + i + '].callback must be a function'
		}
	}
}

/**
 * Normalizes the configuration of the parser by applying the defaults.
 * @param {getopt~Settings} [settings] The configuration of the parser.
 * @returns {getopt~Settings} The normalized configuration.
 */
function _normalize(settings) {
	settings = Object.assign({}, _defaultSettings, settings)

	settings.options = settings.options
		.map(function(option) {
			option = Object.assign({}, _defaultOption, option)
			if (!Array.isArray(option.name))
				option.name = option.name != null ? [option.name] : []
			if (!Array.isArray(option.short))
				option.short = option.short != null ? [option.short] : []
			if (!Array.isArray(option.long))
				option.long = option.long != null ? [option.long] : []
			return option
		})

	// Replace a usage string with a usage object.
	if (String.isString(settings.usage)) {
		settings.usage = {
			spec: settings.usage
		}
	}

	// Replace a boolean wrap with a wrap width.
	settings.wrap = settings.wrap !== true
		? +settings.wrap
		: process.stdout.columns
		?? _defaultWrapWidth

	return settings
}

/**
 * Displays the usage information and exits.
 * @param {getopt~Settings} [settings] The configuration of the parser.
 */
export function usage(settings) {
	// Allow this function to be used as the callback of an option.
	let args = []
	if (arguments.length === 3) {
		args = arguments[1]
		settings = arguments[2]
	}

	// Normalize the settings in case this function was called by the application.
	requireValid(args, settings)
	settings = _normalize(settings)

	// Write the usage header.
	if (settings.usage?.header) {
		// Wrap the text on word boundaries.
		let header = settings.usage.header
		if (settings.wrap) {
			header = header.match(/^\s*/)
				+ wordWrap(header, {
					indent: '',
					width: settings.wrap - 1
				})
				+ header.match(/\s*$/)
		}

		process.stdout.write(header)
	}

	// Write the usage specification.
	const program = settings.usage?.program
		?? path.basename(process.argv[1]).split('.', 1)[0]
	process.stdout.write('Usage: ' + program)
	if (settings.usage?.spec)
		process.stdout.write(' ' + settings.usage.spec)
	process.stdout.write('\n')

	// Write the options.
	if (settings.options && settings.options.length > 0) {
		process.stdout.write('Options:\n')

		// Build the specification and description of each option.
		let options = settings.options
			.map(function(option) {
				let spec = []
					.concat(
						option.short
							.slice(0, settings.first ? 1 : Number.MAX_SAFE_INTEGER)
							.map(function(x) { return '-' + x }),
						option.long
							.slice(0, settings.first ? 1 : Number.MAX_SAFE_INTEGER)
							.map(function(x) { return '--' + x }))
					.join(' ')

				if (option.argument)
					spec += (option.long.length > 0 ? '=' : ' ')
						+ (option.optional ? '[' : '<')
						+ option.argument
						+ (option.optional ? ']' : '>')

				return {
					spec: spec,
					description: option.description
				}
			})

		// Calculate the maximum length of the options.
		let specLength = Math.max(...options.map(function(x) { return x.spec.length }))
		let descriptionLength = Math.max(...options.map(function(x) { return x.description.length }))

		// Write the options.
		for (let option of options) {
			// Wrap the description on word boundaries.
			let description = option.description
			if (settings.wrap && specLength + descriptionLength + 3 > settings.wrap) {
				description = ' '.repeat(specLength + 3) + description
				description = wordWrap(description, {
					indent: ' '.repeat(specLength + 3),
					width: settings.wrap - 1
				})
				description = description.substring((specLength + 3) * 2)
			}

			process.stdout.write('  ' + option.spec.padEnd(specLength) + ' ' + description + '\n')
		}
	}

	// Write the usage footer.
	if (settings.usage?.footer) {
		// Wrap the text on word boundaries.
		let footer = settings.usage.footer
		if (settings.wrap) {
			footer = footer.match(/^\s*/)
				+ wordWrap(footer, {
					indent: '',
					width: settings.wrap - 1
				})
				+ footer.match(/\s*$/)
		}

		process.stdout.write(footer)
	}

	process.exit()
}

getopt.usage = usage
