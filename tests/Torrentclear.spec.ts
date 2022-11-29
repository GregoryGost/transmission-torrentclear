import { cwd } from 'node:process';
import { normalize } from 'node:path';
import { Config } from '../src/class/Config';
import { Logger } from '../src/class/Logger';
import { Torrentclear } from '../src/class/Torrentclear';

const configFile: string = normalize(`${cwd()}/config.json`);
const config: Config = new Config(configFile);
const logger: Logger = new Logger(config.logLevel, config.logFilePath);

test('Torrentclear class instance and init params', () => {
  const torrentclear: Torrentclear = new Torrentclear(config, logger);
  expect(torrentclear).toBeInstanceOf(Torrentclear);
});

test('Torrentclear torrents process', async () => {
  const torrentclear: Torrentclear = new Torrentclear(config, logger);
  expect(torrentclear).toBeInstanceOf(Torrentclear);
  torrentclear.clearProcess();
});
