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

const { AbortController } = require("node-abort-controller");

const HttpBackend = require("./http-backend");
const FetchHttpOptions = require("./fetch-http-options");
const FetchHttpResponse = require("./fetch-http-response");
const { parseMultipleFetchSetCookieHeaders } = require("../http-utils");
const typedefs = require("../typedefs");

const PRIVATE = Symbol("PRIVATE");
const _fetch = Symbol("PRIVATE");

/**
 * Reprents a backend that uses fetch as the HTTP library for performing HTTP
 * communications.
 */
class FetchBackend extends HttpBackend {
  /**
   * Constructs a new instance of the fetch backend, based on a given instance of
   * the fetch library.
   *
   * @param {typedefs.ClientOptions} options Options for controlling how the backend behaves.
   * @param {*} fetchInstance Fetch library, as provided by the current framework.
   */
  constructor(options, fetchInstance) {
    super(options);
    this[PRIVATE] = {
      fetch: fetchInstance,
      interceptor: {
        interceptRequest: (backend, config) => config,
        interceptResponse: (backend, config, response) => response,
        interceptResponseError: (backend, config, error) => {
          throw error;
        },
      },
    };
  }

  registerInterceptors(interceptor) {
    this[PRIVATE].interceptor = interceptor;
    return this[_fetch].bind(this);
  }

  async submitRequest(options) {
    const fetchOptions = {
      ...options,
    };
    const { url } = fetchOptions;
    delete fetchOptions.url;

    return this[_fetch](url, fetchOptions);
  }

  getSetCookies(response) {
    if (response.headers && response.headers.has("set-cookie")) {
      return parseMultipleFetchSetCookieHeaders(
        response.headers.get("set-cookie")
      );
    }
    return [];
  }

  createHttpOptions(options) {
    return new FetchHttpOptions(options, this.getClientOptions());
  }

  createHttpResponse(response, error) {
    return new FetchHttpResponse(response, error);
  }

  /**
   * Submits an HTTP request using fetch.
   *
   * This approach is essentially "monkey patching" fetch, since it doesn't
   * have built-in intercepting. There is a library, fetch-intercept, but
   * at the time of writing it doesn't support node.js.
   *
   * @param {string} url URL to which the request will be submitted.
   * @param {*} config Configuration options as supported by fetch.
   * @returns {Promise<*>} Resolves with the HTTP response as provided by
   *  fetch.
   */
  async [_fetch](url, config) {
    const { fetch, interceptor } = this[PRIVATE];
    const newConfig = await interceptor.interceptRequest(this, {
      ...config,
      url,
    });

    const { url: newUrl } = newConfig;
    delete newConfig.url;

    // fetch doesn't have built-in timeouts, so in Node.JS that often means a request
    // will hang indefinitely. To ensure that doesn't happen, use an AbortController
    // to abort a request after the client's configured timeout.
    const httpOptions = this.createHttpOptions(newConfig);

    const controller = new AbortController();
    newConfig.signal = controller.signal;

    // abort the request after the specified timeout
    const timeoutId = setTimeout(
      () => controller.abort(),
      httpOptions.getTimeout()
    );

    let response;
    let error;
    try {
      response = await fetch(newUrl, newConfig);
    } catch (e) {
      error = e;
    } finally {
      // make sure the timeout for aborting the request is always cleared
      clearTimeout(timeoutId);
    }

    const mergedConfig = {
      ...newConfig,
      url,
    };
    if (response) {
      return interceptor.interceptResponse(this, mergedConfig, response);
    }
    return interceptor.interceptResponseError(this, mergedConfig, error);
  }
}

module.exports = FetchBackend;
