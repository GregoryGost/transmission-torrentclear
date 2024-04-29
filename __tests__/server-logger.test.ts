/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unit tests for src/class/server-logger.ts
 */
import { cwd } from 'node:process';
import { normalize, join } from 'node:path';
import type { Level } from 'log4js';
//
import { ServerLogger } from '../src/class/server-logger';
import { Config } from '../src/class/config';

const devConfigPath: string = normalize(join(cwd(), '__tests__', 'configs'));
const prodConfigPath: string = normalize(join(cwd(), '__tests__', 'configs', 'ak_prod'));

// Mock logger
let logMock: jest.SpyInstance;

describe('server-logger.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  /**
   * Instance test
   */
  it('server-logger instance', async () => {
    const configSettingsFileExistsMock = jest.spyOn(Config.prototype as any, 'settingsFileExists').mockImplementation();
    //
    const serverLogger: ServerLogger = new ServerLogger(devConfigPath);
    expect(serverLogger instanceof ServerLogger).toBe(true);
    //
    configSettingsFileExistsMock.mockRestore();
  });
  it('server-logger instance - default path', async () => {
    // no config file
    try {
      new ServerLogger();
    } catch (error) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(error).toHaveProperty(
        'message',
        `Transmission settings file not found on path ${normalize('/etc/transmission-daemon/settings.json')}`
      );
    }
  });
  /**
   * Get config from server logger
   */
  it('get config and logger from ServerLogger', async () => {
    const configSettingsFileExistsMock = jest.spyOn(Config.prototype as any, 'settingsFileExists').mockImplementation();
    // get config
    const serverLogger: ServerLogger = new ServerLogger(devConfigPath);
    expect(serverLogger.config instanceof Config).toBe(true);
    expect(serverLogger.config.appVersion).toBe('99.99.99');
    // logger log
    logMock = jest
      .spyOn(serverLogger.logger, 'log')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    serverLogger.logger.log('hello world');
    expect(logMock).toHaveBeenNthCalledWith(1, 'hello world');
    //
    configSettingsFileExistsMock.mockRestore();
  });
  /**
   * Dev or Prod config logger
   */
  it('develop or prod config for logger', async () => {
    const configSettingsFileExistsMock = jest.spyOn(Config.prototype as any, 'settingsFileExists').mockImplementation();
    // develop
    // appenders, level, enableCallStack
    const serverLoggerDev: ServerLogger = new ServerLogger(devConfigPath);
    expect(serverLoggerDev.config.logFilePath).toBe('./torrentclear_test.log');
    //
    const serverLoggerProd: ServerLogger = new ServerLogger(prodConfigPath);
    expect(serverLoggerProd.config.logFilePath).toBe('/var/log/transmission/torrentclear.log');
    //
    configSettingsFileExistsMock.mockRestore();
  });
});
