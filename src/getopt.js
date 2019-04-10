'use strict'

import 'flat-map-polyfill'
import defaultsDeep from 'lodash.defaultsdeep'
import isString from 'lodash.isstring'
import path from 'path'
import process from 'process'
import ArgumentError from './argument-error'

/**
 * The configuration of the parser.
 * @typedef {Object} getopt~Settings
 * @property {Array.<getopt~Option>} [options]       The specification of the optional parameters.
 * @property {Object}                [usage]         The configuration of the usage.
 * @property {String}                [usage.program] The executable name of the calling program.
 * @property {String}                [usage.spec]    A line that contains the usage specification.
 * @property {String}                [version]       The version of the calling program.
 * @property {Function.<Error>}      [error=error]   A function that will be called when an error occurs.
 */

/**
 * @constant {getopt~Settings}
 * @default
 */
const _defaultSettings = {
	options: [],
	usage: {
		spec: '[option]... [parameter]...'
	},
	error: error
}

/**
 * The specification of an optional parameter.
 * @typedef {Object} getopt~Option
 * @property {String}                [name]           The name(s) by which the option will be indexed.
 * @property {Array.<String>|String} [short]          The short form(s) by which the option can be specified on the command line.
 * @property {Array.<String>|String} [long]           The long form(s) by which the option can be specified on the command line.
 * @property {String}                [description]    A description that will be displayed in the usage documentation.
 * @property {Boolean|String}        [argument]       A value indicating whether the option expects an argument.
 * @property {Boolean}               [optional=false] A value indicating whether the argument is optional.
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
 * @param {getopt~Result} result The parsed result.
 */

/**
 * A parsed result.
 * @typedef {Object} getopt~Result
 * @property {getopt~ParsedOption|getopt~ParsedParameter} parameter   The parameter that was generated.
 * @property {Number}                                     index       The index of the command-line argument that was parsed to generate the parameter.
 * @property {Number}                                     [subIndex]  The index of the portion of the command-line argument that was parsed to generate the parameter.
 * @property {Number}                                     [subLength] The length of the portion of the command-line argument that was parsed to generate the parameter.
 */

/**
 * The sanitized results.
 * @typedef {Object} getopt~Results
 * @property {Array.<getopt~ParsedOption|getopt~ParsedParameter> sequence   The optional and positional parameters in order of appearance.
 * @property {Object.<String, getopt~ParsedOption>}              options    The optional parameters indexed by their name.
 * @property {Array.<getopt~ParsedParameter>}                    parameters The positional parameters indexed by their position.
 */

/**
 * An optional parameter that was parsed from the command-line arguments.
 * @typedef {Object} getopt~ParsedOption
 * @property {getopt~Option}         option The specification of the parameter.
 * @property {Array.<String>|String} value  The value(s) that were assigned to the parameter.
 */

/**
 * A positional parameter that was parsed from the command-line arguments.
 * @typedef {Object} getopt~ParsedParameter
 * @property {Number} position The position of the parameter.
 * @property {String} value    The content of the parameter.
 */

/**
 * Parses the options from the command-line arguments and sanitizes the results.
 * @param {Array.<String>}  args       The command-line arguments.
 * @param {getopt~Settings} [settings] The configuration of the parser.
 * @returns {getopt~Results} The sanitized results.
 * @throws {ArgumentError} Thrown if any of the options are invalid.
 */
