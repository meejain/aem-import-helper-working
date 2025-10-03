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

const { Cookie, CookieJar } = require("tough-cookie");
const { v4: uuid } = require("uuid");

const {
  objectToJson,
  parseCookieHeader,
  buildCookieLookup,
} = require("./http-utils");
const DefaultLogger = require("./default-logger");
const ErrorStatusCode = require("./retry-strategies/error-status-code");
const NetworkError = require("./retry-strategies/network-error");
const RetryStrategy = require("./retry-strategies/retry-strategy");
const EventuallyConsistentCreate = require("./retry-strategies/eventually-consistent-create");
const EventuallyConsistentUpdate = require("./retry-strategies/eventually-consistent-update");
const EventuallyConsistentDelete = require("./retry-strategies/eventually-consistent-delete");
const HttpResponse = require("./http-response");
const { DEFAULT_TIMEOUT } = require("./constants");
const typedefs = require("./typedefs");

const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_RETRY_DELAY_MULTIPLE = 2;

// private methods
const PRIVATE = Symbol("PRIVATE");
const _getRetryOptions = Symbol("_getRetryOptions");
const _getCookieLookup = Symbol("_getCookieLookup");
const _log = Symbol("_log");

class HttpOptions {
  /**
   * Constructs a new instance of the options class that uses the given raw set
   * of options.
   *
   * @param {typedefs.RequestOptions} [options] Options as passed in by a consumer.
   * @param {typedefs.ClientOptions} [clientOptions] Client-level options as
   *  provided when the client was created.
   */
  constructor(options = {}, clientOptions = {}) {
    this[PRIVATE] = {
      options,
      clientOptions,
    };
  }

  /**
   * Retrieves the URL to be requested by the client.
   *
   * @returns {string} An HTTP URL.
   */
  getUrl() {
    const { url } = this.getOptions();
    return url;
  }

  /**
   * Retrieves the method to be used in a request.
   *
   * @returns {string} An HTTP method.
   */
  getMethod() {
    const { method = "GET" } = this.getOptions();
    return method;
  }

  /**
   * Retrieves the number of times that the request has been retried so far.
   *
   * @returns {number} Retry count.
   */
  getRetries() {
    const { retries = 0 } = this.getClientOptions();
    return retries;
  }

  /**
   * Retrieves the total amount of time, in milliseconds, that the request has spent
   * waiting between retries.
   *
   * @returns {number} Timespan in milliseconds.
   */
  getRetryWait() {
    const { retryWait = 0 } = this.getClientOptions();
    return retryWait;
  }

  /**
   * Retrieves the responses that qualified for retries for the current request.
   *
   * @returns {Array<*>} Array of responses registered with the options.
   */
  getRetryResponses() {
    const { retryResponses = [] } = this.getClientOptions();
    return retryResponses;
  }

  /**
   * Retrieves the amount of time, in milliseconds, that it took for the most recent
   * request's response to be provided by the underlying HTTP backend.
   *
   * @returns {number} Timespan in milliseconds.
   */
  getRequestTime() {
    const { startTime, endTime } = this.getClientOptions();

    if (startTime && endTime) {
      return endTime - startTime;
    }

    return 0;
  }

  /**
   * Sets the raw HTTP request options upon which the client's options are based. This will merge
   * the current options with the given options.
   *
   * @param {typedefs.RequestOptions} options Raw HTTP request options.
   */
  setRequestOptions(options) {
    this[PRIVATE].options = {
      ...this[PRIVATE].options,
      ...options,
    };
  }

  /**
   * Records the start time of the most recent request.
   *
   * @param {number} startTime Timestamp, in milliseconds.
   */
  setStartTime(startTime) {
    this.addClientOptions({
      startTime,
      endTime: 0,
    });
  }

  /**
   * Records the end time of the most recent request.
   *
   * @param {number} endTime Timestamp, in milliseconds.
   */
  setEndTime(endTime) {
    this.addClientOptions({ endTime });
  }

