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

const HttpResponse = require("../http-response");

const PRIVATE = Symbol("PRIVATE");

/**
 * @typedef {object} RetryOptions
 * @property {number} attempts The number of times that the client has made the
 *  request.
 * @property {number} maxAttempts The maximum number of times that the client has
 *  been configured to make the request. This value is not necessarily enforced
 *  by the client - it's simply informational and can be checked by the strategy
 *  if its logic involves a cap on the number of retry attempts.
 * @property {number} delayMultiple The delay multiple that the client has been
 *  configured to use when calculating the amount of time that the client should
 *  delay before making another retry attempt. This value is not necessarily
 *  used by the client - it's simply informational and can be used by the strategy
 *  its logic involves an exponential delay in the time that the client should
 *  wait between retries.
 * @property {HttpResponse} response The response to the HTTP request currently
 *  being examined to decide whether it should be retried.
 * @property {string} url The URL that was requested to generate the response.
 * @property {object} options Additional options that were used to initiate the request
 *  that generated the response.
 */

/**
 * @typedef {object} StrategyOptions
 * @property {Function} shouldRetry Should return a Promise that resolves to true if
 *  a request should be retried. Receives a single RetryOptions argument.
 * @property {Function} [getDelayMultiple] Should return a Promise that resolves to the
 *  value by which the delay should be multiplied depending on the retry number.
 *  Receives a single RetryOptions argument. Defaults to the multiple provided in
 *  the client's options.
 * @property {Function} [getMaxRetries] Should return a Promise that resolves to the
 *  maximum number of times that the request should be retried. Defaults to the
 *  value provided in the client's options.
 */

/**
 * Represents one or more strategies that the HTTP client will use to determine whether a
 * request should be retried or not. These strategies can be provided by consumers of
 * the client to control the client's retry logic.
 *
 * There are several out-of-the-box strategies that the library provides, but the client
 * is free to supply their own custom strategies as well. The client uses a default set
 * of strategies related to retrying certain error responses.
 */
class RetryStrategy {
  /**
   * Constructs a new strategy that uses the given options for its functionality.
   *
   * @param {StrategyOptions} [strategyOptions] Options for controlling how the
   *  strategy behaves.
   */
  constructor(strategyOptions = {}) {
    this[PRIVATE] = {
      options: strategyOptions,
    };
  }

  /**
   * Determines whether a given http request should be retried based on the response
   * that was received.
   *
   * The default implementation returns true if the number of attempts is less than
   * the maximum number of attempts.
   *
   * One thing to note is that this method could be called for both failed _and_
   * successful requests. Be sure to handle either case accordingly.
   *
   * @param {RetryOptions} retryOptions Information about the current request, which
   *  can be used to determine whether a retry is in order.
   * @returns {Promise<boolean>} True if the request should be retried, false otherwise.
   */
  async shouldRetry(retryOptions) {
    const { shouldRetry: retryFromOptions = async () => false } =
      this[PRIVATE].options;
    return retryFromOptions(retryOptions);
  }

  /**
   * Retrieves the value by which the configured retry delay should be multiplied to
   * determine the amount of time the client should wait before making another retry
   * attempt.
   *
   * @param {RetryOptions} retryOptions Information about the current request, which
   *  can be used to determine the multiple.
   * @returns {Promise<number>} Delay multiple.
   */
  async getRetryDelayMultiple(retryOptions) {
    const { getDelayMultiple = async () => retryOptions.delayMultiple } =
      this[PRIVATE].options;
    return getDelayMultiple(retryOptions);
  }

  /**
   * Retrieves the amount of time, in milliseconds, that the retry should be delayed. Note
   * that the retry delay multiple will be used to expentially increase this delay with
   * each retry.
   *
   * @param {RetryOptions} retryOptions Information about the current request, which
   *  can be used to determine the delay.
   * @returns {Promise<number>} Retry delay.
   */
  async getRetryDelay(retryOptions) {
    const { getDelay = async () => retryOptions.delay } = this[PRIVATE].options;
    return getDelay(retryOptions);
  }

  /**
   * Retrieves the maximum number of times that a request should be retried according to
   * the strategy.
   *
   * @param {RetryOptions} retryOptions Information about the current request, which
   *  can be used to determine the count.
   * @returns {Promise<number>} Retry count.
   */
  async getMaxRetryCount(retryOptions) {
    const { getMaxRetries = async () => retryOptions.maxAttempts } =
      this[PRIVATE].options;
    return getMaxRetries(retryOptions);
  }

  /**
   * Retrieves the raw options that will be given to the underlying HTTP library on the
   * next retry.
   *
   * @param {RetryOptions} retryOptions Information about the current request, which
   *  can be used to determine the options.
   * @returns {Promise<object>} Raw request options.
   */
  async getRetryRequestOptions(retryOptions) {
    const {
      getRequestOptions = async () => {
        return {};
      },
    } = this[PRIVATE].options;
    return getRequestOptions(retryOptions);
  }
}

module.exports = RetryStrategy;
