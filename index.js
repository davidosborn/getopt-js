import process from 'process'
import esMain from 'es-main'
import getopt from './src/getopt.js'
import readConfig from './src/read-config.js'

export default getopt

if (esMain(import.meta)) {
	const args = process.argv.slice(2)

	if (args.length === 0) {
		getopt.usage({
			usage: '<config-file> [option]... [parameter]...'
		})
	}

	const config = args.shift()
	const settings = readConfig(config)

	const result = getopt(args, settings)
	process.stdout.write(JSON.stringify(result))
}
