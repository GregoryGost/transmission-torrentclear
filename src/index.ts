#!/usr/bin/node

import { Config } from './class/Config.js';
import { Logger } from './class/Logger.js';
import { Torrentclear } from './class/Torrentclear.js';

const config: Config = new Config();
const logger: Logger = new Logger(config.logLevel, config.logFilePath, config.dateFormat);
const torrentclear: Torrentclear = new Torrentclear(config, logger);

async function run(): Promise<void> {
  await torrentclear.main();
}

run();