export default function getopt(args, settings) {
	_validate(args, settings)
	settings = _normalize(settings)

	// Parse the arguments.
	let parameters
	try {
		parameters = Array.from(_parse1(args, settings),
			function(result) {
				if (settings.callback != null)
					settings.callback(result)
				return result.parameter
			})
	}
	catch (e) {
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

	return results
}

/**
 * Parses the options from the command-line arguments.
 * @generator
 * @param {Array.<String>}  args       The command-line arguments.
 * @param {getopt~Settings} [settings] The configuration of the parser.
 * @yields {getopt~Result} The parsed results.
 * @throws {ArgumentError} Thrown if any of the options are invalid.
 */
export function* parse(args, settings) {
	_validate(args, settings)
	settings = _normalize(settings)

	for (let result of _parse0(args, settings))
		yield result
}

/**
 * Parses the options from the command-line arguments.
 * @generator
 * @param {Array.<String>}  args       The command-line arguments.
 * @param {getopt~Settings} [settings] The configuration of the parser.
 * @yields {getopt~Result} The parsed results.
 * @throws {ArgumentError} Thrown if any of the options are invalid.
 */
function* _parse0(args, settings) {
	for (let result of _parse1(args, settings)) {
		// Execute the callback that is defined for the option.
		if (result.parameter.option?.callback != null)
			result.parameter.option.callback(result)

		yield result
	}
}

/**
 * Parses the options from the command-line arguments.
 * @generator
 * @param {Array.<String>}  args       The command-line arguments.
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
			if (resultAwaitingArgument != null) {
				if (resultAwaitingArgument.option.argument === true || resultAwaitingArgument.option.argument === 'required' || arg[0] !== '-')
					resultAwaitingArgument.value = arg
				yield resultAwaitingArgument
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
						throw new Error('unrecognized option \'-' + longOption + '\'')

					// Validate the value of the long option.
					switch (option.argument) {
						case false:
						case 'none':
							if (value.length > 0)
								throw new Error('option \'--' + longOption + '\' doesn\'t take an argument')
							break
						case true:
						case 'required':
							if (value.length === 0)
								throw new Error('option \'--' + longOption + '\' requires an argument')
							break
					}

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
							if (option.argument == null || option.argument === false || option.argument === 'none')
								yield result
							else if (j < arg.length && (option.argument === true || option.argument === 'required')) {
								result.parameter.value = arg.substring(j)
								yield result
								j = arg.length
							}
							else
								argResult = result

							i = j
							continue outer
						}

						throw new Error('unrecognized option \'-' + shortOption + '\'')
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
 * @param {Array.<String>}  args       The command-line arguments.
 * @param {getopt~Settings} [settings] The configuration of the parser.
 * @throws {ArgumentError} Thrown if any of the options are invalid.
 */
function _validate(args, settings) {
	// Validate 'args'.
	if (args == null)
		throw new ArgumentError('args is required')
	if (typeof args[Symbol.iterator] !== 'function')
		throw new ArgumentError('args must be iterable')

	// Validate 'settings'.
	if (settings == null)
		return

	// Validate 'settings.options'.
	if (settings.options != null) {
		if (!Array.isArray(settings.options))
			throw new ArgumentError('settings.options must be an array')

		for (let [i, option] of settings.options.entries()) {
			// Validate 'settings.options[i].name'.
			if (option.name != null) {
				if (isString(option.name)) {
					if (option.name.length === 0)
						throw new ArgumentError('settings.options[' + i + '].name must not be an empty string')
				}
				else if (Array.isArray(option.name)) {
					if (option.name.length === 0)
						throw new ArgumentError('settings.options[' + i + '].name must not be an empty array')
					for (let [j, name] of option.name.entries()) {
						// Validate 'settings.options[i].name[j]'.
						if (!isString(name))
							throw new ArgumentError('settings.options[' + i + '].name[' + j + '] must be a string')
						if (name.length === 0)
							throw new ArgumentError('settings.options[' + i + '].name[' + j + '] must not be an empty string')
					}
				}
				else
					throw new ArgumentError('settings.options[' + i + '].name must be a string or an array of strings')
			}

			// Validate 'settings.options[i].short'.
			if (option.short != null) {
				if (isString(option.short)) {
					if (option.short.length === 0)
						throw new ArgumentError('settings.options[' + i + '].short must not be an empty string')
				}
				else if (Array.isArray(option.short)) {
					if (option.short.length === 0)
						throw new ArgumentError('settings.options[' + i + '].short must not be an empty array')
					for (let [j, short] of option.short.entries()) {
						// Validate 'settings.options[i].short[j]'.
						if (!isString(short))
							throw new ArgumentError('settings.options[' + i + '].short[' + j + '] must be a string')
						if (short.length === 0)
							throw new ArgumentError('settings.options[' + i + '].short[' + j + '] must not be an empty string')
					}
				}
				else
					throw new ArgumentError('settings.options[' + i + '].short must be a string or an array of strings')
			}

			// Validate 'settings.options[i].long'.
			if (option.long != null) {
				if (isString(option.long)) {
					if (option.long.length === 0)
						throw new ArgumentError('settings.options[' + i + '].long must not be an empty string')
				}
				else if (Array.isArray(option.long)) {
					if (option.long.length === 0)
						throw new ArgumentError('settings.options[' + i + '].long must not be an empty array')
					for (let [j, long] of option.long.entries()) {
						// Validate 'settings.options[i].long[j]'.
						if (!isString(long))
							throw new ArgumentError('settings.options[' + i + '].long[' + j + '] must be a string')
						if (long.length === 0)
							throw new ArgumentError('settings.options[' + i + '].long[' + j + '] must not be an empty string')
					}
				}
				else
					throw new ArgumentError('settings.options[' + i + '].long must be a string or an array of strings')
			}

			// Validate that 'settings.options[i]' has a short or long name.
			if ((option.short == null || option.short.length === 0) && (option.long == null || option.long.length === 0))
				throw new ArgumentError('settings.options[' + i + '] must have a short or long name')

			// Validate 'option.options[i].description'.
			if (option.description != null)
				if (!isString(option.description))
					throw new ArgumentError('settings.options[' + i + '].description must be a string')

			// Validate 'settings.options[i].argument'.
			if (option.argument != null)
				switch (option.argument) {
					case false:
					case true:
					case 'none':
					case 'optional':
					case 'required':
						break
					default:
						throw new ArgumentError('settings.options[' + i + '].argument must be a boolean or a string of \'none\', \'optional\', or \'required\'')
				}

			// Validate 'settings.options[i].callback'.
			if (option.callback != null)
				if (typeof option.callback !== 'function')
					throw new ArgumentError('settings.options[' + i + '].callback must be a function')
		}
	}
}

/**
 * Normalizes the configuration of the parser by applying the defaults.
 * @param {getopt~Settings} [settings] The configuration of the parser.
 * @returns {getopt~Settings} The normalized configuration.
 */
function _normalize(settings) {
	settings = defaultsDeep(settings, _defaultSettings)
	settings.options = settings.options
		.map(function(option) {
			option = defaultsDeep(option, _defaultOption)
			if (!Array.isArray(option.name))
				option.name = option.name != null ? [option.name] : []
			if (!Array.isArray(option.short))
				option.short = option.short != null ? [option.short] : []
			if (!Array.isArray(option.long))
				option.long = option.long != null ? [option.long] : []
			return option
		})
	return settings
}

/**
 * The function that will be called by default to print the usage information.
 * @param {getopt~Settings} [settings] The configuration of the parser.
 */
export function usage(settings) {
	let program = settings.usage?.program ?? path.basename(process.argv[1]).split('.', 1)[0]
	process.stdout.write('Usage: ' + program + ' ' + settings.usage + '\n')

	if (settings.options != null && settings.options.length > 0) {
		process.stdout.write('Options:\n')

		let optionItems = settings.options
			.map(function(option) {
				let argumentItems =
					option.short.map(function(x) { return '-' + x }).concat(
					option.long.map(function(x) { return '--' + x }))

				let argument = option.argument
				if (argument != null)
					argument = (option.optional ? '[' : '<') + argument + (option.optional ? ']' : '>')

				let argumentString = argumentItems.join(' ')
				if (argument != null)
					argumentString += (option.long.length > 0 ? '=' : ' ') + argument

				return {
					arguments: argumentItems,
					argument: argument,
					argumentString: argumentString,
					description: option.description
				}
			})

		let argumentStringLength = Math.max(...optionItems.map(function(x) { return x.argumentString.length }))
		let descriptionLength = Math.max(...optionItems.map(function(x) { return x.description.length }))

		// Handle the case where the argument string and the description won't fit in the terminal.
		if (argumentStringLength + descriptionLength + 3 > process.stdout.columns) {
			// TODO
		}

		for (let option of optionItems) {
			process.stdout.write('  -')
		}
	}

	process.exit()
}

/**
 * The function that will be called by default when an error occurs.
 */
export function error(error) {
}
