/**
 * Unit tests for src/class/config.ts
 */
import { cwd } from 'node:process';
import { normalize, join, resolve } from 'node:path';
//
import { Config } from '../src/class/config';

describe('config.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  /**
   * Instance test
   */
  it('config instance', () => {
    const testRootPath: string = normalize(join(cwd(), '__tests__', 'configs'));
    const config: Config = new Config(testRootPath);
    expect(config instanceof Config).toBe(true);
  });
  /**
   * Throw exceptions
   */
  it('config init error config file', () => {
    // no config file
    try {
      new Config();
    } catch (error) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(error).toHaveProperty(
        'message',
        `File not found on path "${normalize(join(cwd(), 'config.json'))}" or relative path "${resolve(normalize(join(cwd(), 'config.json')))}"`
      );
    }
  });
  it('config init error login', () => {
    const testRootPath: string = normalize(join(cwd(), '__tests__', 'configs', 'no_login'));
    try {
      new Config(testRootPath);
    } catch (error) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(error).toHaveProperty('message', 'Parameter "login" incorrect value "undefined" of type "undefined"');
    }
  });
  /**
   * Get all parameters test
   */
  it('get base parameters', () => {
    const testRootPath: string = normalize(join(cwd(), '__tests__', 'configs'));
    const config: Config = new Config(testRootPath);
    //
    expect(config.rootPath).toBe(testRootPath);
    expect(config.devmode).toBe(true);
    expect(config.appVersion).toBe('99.99.99');
    expect(config.logLevel).toBe('trace');
    expect(config.dateFormat).toBe('DD.MM.YYYY');
    expect(config.logDateFormat).toBe('dd.MM.yyyy');
    expect(config.logFilePath).toBe('./torrentclear_test.log');
    //
    expect(config.ipAddress).toBe('192.168.88.22');
    expect(config.port).toBe(9092);
    expect(config.login).toBe('test_dev');
    expect(config.password).toBe('1234567890123456789');
    expect(config.limitTime).toBe(100000);
    expect(config.settingsFilePath).toBe('./__tests__/settings.json');
  });
  it('get specific parameters if prod', () => {
    const testRootPath: string = normalize(join(cwd(), '__tests__', 'configs', 'ak_prod'));
    const config: Config = new Config(testRootPath);
    //
    expect(config.rootPath).toBe(testRootPath);
    expect(config.devmode).toBe(false);
    expect(config.appVersion).toBe('99.99.99');
    expect(config.logLevel).toBe('info');
    expect(config.dateFormat).toBe('DD.MM.YYYY_HH:mm:ss');
    expect(config.logDateFormat).toBe('dd.MM.yyyy_hh:mm:ss.SSS');
    expect(config.logFilePath).toBe('./torrentclear_prod.log');
    //
    expect(config.ipAddress).toBe('127.0.0.1');
    expect(config.port).toBe(9091);
    expect(config.login).toBe('test_prod');
    expect(config.password).toBe('1234567890123456789');
    expect(config.limitTime).toBe(604800);
    expect(config.settingsFilePath).toBe('./__tests__/settings.json');
  });
});
