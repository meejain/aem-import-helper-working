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

const HttpClient = require("./http-client");
const AxiosBackend = require("./http-backends/axios-backend");
const FetchBackend = require("./http-backends/fetch-backend");
const HttpBackendInterceptor = require("./http-backend-interceptor");
const typedefs = require("./typedefs");

const httpClient = new HttpClient();

/**
 * Sets the default global, client-specific request options that will be applied to all
 * requests that go through the client. These options will be merged with options that
 * are provided at the time of a request.
 *
 * @param {typedefs.ClientRequestOptions} options Global options to add to all requests.
 * @returns {void}
 */
module.exports.setGlobalOptions = (options) =>
  httpClient.setGlobalOptions(options);

/**
 * Clears the cookies that the client is currently using.
 *
 * @returns {Promise} Resolves when the cookies have been cleared.
 */
module.exports.clearCookies = () => httpClient.clearCookies();

const backendInterceptor = new HttpBackendInterceptor(httpClient);

/**
 * Initializes a new instance of axios that will utilize the HTTP client's
 * functionality. Note that this function will use axios.create() to ensure
 * that the global axios instance isn't modified, so the client's
 * functionality will only apply to the returned axios instance.
 *
 * @param {*} axios Axios import to extend.
 * @param {typedefs.ClientOptions} [options={}] Options that control how
 *  the client will behave.
 * @returns {*} Axios, which can be used to submit HTTP requests as usual.
 */
module.exports.axiosClient = (axios, options = {}) => {
  // creating a new instance of axios because registering interceptors
  // on the global axios can lead to issues when multiple libraries
  // are using the client at the same time.
  const axiosBackend = new AxiosBackend(options, axios.create());
  return axiosBackend.registerInterceptors(backendInterceptor);
};

/**
 * Initializes a new instance of fetch that will utilize the HTTP client's
 * functionality. Note that this function will ensure that the global axios
 * instance isn't modified, so the client's functionality will only apply
 * to the returned fetch function.
 *
 * @param {*} fetch Fetch import to extend.
 * @param {typedefs.ClientOptions} [options={}] Options that control how
 *  the client will behave.
 * @returns {*} Fetch, which can be used to submit HTTP requests as usual.
 */
module.exports.fetchClient = (fetch, options = {}) => {
  // the fetch backend will create its own "instance" of fetch to
  // modify, so there is no risk of interference if multiple
  // libraries are using the client at the same time.
  const fetchBackend = new FetchBackend(options, fetch);
  return fetchBackend.registerInterceptors(backendInterceptor);
};
