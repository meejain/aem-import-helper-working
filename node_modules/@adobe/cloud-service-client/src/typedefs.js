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

/**
 * @typedef ClientOptions
 * @property {boolean} [handleCookies=false] Instructs the client whether or not it
 *  should perform its cookie handling functionality, where it will maintain its
 *  own cookie jar and add Set-Cookie response header values to it.
 * @property {*} [log] The logger that the client will use to record messages. The
 *  parameter should be some kind of object with methods debug(), info(), warn(),
 *  and error(). Each of these methods is expected to behave like console.log().
 *  If not provided, the client will log messages to the console if environment
 *  variable NODE_HTTP_CLIENT_LOG_LEVEL is set to either "DEBUG", "INFO", "WARN",
 *  or "ERROR".
 */

/**
 * @typedef RetryInfo
 * @property {number} attempts The number of times the current request has been
 *  sent.
 * @property {number} maxAttempts The _default_ maximum number of attempts as
 *  provided in the client's options.
 * @property {*} response Response that was the result of the request. This
 *  will be the raw response from the underlying HTTP backend.
 * @property {string} url URL to which the client sent the HTTP request that
 *  generated the response.
 * @property {*} options Simple object containing the request options that were
 *  used to generate the response.
 */

/**
 * @typedef RetryStrategy
 * @property {Function} shouldRetry Returns a Promise that resolves to true
 *  if the information provided by the client warrants a retry. The function
 *  will be passed a single argument: an object of type {@link RetryInfo}.
 * @property {Function} [getDelayMultiple] Returns a Promise that resolves to
 *  the multiple to use when calculating the amount of time to delay before
 *  retrying the request. The function will be called with a single
 *  argument of type {@link RetryInfo}. If not specified, the value will
 *  default to the multiple provided in the client's retry options.
 * @property {Function} [getMaxRetries] Returns a Promise that resolves to
 *  the maximum number of times that a given request should be made. The
 *  function will be called with a single argument of type {@link RetryInfo}.
 *  If not specified, the value will default to the number provided in the
 *  client's retry options. Note that "-1" indicates the client should
 *  continue to retry indefinitely; _use this option with extreme care_.
 */

/**
 * @typedef RetryOptions
 * @property {Array<RetryStrategy>} [strategies=[]] Additional strategies that
 *  the client will use to determine whether requests should be retried.
 * @property {number} [count=3] The maximum number of times the client will
 *  retry a given request. Note that this is the _default_ value and
 *  will not necessarily be respected by all retry strategies.
 * @property {number} [delay=1000] The amount of time, in milliseconds, the
 *  client will wait before retrying a request.
 * @property {number} [delayMultiple=2] Each time the client delays a retry,
 *  it will multiply the delay amount by this value. Assume delay is 1000,
 *  retry is 4, and delayMultiple is 2. The first time the client retries
 *  a request, it will wait 1000ms. The second time it will wait 2000ms,
 *  the third time it will wait 4000ms, etc. Note that this is the _default_
 *  value, and will not necessarily be respected by all retry strategies.
 */

/**
 * @typedef ClientRequestOptions
 * @property {boolean} [eventuallyConsistentCreate=true] When true, the client will use a
 *  built-in retry strategy for handling creation in an eventually consistent system.
 * @property {boolean} [eventuallyConsistentUpdate=true] When true, the client will use a
 *  built-in retry strategy for handling updates in an eventually consistent system.
 * @property {boolean} [eventuallyConsistentDelete=true] When true, the client will use a
 *  built-in retry strategy for handling deletes in an eventually consistent system.
 * @property {number} [timeout=60000] The amount of time, in milliseconds, that the client
 *  will wait for a request before aborting. By default, an aborted request qualifies for
 *  a retry, so timed out requests will fit in with the client's retry functionality.
 * @property {RetryOptions} [retry={}] Various information about how the client will
 *  retry requests under certain circumstances.
 */

/**
 * @typedef RequestOptions
 * @property {ClientRequestOptions} [cloudClient={}] Request options that are specific
 *  to the HTTP client.
 */

exports.unused = {};