  /**
   * Adds information about a retry to the options. The method will add the given response
   * information to the options' retryResponses, increment the options' retries count,
   * and add the given delay to the options' retryWait value.
   *
   * @param {HttpResponse} response Response to add to the option's retryResponses.
   * @param {number} retryDelay Timespan, in milliseconds, to add to the options' retryWait.
   */
  addRetry(response, retryDelay) {
    const clientOptions = this.getClientOptions();
    const { retries = 0, retryWait = 0, retryResponses = [] } = clientOptions;

    retryResponses.push(response.toJSON());

    const newOptions = {
      retries: retries + 1,
      retryWait: retryWait + retryDelay,
      retryResponses,
    };

    this.addClientOptions(newOptions);
  }

  /**
   * Retrieves the strategies that will be used to determine if a request by the
   * client should be retried.
   *
   * Each strategy is responsible for examining a response and determining whether
   * it warrants a retry. The client will initiate a retry based on the first
   * strategy that indicates a retry is necessary.
   *
   * @returns {Array<typedefs.RetryStrategy>} Strategies to use to initiate retries.
   */
  getRetryStrategies() {
    const {
      eventuallyConsistentCreate = false,
      eventuallyConsistentUpdate = false,
      eventuallyConsistentDelete = false,
    } = this.getClientOptions();
    const allStrategies = [new ErrorStatusCode(), new NetworkError()];
    const { strategies = [] } = this[_getRetryOptions]();

    strategies.forEach((strategy) => {
      allStrategies.push(new RetryStrategy(strategy));
    });

    if (eventuallyConsistentCreate) {
      allStrategies.push(new EventuallyConsistentCreate());
    }

    if (eventuallyConsistentUpdate) {
      allStrategies.push(new EventuallyConsistentUpdate());
    }

    if (eventuallyConsistentDelete) {
      allStrategies.push(new EventuallyConsistentDelete());
    }

    return allStrategies;
  }

  /**
   * Gets the amount of time, in milliseconds, that the client should wait before
   * retrying a failed request.
   *
   * The client will use this value in conjunction with a retry delay to determine
   * the total delay based on the number of retry attempts.
   *
   * Default is 1000.
   *
   * @returns {number} Time span in milliseconds.
   */
  getRetryDelay() {
    const { delay = DEFAULT_RETRY_DELAY } = this[_getRetryOptions]();
    return delay;
  }

  /**
   * Retrieves the number that the retry delay should be multiplied by each time a
   * request is retried.
   *
   * For example, assume the delay multiple is 2 and the delay is 1000 (one second).
   * The first time the client retries it a request it will wait 1 second, then 2
   * seconds the next attempt, then 4 seconds, then 8 seconds, etc.
   *
   * This multiple will only be used when a retry strategy doesn't provide its own
   * value.
   *
   * Default is 2.
   *
   * @returns {number} Delay multiplier.
   */
  getRetryDelayMultiple() {
    const { delayMultiple = DEFAULT_RETRY_DELAY_MULTIPLE } =
      this[_getRetryOptions]();
    return delayMultiple;
  }

  /**
   * Gets the number of times that the client should retry a request before
   * giving up.
   *
   * This count will be provided to each retry strategy, but it's ultimately
   * up to the strategy to honor it.
   *
   * Default is 3.
   *
   * @returns {number} Number of retries.
   */
  getMaxRetries() {
    const { count = DEFAULT_RETRY_COUNT } = this[_getRetryOptions]();
    return count;
  }

  /**
   * Retrieves the timeout value, in milliseconds, as specified in the client's
   * options.
   *
   * @returns {number} Timespan in milliseconds.
   */
  getTimeout() {
    const { timeout = DEFAULT_TIMEOUT } = this.getClientOptions();
    return timeout;
  }

  /**
   * Retrieves the cookies that the options are currently using.
   *
   * @returns {Promise<CookieJar>} Cookie jar containing the cookies for
   *  the options.
   */
  async getCookieJar() {
    const { cookies } = this[PRIVATE];
    if (!cookies) {
      const cookieJar = new CookieJar();
      let cookieList = [];
      const { headers = {} } = this.getOptions();

      // ensure cookie header name is case insensitive
      const headerNames = Object.keys(headers);
      let cookieHeader = "";
      for (let i = 0; i < headerNames.length; i++) {
        if (String(headerNames[i]).toLowerCase() === "cookie") {
          cookieHeader = headers[headerNames[i]];
          break;
        }
      }

      // parse cookie header if provided
      if (cookieHeader) {
        cookieList = parseCookieHeader(cookieHeader);
      }

      // add cookies to options jar for the current url
      const url = this.getUrl();
      for (let i = 0; i < cookieList.length; i++) {
        this.logDebug(
          `adding cookie "${cookieList[i].key}" from header to options jar`
        );
        await cookieJar.setCookie(cookieList[i], url);
      }
      this[PRIVATE].cookies = cookieJar;
    }
    return this[PRIVATE].cookies;
  }

