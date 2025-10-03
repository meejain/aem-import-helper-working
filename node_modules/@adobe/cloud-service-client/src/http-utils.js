/*************************************************************************
 * ADOBE CONFIDENTIAL
 * ___________________
 *
 * Copyright 2021 Adobe
 * All Rights Reserved.
 *
 * NOTICE: All information contained herein is, and remains
 * the property of Adobe and its suppliers, if any. The intellectual
 * and technical concepts contained herein are proprietary to Adobe
 * and its suppliers and are protected by all applicable intellectual
 * property laws, including trade secret and copyright laws.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe.
 **************************************************************************/

const { Cookie } = require("tough-cookie");

/**
 * Converts a simple object to its JSON representation. Ensures that certain
 * types are emitted from the JSON.
 *
 * @param {object} toConvert Simple object to convert.
 * @returns {object} Simple object containing only simple types from the
 *  input.
 */
function objectToJson(toConvert) {
  const json = {};
  Object.keys(toConvert).forEach((option) => {
    const optionValue = toConvert[option];
    if (optionValue !== undefined) {
      if (optionValue.toJSON) {
        json[option] = optionValue.toJSON();
      } else if (typeof optionValue !== "function") {
        json[option] = optionValue;
      }
    }
  });
  return json;
}

/**
 * Fetch, being AWESOME, doesn't handle multiple header values very well. Assume
 * the set-cookie response header, which can have multiple values. Fetch will
 * return the header's value as a comma-delimited list of all the header values
 * for set-cookie. That can be problematic, considering that cookie values can
 * _also_ have commas in them (note the comma in the Expires date):
 *
 * somecookie=value; Path=/; Expires=Wed, 01-Sep-2021 23:21:59 GMT; Max-Age=604800
 *
 * This makes it so we can't simply look for a comma to figure out the unique
 * header values for set-cookie. This function is an effort to get around this
 * problem: it will do its best to parse the multiple cookie values into an
 * array whose elements are the multiple values.
 *
 * WARNING: this method makes assumptions about the structure of cookie
 * values. It may have unintended side-effects if used on other headers.
 *
 * @param {string} headerValue Header value, which might contain multiple
 *  values.
 * @returns {Array} Each of the values provided for a single header.
 */
function parseMultipleFetchSetCookieHeaders(headerValue) {
  // initially split on the comma. this will result in some incorrect
  // entries due to potential cookie values with commas
  const splitValues = headerValue.split(", ");
  const headerValues = [];
  let currValue = "";
  splitValues.forEach((splitValue) => {
    if (splitValue) {
      // this regex will check to see if the current split value begins
      // with a known cookie format: some value without spaces, followed
      // by an = sign. For example: cookie=value. if the string _doesn't_
      // begin like that, chances are is a remnant of a bad comma split.
      // in that case, append it to currValue so that it's included with
      // its cookie entry.
      if (!/^[^ ]+=/g.exec(splitValue)) {
        currValue += `, ${splitValue}`;
      } else {
        // looks to be a valid cookie value. treat it as such and include
        // it in the final list of header values.
        if (currValue) {
          headerValues.push(currValue);
        }
        currValue = splitValue;
      }
    }
  });

  // make sure to include the last value
  if (currValue) {
    headerValues.push(currValue);
  }

  return headerValues;
}

/**
 * Redacts certain headers so that sensitive values are removed.
 *
 * @param {object} headers Headers to redact.
 * @returns {object} Redacted version of the headers.
 */
function redactHeaders(headers) {
  const redacted = { ...headers };
  Object.keys(redacted).forEach((headerName) => {
    const testName = headerName.toLowerCase();
    if (testName === "authorization" || testName === "cookie") {
      redacted[headerName] = "<redacted>";
    }
  });
  return redacted;
}

/**
 * Parses a raw Cookie header value and converts it to an array of tough-cookie
 * Cookie objects.
 *
 * @param {string} headerValue Raw value of an HTTP "Cookie" header.
 * @returns {Array<Cookie>} List of Cookie objects as parsed from the header.
 */
function parseCookieHeader(headerValue) {
  return String(headerValue).split("; ").map(Cookie.parse);
}

/**
 * Builds a cookie lookup for a given list of cookies. The lookup's keys will
 * be the key property of all cookies in the lookup. Values will be the
 * Cookie representing the corresponding key.
 *
 * @param {Array<Cookie>} cookieList Cookies to be used.
 * @returns {object} Simple javascript object.
 */
function buildCookieLookup(cookieList) {
  const lookup = {};
  cookieList.forEach((cookie) => {
    const { key } = cookie;
    lookup[key] = cookie;
  });
  return lookup;
}

module.exports = {
  objectToJson,
  parseMultipleFetchSetCookieHeaders,
  redactHeaders,
  parseCookieHeader,
  buildCookieLookup,
};
