'use strict'

/**
 * An error that may occur when validating the arguments of a function.
 */
export default class ArgumentError extends Error {
	/**
	 * Initializes a new instance.
	 * @param {string} message A description of the error.
	 */
	constructor(message) {
		super(message)
		this.name = this.constructor.name
	}
}
