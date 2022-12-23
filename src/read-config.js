/**
 * Reads the settings from a configuration file.
 * @param {string} path - The path to the configuration file.
 * @return {getopt~Settings} The settings.
 */
export default function readConfig(path) {
	try {
		const json = fs.readFileSync(path)
		return JSON.parse(json)
	}
	catch (e) {
		throw new Error('Failed to read the configuration file "' + path + '".')
	}
}