  /**
   * Sets additional cookies that will be included in the HTTP options. Note that only
   * the options will only include cookies that have not already been explicitly
   * specified in the options' cookie header.
   *
   * @param {Array<Cookie>} cookies Cookies to be added to the options.
   */
  setAdditionalCookies(cookies) {
    this[PRIVATE].addlCookies = cookies;
  }

  /**
   * Converts the raw options into a set of configurations that can be used to submit
   * an HTTP request.
   *
   * @returns {Promise<typedefs.RequestOptions>} Will be resolved with the configuration that can be
   *  used in an HTTP request.
   */
  async toRequestConfig() {
    const options = {
      ...this.getOptions(),
    };

    const { addlCookies = [] } = this[PRIVATE];
    if (addlCookies.length) {
      const cookies = [...addlCookies];

      // cookies will be added to the options' jar. no need to remember them anymore
      this[PRIVATE].addlCookies = [];

      // if there are additional cookies, overwrite whatever cookie header may have been
      // provided with the contents of the options' jar (created from the options' cookie
      // header), plus the additional cookies.
      const jar = await this.getCookieJar();
      const cookieLookup = await this[_getCookieLookup](jar);
      this.logDebug(
        `adding ${cookies.length} to options cookie jar, which already has ${
          Object.keys(cookieLookup).length
        } cookies`
      );

      // merge the additional cookies with current cookies
      for (let i = 0; i < cookies.length; i++) {
        const { key } = cookies[i];
        if (!cookieLookup[key]) {
          this.logDebug(
            `adding cookie "${key}" from client jar to options jar`
          );
          await jar.setCookie(cookies[i], this.getUrl());
        } else {
          this.logDebug(
            `skipping cookie "${key}" from client jar because it's already in the options jar`
          );
        }
      }

      // set the cookie header
      const cookie = await jar.getCookieString(this.getUrl());
      if (cookie) {
        const { headers = {} } = options;
        options.headers = {
          ...headers,
          cookie,
        };
      }
    }

    return options;
  }

  /**
   * Logs a message at the debug level using the logger provided in the options.
   *
   * @param {Array<any>} theArguments Arguments to use to format the message.
   */
  logDebug(...theArguments) {
    this[_log]("debug", theArguments);
  }

  /**
   * Logs a message at the info level using the logger provided in the options.
   *
   * @param {Array<any>} theArguments Arguments to use to format the message.
   */
  logInfo(...theArguments) {
    this[_log]("info", theArguments);
  }

  /**
   * Logs a message at the warn level using the logger provided in the options.
   *
   * @param {Array<any>} theArguments Arguments to use to format the message.
   */
  logWarn(...theArguments) {
    this[_log]("warn", theArguments);
  }

  /**
   * Logs a message at the error level using the logger provided in the options.
   *
   * @param {Array<any>} theArguments Arguments to use to format the message.
   */
  logError(...theArguments) {
    this[_log]("error", theArguments);
  }

  /**
   * Retrieves the request ID that the options are currently using. Will use the
   * x-request-id header if provided in the initial options; will generate its
   * own if none provided.
   *
   * @returns {string} The request ID for the options.
   */
  getRequestId() {
    if (!this[PRIVATE].requestId) {
      const { headers = {} } = this.getOptions();
      this[PRIVATE].requestId = headers["x-request-id"] || uuid();
    }
    return this[PRIVATE].requestId;
  }

  /**
   * Retrieves the full set of options as provided in the class constructor.
   *
   * @returns {typedefs.RequestOptions} Raw HTTP config as passed into a request.
   */
  getOptions() {
    const { options = {} } = this[PRIVATE];
    return options;
  }

