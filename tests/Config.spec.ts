import { cwd } from 'node:process';
import { normalize } from 'node:path';
import { Config } from '../src/class/Config';

const testConfigFileProd: string = normalize(`${cwd()}/tests/config_production.json`);
const testConfigFileDev: string = normalize(`${cwd()}/tests/config_development.json`);
const settingsFile: string = normalize(`${cwd()}/tests/settings.json`);

test('Config class instance and init params', () => {
  // Login or password not found
  try {
    new Config();
  } catch (error) {
    expect(error.message).toEqual('Login or password must be filled in config file or Environment');
  }
  // PROD test
  const configProd: Config = new Config(testConfigFileProd);
  expect(configProd).toBeInstanceOf(Config);
  expect(configProd.devmode).toEqual(false);
  expect(configProd.login).toEqual('test_prod');
  expect(configProd.password).toEqual('1234567890123456789');
  expect(configProd.logLevel).toEqual('info');
  expect(configProd.logDateFormat).toEqual('DD.MM.YYYY HH:mm:ss');
  expect(configProd.logFilePath).toEqual('/var/log/transmission/torrentclear.log');
  expect(configProd.ipAddress).toEqual('127.0.0.1');
  expect(configProd.port).toEqual(9091);
  expect(configProd.limitTime).toEqual(604800);
  expect(configProd.settingsFilePath).toEqual(settingsFile);
  expect(configProd.ratioEnabled).toEqual(true);
  expect(configProd.ratioLimit).toEqual(2.5);
  expect(configProd.cronExpression).toEqual('0 * * * *');
  // DEV test
  const configDev: Config = new Config(testConfigFileDev);
  expect(configDev).toBeInstanceOf(Config);
  expect(configDev.devmode).toEqual(true);
  expect(configDev.login).toEqual('test_dev');
  expect(configDev.password).toEqual('1234567890123456789');
  expect(configDev.logLevel).toEqual('trace');
  expect(configDev.logDateFormat).toEqual('DD.MM.YYYY');
  expect(configDev.logFilePath).toEqual('./torrentclear_test.log');
  expect(configDev.ipAddress).toEqual('192.168.88.22');
  expect(configDev.port).toEqual(9092);
  expect(configDev.limitTime).toEqual(100000);
  expect(configDev.settingsFilePath).toEqual(settingsFile);
  expect(configDev.ratioEnabled).toEqual(true);
  expect(configDev.ratioLimit).toEqual(2.5);
  expect(configDev.cronExpression).toEqual('0 1 * * *');
});
