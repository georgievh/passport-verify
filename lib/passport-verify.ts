/**
 * Entry point for the passport-verify npm module.
 *
 * Exports [[createStrategy]] and [[createResponseHandler]] which can be used as follows:
 *
 * ```
 * const passportVerify = require('passport-verify')
 * passport.use(passportVerify.createStrategy(
 *   verifyServiceProviderHost,
 *   logger,
 *   function createUser (user) { },
 *   function verifyUser (user) { }
 * ))
 * ```
 *
 * ```
 * // route for authenticating a user
 * app.post('/verify/start', passport.authenticate('verify'))
 *
 * // route for handling a callback from verify
 * app.post('/verify/response', (req, res, next) => (
 *   passport.authenticate('verify',
 *     passportVerify.createResponseHandler({
 *       onMatch: user => {},
 *       onCreateUser: user => {},
 *       onAuthnFailed: failure => {},
 *       onError: error => {},
 *     })
 *   )
 * )(req, res, next))
 * ```
 */
/** */

import { createStrategy } from './passport-verify-strategy'
import { createResponseHandler } from './create-response-handler'

export { createStrategy, createResponseHandler }
