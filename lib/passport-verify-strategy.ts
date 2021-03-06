/**
 * A passport.js strategy for GOV.UK Verify
 */
/** */
import { Strategy } from 'passport-strategy'
import * as express from 'express'
import { createSamlForm } from './saml-form'
import { default as VerifyServiceProviderClient, Logger } from './verify-service-provider-client'

export interface AuthnRequestResponse {
  samlRequest: string,
  secureToken: string,
  location: string
}

export interface Address {
  verified?: boolean,
  lines?: string[],
  postCode?: string,
  internationalPostCode?: string,
  uprn?: string
}

export interface Attributes {
  firstName?: string,
  firstNameVerified?: boolean,
  middleName?: string,
  middleNameVerified?: boolean,
  surname?: string,
  surnameVerified?: boolean,
  dateOfBirth?: string,
  dateOfBirthVerified?: boolean,
  address?: Address,
  cycle3?: string
}

export interface TranslatedResponseBody {
  pid: string,
  levelOfAssurance: string,
  attributes?: Attributes
}

export interface ErrorBody {
  reason: string,
  message: string
}

/**
 * Configuration options and callbacks for the `PassportVerifyStrategy`.
 */
export interface PassportVerifyOptions {
}

/**
 * The error message thrown if the `createUser` or `verifyUser` callbacks fail to return a user object.
 */
export const USER_NOT_ACCEPTED_ERROR = 'USER_NOT_ACCEPTED_ERROR'

/**
 * A passport.js strategy for GOV.UK Verify
 *
 * ```
 * passport.use(passportVerifyStrategy)
 * ```
 *
 * Users of `passport-verify` should use [[createStrategy]] to create
 * instances of `PassportVerifyStrategy` rather than calling the constructor directly.
 */
export class PassportVerifyStrategy extends Strategy {

  public name: string = 'verify'

  constructor (private client: VerifyServiceProviderClient,
               private createUser: (user: TranslatedResponseBody) => any,
               private verifyUser: (user: TranslatedResponseBody) => any) {
    super()
  }

  async authenticate (req: express.Request, options?: any) {
    try {
      await this._handleRequest(req)
    } catch (error) {
      this.error(error)
    }
  }

  success (user: any, info: TranslatedResponseBody) { throw new Error('`success` should be overridden by passport') }
  fail (challenge: any, status?: number) { throw new Error('`fail` should be overridden by passport') }
  error (reason: Error) { throw reason }

  private _handleRequest (req: express.Request) {
    if (req.body && req.body.SAMLResponse) {
      return this._translateResponse(req.body.SAMLResponse)
    } else {
      return this._renderAuthnRequest((req as any).res)
    }
  }

  private async _translateResponse (samlResponse: string) {
    const response = await this.client.translateResponse(samlResponse, 'TODO secure-cookie')
    if (response.status === 200) {
      const user = await this._acceptUser(response.body as TranslatedResponseBody)
      if (user) {
        this.success(user, response.body as TranslatedResponseBody)
      } else {
        this.fail(USER_NOT_ACCEPTED_ERROR)
      }
    } else if (response.status === 401) {
      const errorBody = response.body as ErrorBody
      this.fail(errorBody.reason, response.status)
    } else if ([400, 500].includes(response.status)) {
      const errorBody = response.body as ErrorBody
      throw new Error(errorBody.reason)
    } else {
      throw new Error(response.body as any)
    }
  }

  private async _acceptUser (user: TranslatedResponseBody) {
    if (user.attributes) {
      return this.createUser(user)
    } else {
      return this.verifyUser(user)
    }
  }

  private async _renderAuthnRequest (response: express.Response): Promise<express.Response> {
    const authnRequestResponse = await this.client.generateAuthnRequest()
    if (authnRequestResponse.status === 200) {
      const authnRequestResponseBody = authnRequestResponse.body as AuthnRequestResponse
      return response.send(createSamlForm(authnRequestResponseBody.location, authnRequestResponseBody.samlRequest))
    } else {
      const errorBody = authnRequestResponse.body as ErrorBody
      throw new Error(errorBody.reason)
    }
  }
}

/**
 * Creates an instance of [[PassportVerifyStrategy]]
 *
 * @param verifyServiceProviderHost The URL that the Verify Service Provider is running on (e.g. http://localhost:50400)
 * @param logger A logger for the strategy. If you don't want the strategy
 * to log you can pass an object with no-operation methods.
 * @param createUser A callback that will be invoked when a response with a new user is received.
 * The `user` object will contain the users' attributes (i.e. firstName, surname etc.).
 * Your callback should store details of the user in your datastore and return an object representing the user.
 * @param verifyUser A callback that will be invoked when a response with a matched user is received.
 * Your callback should look the user up in your datastore using their `pid` (persistent identitfier)
 * and return an object representing the user.
 * @returns A strategy to be registered in passport with
 * ```
 * passport.use(passportVerifyStrategy)
 * ```
 */
export function createStrategy (
  verifyServiceProviderHost: string,
  logger: Logger,
  createUser: (user: TranslatedResponseBody) => object | false,
  verifyUser: (user: TranslatedResponseBody) => object | false
) {
  const client = new VerifyServiceProviderClient(verifyServiceProviderHost, logger || { info: () => undefined })
  return new PassportVerifyStrategy(client, createUser, verifyUser)
}
