/**
 * Determines whether an object is a string.
 * @param {object} The object.
 * @return {boolean} @c true if the object is a string; otherwise, @c false.
 */
String.isString = function(o) {
	return typeof o === 'string'
		|| o instanceof String
}
