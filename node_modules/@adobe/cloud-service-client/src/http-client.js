/*
Copyright 2021 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const { promisify } = require("util");
const { Cookie, CookieJar } = require("tough-cookie");

const HttpOptions = require("./http-options");
const HttpResponse = require("./http-response");
const { retryWithStrategies } = require("./http-client-utils");
const HttpBackend = require("./http-backends/http-backend");
const typedefs = require("./typedefs");

const sleep = promisify(setTimeout);

// private methods
const _setClientCookies = Symbol("_setClientCookies");
const _getClientCookies = Symbol("_getClientCookies");

// private methods
const PRIVATE = Symbol("PRIVATE");

/**
 * Supports submitting and managing in-progress HTTP requests. Features of the
 * client include retrying failed requests, and timing request duration.
 */
class HttpClient {
  constructor() {
    this[PRIVATE] = { cookieJar: new CookieJar() };
  }

  /**
   * Sets the default global options that will be applied to all requests that go through
   * the client.
   *
   * @param {typedefs.ClientRequestOptions} options Global options to add to all requests.
   */
  setGlobalOptions(options) {
    this[PRIVATE].options = options;
  }

  /**
   * Retrieves the default global options that will be applied to all requests that go through
   * the client.
   *
   * @returns {typedefs.ClientRequestOptions} Global options to add to all requests.
   */
  getGlobalOptions() {
    const { options = {} } = this[PRIVATE];
    return options;
  }

  /**
   * Initiates a client request. Will provide a potentially modified set of HTTP options that
   * should be used when actually submitting the request.
   *
   * @param {HttpBackend} backend Backend handling the current request.
   * @param {typedefs.RequestOptions} options Raw options as received from the consumer of the client.
   * @returns {Promise<typedefs.RequestOptions>} Resolves with the options that should be given to the
   *  underlying backend.
   */
  async beginBackendRequest(backend, options) {
    const httpOptions = backend.createHttpOptions(options);
    httpOptions.logInfo(`> submitting request`);
    httpOptions.mergeClientOptions(this.getGlobalOptions());

    if (backend.shouldHandleCookies()) {
      httpOptions.logDebug("applying any cookies in the client's jar");
      const clientCookies = await this[_getClientCookies](httpOptions.getUrl());
      httpOptions.logDebug(
        `adding ${clientCookies.length} cookies from the client's jar`
      );
      httpOptions.setAdditionalCookies(clientCookies);
    }

    httpOptions.setStartTime(new Date().getTime());
    return backend.getRequestConfig(httpOptions);
  }

  /**
   * Instructs the client that an HTTP request has finished, and that it has
   * a corresponding response.
   *
   * @param {HttpBackend} backend Underlying backend processing the request.
   * @param {typedefs.RequestOptions} options Raw options that initiated the request.
   * @param {*} response Response as provided by the underlying backend.
   * @returns {Promise} Resolves when the client is finished processing
   *  the response.
   */
  async endBackendRequestWithResponse(backend, options, response) {
    const httpOptions = backend.createHttpOptions(options);
    httpOptions.setEndTime(new Date().getTime());
    const httpResponse = backend.createHttpResponse(response);
    httpOptions.logInfo(`< ${httpResponse.getStatus()} finished request`);

    // record client cookies from response
    return this[_setClientCookies](httpOptions, backend, httpResponse);
  }

  /**
   * Instructs the client that an HTTP request has finished, but it generated
   * an error.
   *
   * @param {HttpBackend} backend Underlying backend processing the request.
   * @param {typedefs.RequestOptions} options Raw options that initiated the request.
   * @param {*} error Error as provided by the underlying backend.
   * @returns {Promise} Resolves when the client is finished processing
   *  the error.
   */
  async endBackendRequestWithError(backend, options, error) {
    const httpOptions = backend.createHttpOptions(options);
    httpOptions.setEndTime(new Date().getTime());
    let errorDetails = error;
    const { name, message } = errorDetails;

    if (name || message) {
      errorDetails = `${name}: ${message}`;
    }

    httpOptions.logInfo(`< ERR finished request. ${errorDetails}`);
  }

