/*
Copyright 2022 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const HttpResponse = require("../http-response");
const HttpOptions = require("../http-options");
const HttpBackendInterceptor = require("../http-backend-interceptor");
const typedefs = require("../typedefs");

const PRIVATE = Symbol("PRIVATE");

/**
 * Reprents an underlying Node.JS HTTP library (i.e. "backend") that the client can
 * be configured to use when actually communicating with HTTP. Implementing this class
 * will provide all the functionality that the client needs in order to apply its
 * features over a backend.
 */
class HttpBackend {
  /**
   * Constructs a new backend that will use the given dependencies.
   *
   * @param {typedefs.ClientOptions} options Options for controlling how the backend behaves.
   */
  constructor(options = {}) {
    this[PRIVATE] = {
      options,
    };
  }

  /**
   * Retrieves the client-level options, as provided in the backend's constructor.
   *
   * @returns {typedefs.ClientOptions} Client options.
   */
  getClientOptions() {
    const { options } = this[PRIVATE];
    return options;
  }

  /**
   * Retrieves a value indicating whether or not the backend should handle set-cookie
   * headers.
   *
   * @returns {boolean} True to handle cookies, false otherwise;
   */
  shouldHandleCookies() {
    const { options } = this[PRIVATE];
    const { handleCookies = false } = options;
    return handleCookies;
  }

  // eslint-disable-next-line jsdoc/require-returns-check
  /**
   * Does the work of ensuring that request/response interceptors are registered with
   * the backend.
   *
   * Each of the given interceptor's methods will be registered with the backend so
   * that they're called at the correct time.
   *
   * @param {HttpBackendInterceptor} interceptor Object with which the underlying HTTP
   *  library's interceptors should be registered.
   * @returns {*} The object that should be used as the backend's export.
   */
  registerInterceptors(interceptor) {
    throw new Error("Backend registerInterceptors method must be implemented");
  }

  /**
   * Given the set of options provided to the client, performs any backend-specific
   * manipulation of the options before they are given to the backend.
   *
   * @param {HttpOptions} options Options as provided to the client.
   * @returns {Promise<*>} The options that should be given to the backend.
   */
  getRequestConfig(options) {
    return options.toRequestConfig();
  }

  /**
   * Uses the underlying HTTP library to submit an HTTP request and generate a
   * response.
   *
   * @param {*} options Configuration as provided by the backend's getRequestConfig()
   *  method.
   * @returns {Promise<*>} Will resolve when the request's HTTP response is available.
   *  Will resolve with the response.
   */
  async submitRequest(options) {
    throw new Error("Backend submitRequest method must be implemented");
  }

  // eslint-disable-next-line jsdoc/require-returns-check
  /**
   * Does the work of examining a backend-specific error and providing the response
   * that generated the error.
   *
   * Will return a falsy error if there is no response associated with the error.
   *
   * @param {HttpOptions} httpOptions Options that generated the error.
   * @param {*} error The error that was encountered while submitting the request.
   * @returns {*} The raw response containing information about the error, or
   *  falsy if none.
   */
  getErrorResponse(httpOptions, error) {
    return false;
  }

  /**
   * Creates an instance of the client's HTTP response that is most appropriate
   * for the backend.
   *
   * @param {*} rawResponse Response as provided by the underlying backend.
   * @param {*} [error] The error that was generated when the backend submitted
   *  the request, if applicable.
   * @returns {HttpResponse} Client response for the request.
   */
  createHttpResponse(rawResponse, error) {
    return new HttpResponse(rawResponse, error);
  }

  /**
   * Creates an instance of the client's HTTP options that is most appropriate
   * for the backend.
   *
   * @param {*} options Raw options as received by the client.
   * @returns {HttpOptions} Client options for the request.
   */
  createHttpOptions(options) {
    return new HttpOptions(options, this.getClientOptions());
  }

  // eslint-disable-next-line jsdoc/require-returns-check
  /**
   * Retrieves the cookies that should be set according to an HTTP response from
   * the backend.
   *
   * @param {*} response An HTTP response as provided by a request sent using
   *  the backend.
   * @returns {Array<string>} List of unparsed HTTP cookie definitions.
   */
  getSetCookies(response) {
    throw new Error("Backend getSetCookies method must be implemented");
  }
}

module.exports = HttpBackend;
