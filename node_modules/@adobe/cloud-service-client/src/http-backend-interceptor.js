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

const HttpClient = require("./http-client");

const PRIVATE = Symbol("PRIVATE");
const _getClient = Symbol("_getClient");

/**
 * Provides functionality for intercepting requests from an HTTP library like axios
 * or fetch. Assumes that there are certain points in the request process that the
 * interceptor can plug into to provide additional functionality.
 *
 * The HTTP client uses the interceptor to provide its features, such as retry, timeout,
 * cookie handling, and more.
 */
class HttpBackendInterceptor {
  /**
   * Constructs a new interceptor that uses the given dependencies.
   *
   * @param {HttpClient} httpClient Client whose functionality is being used by the
   *  interceptor.
   */
  constructor(httpClient) {
    this[PRIVATE] = {
      client: httpClient,
    };
  }

  /**
   * Intercepts an HTTP request before it is submitted, providing an opportunity
   * for the client to modify the requests options.
   *
   * @param {*} backend Backend being used to process the request.
   * @param {*} config Request configuration as received by the client.
   * @returns {Promise<*>} Resolves with a modified set of request options.
   */
  interceptRequest(backend, config) {
    return this[_getClient]().beginBackendRequest(backend, config);
  }

  /**
   * Intercepts error that occur before a request can be submitted, providing an
   * opportunity to potentially handle the error and retry the request.
   *
   * @param {*} backend Backend being used to process the request.
   * @param {*} config Request configuration as received by the client.
   * @param {*} error The error that occurred processing the request.
   * @returns {Promise<*>} Resolves with a modified set of request options.
   */
  interceptRequestError(backend, config, error) {
    return this[_getClient]().endBackendRequestWithError(
      backend,
      config,
      error
    );
  }

  /**
   * Intercepts responses that come back from the HTTP library, providing an
   * opportunity to perform additional operations, such as retrying failed
   * requests.
   *
   * @param {*} backend Backend being used to process the request.
   * @param {*} config Request configuration as received by the client.
   * @param {*} response The response as provided by the underlying HTTP library.
   * @returns {Promise<*>} Resolves with the potentially modified value
   *  to be provided as the final result.
   */
  async interceptResponse(backend, config, response) {
    const client = this[_getClient]();
    await client.endBackendRequestWithResponse(backend, config, response);
    const retryOptions = await client.getRetryOptionsFromResponse(
      backend,
      config,
      response
    );

    if (retryOptions) {
      return backend.submitRequest(retryOptions);
    }

    return client.getClientResponse(backend, config, response);
  }

  /**
   * Intercepts errors that come back from the HTTP library, providing an
   * opportunity to perform additional operations, such as retrying
   * failed requests.
   *
   * @param {*} backend Backend being used to process the request.
   * @param {*} config Request configuration as received by the client.
   * @param {*} error The error that occurred processing the request.
   * @returns {Promise<*>} Resolves with the potentially modified value
   *  to be provided as the final result.
   */
  async interceptResponseError(backend, config, error) {
    const client = this[_getClient]();
    const response = backend.getErrorResponse(
      backend.createHttpOptions(config),
      error
    );

    if (response) {
      await client.endBackendRequestWithResponse(backend, config, response);
    } else {
      await client.endBackendRequestWithError(backend, config, error);
    }
    const retryOptions = await client.getRetryOptionsFromResponse(
      backend,
      config,
      response,
      error
    );

    if (retryOptions) {
      return backend.submitRequest(retryOptions);
    }

    if (response) {
      return client.getClientResponse(backend, config, response, error);
    }
    return client.getClientError(backend, config, error);
  }

  /**
   * Retrieves the HTTP client being used by the interceptor, as provided in the class
   * constructor.
   *
   * @returns {HttpClient} An HTTP client.
   */
  [_getClient]() {
    return this[PRIVATE].client;
  }
}

module.exports = HttpBackendInterceptor;
