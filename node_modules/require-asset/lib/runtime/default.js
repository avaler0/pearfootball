if (typeof require.asset === 'function') {
  module.exports = require.asset.bind(require)
} else {
  module.exports = function asset(specifier, parentURL) {
    throw new Error(
      `Cannot find asset '${specifier}' imported from '${parentURL}'`
    )
  }
}
