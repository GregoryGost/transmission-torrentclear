import { cwd } from 'node:process';
import { normalize } from 'node:path';
import { jest } from '@jest/globals';
import { Config } from '../src/class/Config';
import { Logger } from '../src/class/Logger';
import { Torrentclear } from '../src/class/Torrentclear';

jest.mock('node:child_process', () => {
  return {
    execSync: (command: string, options: any) => {
      console.log('command:', command);
      if (command === 'transmission-remote 127.0.0.1:9091 -n narakot:247050689Hh -l') {
        const result = `ID     Done       Have  ETA           Up    Down  Ratio  Status       Name
  35   100%   22.11 GB  12 days      0.0     0.0    0.0  Seeding      Шерлок Холмс S01 Serial WEB-DL (1080p)
  37    66%    1.97 GB  1 min       15.0  18007.0    0.0  Up & Down    The.Expanse.S05E01.1080p.rus.LostFilm.TV.mkv
Sum:          24.08 GB              15.0  18007.0`;
        return result;
      }
      return 'no action';
    },
  };
});

const configFile: string = normalize(`${cwd()}/config.json`);
const config: Config = new Config(configFile);
const logger: Logger = new Logger(config.logLevel, config.logFilePath, config.dateFormat);

test('Torrentclear class instance and init params', () => {
  const torrentclear: Torrentclear = new Torrentclear(config, logger);
  expect(torrentclear).toBeInstanceOf(Torrentclear);
});

test('Torrentclear torrents process', async () => {
  const torrentclear: Torrentclear = new Torrentclear(config, logger);
  expect(torrentclear).toBeInstanceOf(Torrentclear);

  torrentclear.main();
});
