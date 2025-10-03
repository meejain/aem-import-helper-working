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

const LEVEL = process.env.NODE_HTTP_CLIENT_LOG_LEVEL;

// private methods
const _consoleLog = Symbol("_consoleLog");

/**
 * Logger that writes formatted message information to the console.
 */
class Logger {
  /**
   * Prepends a given value to a log message, which is assumed to be the first item
   * in an array of arguments to a log function.
   *
   * @param {string} toPrepend Value to prepend.
   * @param {Array} logArgs Array of arguments intended for a log function.
   * @returns {Array} Modified set of log arguments.
   */
  static prependToMessage(toPrepend, logArgs) {
    const argsCopy = [...logArgs];
    const prependedMessage = `${toPrepend}${argsCopy[0]}`;
    argsCopy.splice(0, 1, prependedMessage);
    return argsCopy;
  }

  /**
   * Logs a message at the debug level. The default logger will log this message to
   * the console, but only when the NODE_HTTP_CLIENT_LOG_LEVEL environment variable
   * is set to DEBUG.
   *
   * All arguments supplied to the method will be passed through to console.log.
   *
   * @param {Array<any>} theArguments Arguments to pass to console.log().
   */
  debug(...theArguments) {
    this[_consoleLog]("DEBUG", theArguments, ["DEBUG"]);
  }

  /**
   * Logs a message at the info level. The default logger will log this message to
   * the console, but only when the NODE_HTTP_CLIENT_LOG_LEVEL environment variable
   * is set to DEBUG or INFO.
   *
   * All arguments supplied to the method will be passed through to console.log.
   *
   * @param {Array<any>} theArguments Arguments to pass to console.log().
   */
  info(...theArguments) {
    this[_consoleLog]("INFO", theArguments, ["DEBUG", "INFO"]);
  }

  /**
   * Logs a message at the warn level. The default logger will log this message to
   * the console, but only when the NODE_HTTP_CLIENT_LOG_LEVEL environment variable
   * is set to DEBUG, INFO, or WARN.
   *
   * All arguments supplied to the method will be passed through to console.log.
   *
   * @param {Array<any>} theArguments Arguments to pass to console.log().
   */
  warn(...theArguments) {
    this[_consoleLog]("WARN", theArguments, ["DEBUG", "INFO", "WARN"]);
  }

  /**
   * Logs a message at the error level. The default logger will log this message to
   * the console, but only when the NODE_HTTP_CLIENT_LOG_LEVEL environment variable
   * is set to DEBUG, INFO, WARN, or ERROR.
   *
   * All arguments supplied to the method will be passed through to console.log.
   *
   * @param {Array<any>} theArguments Arguments to pass to console.log().
   */
  error(...theArguments) {
    this[_consoleLog]("ERROR", theArguments, [
      "DEBUG",
      "INFO",
      "WARN",
      "ERROR",
    ]);
  }

  /**
   * Uses console.log() to write a message at the given level.
   *
   * @param {string} level Log level to include in the message.
   * @param {Array} theArguments All arguments that should be included in the call
   *  to console.log().
   * @param {Array} outputLevels Will only log the message if the log level is set
   *  to one of the values in this array.
   */
  [_consoleLog](level, theArguments, outputLevels) {
    if (outputLevels.includes(LEVEL)) {
      console.log.apply(
        undefined,
        Logger.prependToMessage(
          `${new Date().toISOString()} ${level}: `,
          theArguments
        )
      );
    }
  }
}

module.exports = Logger;
