if (typeof require.asset === 'function') {
  module.exports = require.asset.bind(require)
} else {
  const url = require('url')
  const resolve = require('bare-module-resolve')

  const conditions = ['asset', 'node', process.platform, process.arch]

  module.exports = function asset(specifier, parentURL) {
    if (typeof parentURL === 'string') parentURL = url.pathToFileURL(parentURL)

    for (const resolution of resolve(
      specifier,
      parentURL,
      { conditions },
      readPackage
    )) {
      switch (resolution.protocol) {
        case 'file:':
          try {
            return require.resolve(url.fileURLToPath(resolution))
          } catch {
            continue
          }
      }
    }

    throw new Error(
      `Cannot find asset '${specifier}' imported from '${parentURL.href}'`
    )

    function readPackage(packageURL) {
      try {
        return require(url.fileURLToPath(packageURL))
      } catch (err) {
        return null
      }
    }
  }
}
