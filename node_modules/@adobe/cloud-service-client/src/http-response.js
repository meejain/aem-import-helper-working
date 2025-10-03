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

const { redactHeaders } = require("./http-utils");

// private methods
const PRIVATE = Symbol("PRIVATE");
const _extend = Symbol("_extend");

/**
 * Represents a response received from the HttpClient after submitting a request. Provides
 * various accessors for retrieving information from the response.
 */
class HttpResponse {
  /**
   * Constructs a new response.
   *
   * @param {*} rawResponse Raw response on which the client's response is
   *  based.
   * @param {*} [error] If provided, an error that will be associated with
   *  the response.
   */
  constructor(rawResponse, error = false) {
    this[PRIVATE] = {
      rawResponse,
      error,
    };
  }

  /**
   * Retrieves the status code of the response.
   *
   * @returns {number} HTTP status code.
   */
  getStatus() {
    const { rawResponse } = this[PRIVATE];
    return rawResponse.status;
  }

  /**
   * Retrieves the headers of the response. The return value should be a simple
   * object whose keys are header names and whose values are header values.
   *
   * @returns {*} The response's headers.
   */
  getHeaders() {
    const { rawResponse } = this[PRIVATE];
    return rawResponse.headers;
  }

  /**
   * Retrieves the status text of the response.
   *
   * @returns {string} HTTP status text;
   */
  getStatusText() {
    const { rawResponse } = this[PRIVATE];
    return rawResponse.statusText;
  }

  /**
   * Retrieves the raw response from the underlying HTTP backend, as-is.
   *
   * @returns {*} Raw response of the underlying HTTP backend.
   */
  getRawResponse() {
    const { rawResponse } = this[PRIVATE];
    return rawResponse;
  }

  /**
   * Sets the amount of time, in milliseconds, that it took for the underlying
   * HTTP library to submit the request and get a response.
   *
   * @param {number} requestTime Time span in milliseconds.
   */
  setRequestTime(requestTime) {
    this[PRIVATE].requestTime = requestTime;
  }

  /**
   * Converts the client's HTTP response into the raw result that was provided by the
   * underlying HTTP library. The result could be various things, such as an HTTP
   * response or a javascript error. No matter the result, it will have been
   * extended with the additional information provided by the client.
   *
   * @param {object} clientInfo Simple object containing information that should be
   *  included in the cloudClient property that will be added to the response.
   * @returns {*} The final result to provide to the client's consumer.
   */
  toClientResponse(clientInfo) {
    const { rawResponse, error } = this[PRIVATE];
    this[_extend](rawResponse, clientInfo);

    if (error) {
      this[_extend](error, clientInfo);
      // if the response generated an error when sent with then underlying backend,
      // throw that error now
      throw error;
    }

    // an error was not thrown by the underlying backend, return the response that
    // it provided
    return rawResponse;
  }

  /**
   * Converts the response to a readable JSON format, with fewer properties. In particular,
   * the JSON won't contain information about the request that generated the response.
   *
   * @returns {object} Response values as JSON.
   */
  toJSON() {
    const { error, requestTime } = this[PRIVATE];

    const status = this.getStatus();
    const statusText = this.getStatusText();
    const headers = this.getHeaders();
    const json = {};

    if (headers) {
      json.headers = redactHeaders(headers);
    }

    if (status) {
      json.status = status;
    }

    if (statusText) {
      json.statusText = statusText;
    }

    if (requestTime !== undefined) {
      json.requestTime = requestTime;
    }

    if (error) {
      if (error.name || error.message) {
        const errorInfo = {};
        if (error.name) {
          errorInfo.name = error.name;
        }
        if (error.message) {
          errorInfo.message = error.message;
        }
        json.error = errorInfo;
      } else {
        json.error = error;
      }
    }

    return json;
  }

  /**
   * Returns a stringified version of the response's JSON.
   *
   * @returns {string} Stringified JSON.
   */
  toString() {
    return JSON.stringify(this.toJSON(), null, 2);
  }

  /**
   * Does the work of extending a target with additional information provided
   * by the client.
   *
   * @param {*} toExtend The item that will be extended with more properties.
   * @param {*} clientInfo Additional information to include on the response's
   *  cloudClient property.
   */
  [_extend](toExtend, clientInfo) {
    toExtend.cloudClient = {
      ...clientInfo,
      ...this.toJSON(),
    };
  }
}

module.exports = HttpResponse;
