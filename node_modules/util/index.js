const { TextEncoder, TextDecoder } = require('bare-encoding')

exports.format = require('bare-format')

exports.formatWithOptions = exports.format.formatWithOptions

exports.inspect = require('bare-inspect')

exports.debuglog = require('bare-debug-log')

exports.inherits = function inherits(ctor, superCtor) {
  if (superCtor) Object.setPrototypeOf(ctor.prototype, superCtor.prototype)
}

exports.deprecate = function deprecate(fn, msg, code) {
  let warned = false

  return function (...args) {
    if (!warned) {
      warned = true

      if (code) {
        console.warn(`[${code}]`, 'DeprecationWarning:', msg)
      } else {
        console.warn('DeprecationWarning:', msg)
      }
    }

    if (new.target) return Reflect.construct(fn, args, new.target)

    return Reflect.apply(fn, this, args)
  }
}

exports.TextEncoder = TextEncoder

exports.TextDecoder = TextDecoder