  /**
   * Retrieves the HTTP client-specific options from the raw HTTP config
   * as passed into the class constructor.
   *
   * @returns {typedefs.ClientRequestOptions} Options specific to the HTTP client.
   */
  getClientOptions() {
    const { options = {} } = this[PRIVATE];
    const { cloudClient = {} } = options;
    return cloudClient;
  }

  /**
   * Adds values to the client-specific options of the HTTP config. The
   * operation is additive, so new values will be added and existing
   * values overwritten.
   *
   * @param {typedefs.ClientRequestOptions} options Values to add.
   */
  addClientOptions(options) {
    const clientOptions = this.getClientOptions();
    this[PRIVATE].options.cloudClient = {
      ...clientOptions,
      ...options,
    };
  }

  /**
   * Merges a given set of client-specific request options with whichever client
   * request options are already specified. Note the options that aren't already
   * present in the http options will be added, but duplicate options will
   * _not_ be overwritten.
   *
   * @param {typedefs.ClientRequestOptions} options Client-specific request options
   *  to merge.
   */
  mergeClientOptions(options) {
    const clientOptions = this.getClientOptions();
    const { retry: existingRetry = {} } = clientOptions;
    const { strategies: existingStrategies = [] } = existingRetry;

    const { retry = {} } = options;
    const { strategies = [] } = retry;

    const newOptions = {
      ...options,
      ...clientOptions,
    };

    if (Object.keys(existingRetry).length || Object.keys(retry).length) {
      newOptions.retry = {
        ...retry,
        ...existingRetry,
      };

      if (existingStrategies.length || strategies.length) {
        newOptions.retry.strategies = [...existingStrategies, ...strategies];
      }
    }

    this[PRIVATE].options.cloudClient = newOptions;
  }

  /**
   * Converts the options to a JSON representation.
   *
   * @returns {object} Simple object representing the options.
   */
  toJSON() {
    const jsonOptions = { ...this.getOptions() };
    const { headers = {} } = jsonOptions;
    jsonOptions.headers = {
      ...headers,
      "x-request-id": this.getRequestId(),
    };
    const cloudClient = {
      retries: this.getRetries(),
      retryWait: this.getRetryWait(),
      retryResponses: this.getRetryResponses(),
      ...this.getClientOptions(),
    };
    if (cloudClient.retry) {
      if (cloudClient.retry.strategies) {
        delete cloudClient.retry.strategies;
      }
    }
    jsonOptions.cloudClient = cloudClient;
    return objectToJson(jsonOptions);
  }

  /**
   * Converts the options to a stringified version of its JSON.
   *
   * @returns {string} The options' JSON as a string.
   */
  toString() {
    return JSON.stringify(this.toJSON(), null, 2);
  }

  /**
   * Retrieves the retry option element of the HTTP options.
   *
   * @returns {typedefs.RetryOptions} Retry information from the options.
   */
  [_getRetryOptions]() {
    const { retry = {} } = this.getClientOptions();
    return retry;
  }

  /**
   * Builds a cookie lookup for a given cookie jar. The lookup's keys will
   * be the key property of all cookies in the lookup. Values will be the
   * Cookie representing the corresponding key.
   *
   * @param {CookieJar} cookieJar Jar whose cookies will be used.
   * @returns {Promise<object>} Simple javascript object.
   */
  async [_getCookieLookup](cookieJar) {
    const cookies = await cookieJar.getCookies(this.getUrl());
    return buildCookieLookup(cookies);
  }

  /**
   * Logs a message using the options' logger at the given level. Includes helpful information
   * specific to the options in the message.
   *
   * @param {string} logMethod Name of the method from the logger to use.
   * @param {Array} theArguments Arguments that will be applied to the log method.
   */
  [_log](logMethod, theArguments) {
    const { method = "GET", url } = this.getOptions();
    const { clientOptions = {} } = this[PRIVATE];
    const { log = new DefaultLogger() } = clientOptions;
    log[logMethod].apply(
      log,
      DefaultLogger.prependToMessage(
        `[${new Date().toISOString()}][${this.getRequestId()}] [${method}] [${url}] `,
        theArguments
      )
    );
  }
}

module.exports = HttpOptions;