  /**
   * Examines the response of an HTTP request and determines whether it qualifies for
   * a retry based on the retry strategies registered with the client.
   *
   * @param {HttpBackend} backend Underlying backend that's currently processing the
   *  request.
   * @param {typedefs.RequestOptions} rawOptions Options that were used to generate the response.
   * @param {*} [rawResponse] If provided, response as received from the underlying
   *  backend.
   * @param {*} [error] If provided, error that was provided by the underlying
   *  backend.
   * @returns {typedefs.RequestOptions} If falsy, indicates that no retry is required. If
   *  truthy, the raw options that should be used in the next attempt of the request.
   */
  async getRetryOptionsFromResponse(backend, rawOptions, rawResponse, error) {
    const httpOptions = backend.createHttpOptions(rawOptions);
    const httpResponse = backend.createHttpResponse(rawResponse || {}, error);

    const retryInfo = await retryWithStrategies(
      httpOptions,
      backend,
      httpResponse,
      httpOptions.getRetries() + 1
    );

    if (retryInfo) {
      const { delay, options: requestOptions } = retryInfo;
      httpOptions.addRetry(httpResponse, delay);
      httpResponse.setRequestTime(httpOptions.getRequestTime());
      httpOptions.logInfo(
        `request is being retried by a retry strategy. waiting ${delay} for attempt ${httpOptions.getRetries()}.`
      );

      httpOptions.setRequestOptions(requestOptions);
      await sleep(delay);
      return backend.getRequestConfig(httpOptions);
    }

    return false;
  }

  /**
   * Retrieves the final response that the client will provide to the consumer.
   *
   * @param {HttpBackend} backend Backend processing the current request.
   * @param {typedefs.RequestOptions} config Configuration that generated the client's response.
   * @param {*} [rawResponse] If applicable, raw response as provided by the underlying backend.
   * @param {*} [error] If applicable, error as provided by the underlying backend.
   * @returns {*} Response to a request.
   */
  getClientResponse(backend, config, rawResponse, error) {
    const httpOptions = backend.createHttpOptions(config);
    const httpResponse = backend.createHttpResponse(rawResponse, error);
    httpResponse.setRequestTime(httpOptions.getRequestTime());
    return httpResponse.toClientResponse({
      options: httpOptions.toJSON(),
    });
  }

  /**
   * Retrieves the final error that the client will provide to the consumer.
   *
   * @param {HttpBackend} backend Backend processing the current request.
   * @param {typedefs.RequestOptions} config Configuration that generated the client's response.
   * @param {*} error Error as provided by the underlying backend.
   * @returns {*} Error to the request.
   */
  getClientError(backend, config, error) {
    const httpOptions = backend.createHttpOptions(config);
    const httpResponse = backend.createHttpResponse({}, error);
    httpResponse.setRequestTime(httpOptions.getRequestTime());
    return httpResponse.toClientResponse({
      options: httpOptions.toJSON(),
    });
  }

  /**
   * Clears the cookies that the client is currently using.
   *
   * @returns {Promise} Resolves when the client's cookies have been cleared.
   */
  clearCookies() {
    const { cookieJar } = this[PRIVATE];
    return cookieJar.removeAllCookies();
  }

  /**
   * Sets cookies in the client's internal jar. The operation is additive, so new cookies
   * will be added and existing cookies will be replaced.
   *
   * @param {string} url Full URL to which the cookies will apply.
   * @param {Array<string>} cookies List of raw cookie values to be added.
   * @returns {Promise} Resolves when the cookies have been set.
   */
  async setCookies(url, cookies) {
    const { cookieJar } = this[PRIVATE];
    for (let i = 0; i < cookies.length; i++) {
      const cookie = Cookie.parse(cookies[i]);
      await cookieJar.setCookie(cookie, url);
    }
  }

  /**
   * Retrieves the client's cookies from its internal jar.
   *
   * @param {string} url Full URL whose cookies should be retrieved.
   * @returns {Promise<Array<string>>} List of raw cookie values.
   */
  async getCookies(url) {
    const cookies = await this[_getClientCookies](url);
    return cookies.map((cookie) => cookie.toString());
  }

  /**
   * Updates the client's current cookies with set-cookie header of a given
   * response.
   *
   * @param {HttpOptions} options Options to use to submit the request.
   * @param {HttpBackend} backend Backend currently processing the request.
   * @param {HttpResponse} response HTTP response of a request. set-cookie header from
   *  the response will be used to update the client's cookies.
   * @returns {Promise} Resolves when all cookies have been set.
   */
  async [_setClientCookies](options, backend, response) {
    if (!backend.shouldHandleCookies()) {
      return;
    }

    const setCookie = backend.getSetCookies(response.getRawResponse());
    if (!setCookie.length) {
      options.logDebug(
        "no cookies received from set-cookie header, not setting cookies"
      );
    }

    return this.setCookies(options.getUrl(), setCookie);
  }

  /**
   * Retrieves the cookies that the client has received from the set-cookie headers
   * of responses it has made.
   *
   * @param {string} url Url whose cookies should be retrieved.
   * @returns {Promise<Array<Cookie>>} Additional cookies from the client's cookie
   *  jar.
   */
  async [_getClientCookies](url) {
    const { cookieJar } = this[PRIVATE];
    return cookieJar.getCookies(url);
  }
}

module.exports = HttpClient;
