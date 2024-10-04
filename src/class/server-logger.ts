import * as log4js from 'log4js';
import type { Logger } from 'log4js';
//
import { Config } from './config';
import type { ServerLoggerConfiguration } from '../types';

/**
 * Logger class
 */
class ServerLogger {
  /**
   * Log4js module
   */
  private readonly log4js: typeof log4js;
  /**
   * Config instance object
   */
  private readonly _config: Config;
  /**
   * Logger object
   */
  private readonly _logger: Logger;

  constructor(root_path?: string) {
    this.log4js = log4js;
    this._config = new Config(root_path);
    this.init();
    this._logger = this.log4js.getLogger();
  }

  /**
   * Get Logger
   */
  get logger(): Logger {
    return this._logger;
  }

  /**
   * Get Config
   */
  get config(): Config {
    return this._config;
  }

  /**
   * Init ServerLogger object
   */
  private init(): void {
    const configServerLogger: ServerLoggerConfiguration = {
      appenders: {
        console: {
          type: 'console',
          layout: {
            type: 'pattern',
            pattern: `[%d{${this.config.logDateFormat}}] : %[[%p]%] : %m`
          }
        },
        logFile: {
          type: 'file',
          filename: this.config.logFilePath,
          maxLogSize: '10M',
          compress: true,
          layout: {
            type: 'pattern',
            pattern: `[%d{${this.config.logDateFormat}}] : [%p] : %m`
          }
        }
      },
      categories: {
        default: {
          appenders: this.config.devmode ? ['console'] : ['console', 'logFile'],
          level: this.config.logLevel,
          enableCallStack: this.config.devmode ? true : false
        }
      }
    };
    this.log4js.configure(configServerLogger);
  }
}

export { ServerLogger };
