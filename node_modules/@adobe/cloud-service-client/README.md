# Node.JS Cloud Service Client

[![build status](https://github.com/adobe/cloud-service-client/actions/workflows/node.js.yml/badge.svg)](https://github.com/adobe/cloud-service-client/actions/workflows/node.js.yml)
[![Node version](https://img.shields.io/npm/v/@adobe/cloud-service-client)](https://www.npmjs.com/package/@adobe/cloud-service-client/)

This client can be used to submit HTTP requests in javascript. You may ask, "why use this client instead of one of the more popular libraries?" 
First off, it's not a rewrite of HTTP functionality for Node.JS; it's still intended for use with popular modules (like `fetch` or `axios`) for the actual HTTP handling. Think of the client more like added functionality built on top of the basic HTTP capabilities that these modules provide; these features are commonly required when communicating with a complex cloud service.
Here is some of this functionality:

* Provides configurable request retry functionality. For example, if an HTTP request fails with a 5xx level error or a network-related error, the client will automatically retry the request up to a given number of times. Each retry will
wait exponentially longer between each attempt.
* Provides configurable "polling" functionality. Even on successful requests, the client can be configured to continually poll a URL until it responds in a desired way.
* The client is interchangable with `axios` or `fetch`. Currently using `fetch` and need to take advantage of the client's retry functionality? Simply replace your `fetch` calls with the client; everything else (such as response format, options, etc.) will fit into place seamlessly.
* Can be configured to handle Set-Cookie header when provided by servers. The client will store these cookies in its own jar and use them in
subsequent requests.

## Contents

- [Node.JS Cloud Service Client](#nodejs-cloud-service-client)
  - [Contents](#contents)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Axios Usage](#axios-usage)
    - [Fetch Usage](#fetch-usage)
    - [Additional Exports](#additional-exports)
  - [Options](#options)
    - [Client Options](#client-options)
    - [Request Options](#request-options)
  - [Response](#response)
  - [Request Retry](#request-retry)
    - [Retry-After Header](#retry-after-header)
    - [Example Retry Strategies](#example-retry-strategies)
    - [Built-in Retry Strategies](#built-in-retry-strategies)
  - [Cookies](#cookies)
  - [Logging](#logging)
    - [Set a Log Level](#set-a-log-level)
    - [Provide a Custom Logger](#provide-a-custom-logger)
  - [Examples](#examples)
- [Releasing](#releasing)
- [Contributing](#contributing)
- [Licensing](#licensing)

## Installation

The module can be installed from npm:

```
npm install @adobe/cloud-service-client
```

## Usage

Following are some example of how to use the client.

### Axios Usage

```
const originalAxios = require('axios');
const { axiosClient } = require('@adobe/cloud-service-client');

// add client functionality to axios
const axios = axiosClient(originalAxios);

// submit a request that will behave like axios:
const response = await axios('http://myrequesturl.com');

// the response will follow axios' response schema:
const {
  data,
  status,
  statusText,
  headers
} = response;

// axios' other methods work as well:
const response = await axios.get('http://myrequesturl.com);

// pass in any of axios' options:
const response = await axios({
  url: 'http://myrequesturl.com',
  method: 'get',
  responseType: 'stream'
});
```

### Fetch Usage

```
const nodeFetch = require('node-fetch');
const { fetchClient } = require('@adobe/cloud-service-client');

// add client functionality to node-fetch
const fetch = fetchClient(nodeFetch);

// submit the request as fetch would
const response = await fetch('http://myrequesturl.com');

// the response will follow fetch's schema:
const {
  status,
  statusText,
  headers
} = response;
const header1 = headers.get('my-header);
const data = await response.json();

if (response.ok) {
  // process successful response
}

// pass in any of fetch's options:
const response = await fetch('http://myrequesturl.com', {
  method: 'get',
  mode: 'cors',
  redirect: 'follow'
});
```

### Additional Exports

In addition to providing exports identical to whichever HTTP library is being used, the client provides the following functionality:

* {function} `clearCookies`: When invoked, clears any cookies that the client may currently be storing. The method returns a `Promise` that
will resolve when the client's cookies have been cleared.
  * Example: `const { clearCookies } = require('@adobe/cloud-service-client');`
* {function} `setGlobalOptions`: Takes a single argument that should be any client-specific request options to apply to _all_ requests that the client sends. Note that this only applies to the client's request options as described in [Request Options](#request-options); options should be provided to the function as they would to the `cloudClient` property. The underlying
HTTP library of choice (i.e. `axios` or `fetch`) should be used to apply other global request-level options.
  * Example: `const { setGlobalOptions } = require('@adobe/cloud-service-client');`
  * Usage: `setGlobalOptions({ eventuallyConsistentCreate: true });`

## Options

### Client Options

Exports like `axiosClient()` and `fetchClient()` accept an optional second argument, which should be a simple object containing any of the following configurations:

* {boolean} `handleCookies`: If `true`, the client will use its cookie processing capabilities to provide the cookie handling functionality described in the "Cookies" section. Default: `false`.
* {Object} `log`: See [Logging](#logging) section for more details.

For example:

```
const axios = axiosClient(originalAxios, {
  handleCookies: true,
});
```

### Request Options

In addition to any options supported by `axios` or `fetch`, the client has some request options of its own. These options should all be provided in an `cloudClient` property on the request's configuration. For example:

```
fetch(url, {
  method: 'POST',
  mode: 'cors',
  cloudClient: {
    timeout: 10000,
    eventuallyConsistentCreate: true
  }
});
```

* {number} `timeout`: The amount of time, in milliseconds, that the client will wait for a request before aborting. By default, an aborted request qualifies for a retry, so timed out requests will fit in with the client's retry functionality.
* {object} `retry`: Various information about how the client will retry requests under certain circumstances.
  * {Array} `strategies`: The retry "strategies" that the client will send a response through before determining whether the corresponding request needs to be retried. See the "retry" section for more information and examples. Note that these strategies will be _in addition_ to the client's default strategies, which will retry on unexpected network-related errors or 5xx level status codes. Each item in the array should be a strategy object consisting of the following properties:
    * {function} `shouldRetry`: Should return a `Promise` that resolves to true if the information provided by the client warrants a retry. The function will be passed a single argument: an object consisting of the following properties:
      * {number} attempts: The number of times the current request has been sent.
      * {number} maxAttempts: The _default_ maximum number of attempts as provided in the client's options.
      * {number} delay: The _default_ time, in milliseconds, that the client should delay between retries.
      * {number} delayMultiple: The _default_ multiple as provided in the client's options.
      * {*} response: Response that was the result of the request. This will be the raw response from the underlying HTTP library.
      * {string} url: URL to which the client sent the HTTP request that generated the response.
      * {object} options: Simple object containing the raw options that were given to the underlying HTTP library.
    * {function} `getDelay`: Should return a `Promise` that resolves with the amount of time, in milliseconds, that the client should wait before retrying the request. This value will be used in conjunction with the delay multiple to exponentially delay subsequent retries. The function will be called with a single argument: an object matching the one described in the `shouldRetry` function. If not specified, the value will default to the delay provided in the client's retry options.
    * {function} `getDelayMultiple`: Should return a `Promise` that resolves to the multiple to use when calculating the amount of time to delay before retrying the request. The function will be called with a single argument: an object matching the object described in the `shouldRetry` function. If not specified the value will default to the multiple provided in the client's retry options.
    * {function} `getMaxRetries`: Should return a `Promise` that resolves to the maximum number of times that a given request should be made. The function will be called with a single argument: an object matching the object described in the `shouldRetry` function. If not specified, the value will default to the number provided in the client's retry options. Note that `-1` indicates the client should continue to retry indefinitely; _use this option with extreme care_.
    * {function} `getRequestOptions`: Should return a `Promise` that resolves with the raw options to provide to the underlying HTTP client on the next retry request. These options will be merged with the options that originally generated the response. The function will be called with a single argument: an object matching the one described in the `shouldRetry` function. If not specified, the client will use the originally provided request options.
  * {number} `count`: The maximum number of times the client will retry a given request. Note that this is a _default_ value and will not necessarily be respected by all retry strategies. Default: 3.
  * {number} `delay`: The amount of time, in milliseconds, the client will wait before retrying a request when needed. Default: 1000.
  * {number} `delayMultiple`: Each time the client delays a retry, it will multiply the `delay` amount by this value. Assume `delay` is 1000, `retry` is 4, and `delayMultiple` is 2. The first time the client retries a request it will wait 1000ms, the second time it will wait 2000ms, the third time it will wait 4000ms, etc. Note that
  this is a _default_ value and will not necessarily be respected by all retry strategies. Default: 2.
* {boolean} `eventuallyConsistentCreate`: When `true`, the client will use a built-in retry strategy for handling creation in an eventually consistent system. See the "Retry" section for more details. Default: `false`.
* {boolean} `eventuallyConsistentUpdate`: When `true`, the client will use a built-in retry strategy for handling updates in an eventually consistent system. See the "Retry" section for more details. Default: `false`.
* {boolean} `eventuallyConsistentDelete`: When `true`, the client will use a built-in retry strategy for handling deletions in an eventually consistent system. See the "Retry" section for more details. Default: `false`.

## Response

The client will extend the HTTP response provided by the underlying HTTP library with an `cloudClient` property. Additional information available on this property is as follows:

* {number} `status`: Status code of the response. Note that this value may be missing if the request did not generate a response (such as timeout errors or general network-related errors).
* {number} `statusText`: Status text of the response. Note that this value may be missing if the request did not generate a response (such as timeout errors or general network-related errors).
* {number} `requestTime`: The amount of time, in milliseconds, that the underlying HTTP library took submitting the request and receiving a response. Note that this will apply to _last_ request that was sent. The value may be missing if the request's time
could not be determined.
* {object} `headers`: Simple object whose keys are header names and values are header values. These are the HTTP headers that were provided in the response.
* {object} `options`: The options that were provided to the client when initiating the request. The object will have an `cloudClient` property (regardless of whether one was initially provided) with the following additional properties added to it:
  * {Array&lt;object&gt;} `retryResponses`: If the request was retried, a list of each response, in order, that resulted in a retry. Each item in the list will include all the items included in this section for the response that was retried.
  * {number} `retries`: The number of retries that were made for before providing a response.
  * {number} `retryWait`: The amount of time, in milliseconds, that the client spent waiting between retries before providing a response.
  * {number} `startTime`: Unix timestamp of the time when the request was initiated.
  * {number} `endTime`: Unix timestamp of the time when the client recieved a response.
* {object} `error`: Simple object containing information about the error that the underlying HTTP library may have provided. This property will only be present if there was an error, and its contents may vary depending on the error that was thrown. If the
error is a known javascript error type, it contain the following properties:
  * {string} `name`: The name of the error.
  * {string} `message`: Message that was associated with the error.

## Request Retry

The client has built-in support for retrying a given request under certain circumstances. These circumstances are determined by "request retry strategies." In concept, the client has a list of strategies; each strategy is responsible for examining the response to a request and indicating whether the request qualifies for a retry. Whenever the
client makes a request, it will pass the response through its list of strategies. The first strategy that indicates the request should be retried will force the client to retry the request. The client will use this algorithm regardless of whether the response can be considered a "success" or a "failure."

By default the client will retry a request up to a maximum number of times, exponentially delaying the amount of time between each retry. However, this behavior can be overridden by individual strategies.

### Retry-After Header

If a server responds with a `Retry-After` header, the client will use that value above all other retry options. For example, assume the client has been configured to delay
1 second between retries, with a delay multiple of 2; when a server responds with a `Retry-After` value of 5 on the second retry, the client will ignore the delay and
delay multiple and wait 5 seconds.

This can still be overridden through the `shouldRetry` method, which will receive the server's `Retry-After` value as the default delay.

On subsequent retries, the client will fall back to its default behavior if the server does not provide additional `Retry-After` headers.

### Example Retry Strategies

The following client will retry a request up to 5 times if the response code is `404`:

```
axios({
  url: 'http://myurltorequest',
  cloudClient: {
    retry: {
      count: 4,
      strategies: [{
        shouldRetry: async ({ response }) => response.status === 404
      }]
    }
  }
});
```

This client will poll a URL for as long as the response code is `202`, waiting the _same_ amount of time between each request:

```
axios({
  url: 'http://myurltorequest',
  cloudClient: {
    retry: {
      strategies: [{
        shouldRetry: async ({ response }) => response.status === 202,
        getDelayMultiple: async () => 1,
        getMaxRetries: async () => -1,
      }]
    }
  }
});
```

(Be very careful with a setup like this, because the client will poll indefinitely)

### Built-in Retry Strategies

By default the client will always retry requests that fail because of network-related issues, or that have a 5xx level response code.

In addition, the client provides the following optional strategies. Note that "Eventually Consistent" refers to the concept where there may be a delay between when a remote system is modified, and when the said modification is reflected in the system.

* Eventually Consistent Create
  * Uses the default retry, delay, and multiple to retry a request if the response code is 404.
* Eventually Consistent Update
  * Uses the default retry, delay, and multiple to retry a request if the response code is 200 but the response `etag` header doesn't match the `if-match` header provided in the request.
* Eventually Consistent Delete
  * Uses the default retry, delay, and multiple to retry a request if the response code is _not_ 404.

See the retry options for how to utilize these strategies.

## Cookies

If configured to do so, the client has some basic cookie handling in place. For example, if a response handled by the client has a `Set-Cookie` header, the client will cache those cookies and include them in any subsequent requests that it sends. Note that the cookies are scoped to the lifetime of the client instance - they're not
persisted and will be lost when the client goes out of scope.

The client will favor cookies passed in a request's options over any cookies it has stored. For example, assume that the client is storing cookie `mycookie` with a value of `set-cookie-value` because it received it in a `Set-Cookie` header. Also assume that a consumer of the
client passes the same cookie in the `Cookie` header with a value of `options-cookie-value` when initiating a request. In this case the client will use `options-cookie-value` as the value of `mycookie`, because it was passed into the request options.

Cookies specified with `Set-Cookie` will follow the HTTP specification for the header, and will honor attributes such as `Path`, `Domain`, `Max-Age`, `Expires`, `Secure`, etc. The main deviance is that the life of the cookie will _always_ be, at maximum, the client's scope.

This functionality will only be enabled when the `handleCookies` options is `true`.

## Logging

The client will log messages at different levels throughout the request process. By default none of these messages will appear anywhere; change that behavior by using one of the following methods.

### Set a Log Level

Set an environment variable named `NODE_HTTP_CLIENT_LOG_LEVEL` to the level of logging that is desired. Valid values are `DEBUG`, `INFO`, `WARN`, or `ERROR`.

When utilizing this logging mechanism, all messages are written to `console.log()`. Use the custom logger method to change that behavior.

### Provide a Custom Logger

Use the `log` option to provide any logger of your choosing:

```
const axiosOriginal = require('axios');
const { axiosClient } = require('@adobe/cloud-service-client');

const axios = axiosClient(axiosOriginal, {
  log: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }
});

const response = await axios('http://myrequesturl.com',);
```

As illustrated in the example, the logger provided must have the following methods:

* `debug()`
* `info()`
* `warn()`
* `error()`

Each method is used by the client to log a message at its corresponding log level. The method will receive multiple arguments, similar in nature to how `console.log()` might be used. Here are some potential examples:

```
log.debug('simple message');
log.info('formatted message with value %s', formatValue);
log.error('non-formatted message with value', someValue);
```

## Examples

See the library's [end-to-end contract tests](./e2e/all-methods.test.js) for various examples of how to use the library.

# Releasing

This module uses [semantic-release](https://github.com/semantic-release/semantic-release) when publishing new versions. The process is initiated upon merging commits to the `main` branch. Review semantic-release's documentation for full details, but the most commonly used conventions are:

* `feat:` for non-breaking releases containing new features. This will increment the minor version number. Example:
  * `feat: <message describing changes>`
  * Assuming the library's current version is `1.2.1`, a commit with a message similar to the above would trigger a new release whose version number would be `1.3.0`.
* `fix:` for non-breaking releases containing bug fixes. This will increment the build version number. Example:
  * `fix: <message describing changes>`
  * Assuming the library's current version is `1.2.1`, a commit with a message similar to the above would trigger a new release whose version number would be `1.2.2`.

PRs whose messages do not meet semantic-release's format will not generate a new release.

Release notes are generated based on git commit messages. Release notes will appear in CHANGELOG.md.

# Contributing

Contributions are welcomed! Read the [Contributing Guide](CONTRIBUTING.md) for more information.

# Licensing

This project is licensed under the Apache V2 License. See [LICENSE](LICENSE.txt) for more information.
