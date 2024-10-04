import { execSync } from 'node:child_process';
import { lstatSync, type Stats } from 'node:fs';
import { normalize } from 'node:path';
import moment from 'moment';
import type { Logger } from 'log4js';
//
import { Config } from './config';
import { ServerLogger } from './server-logger';
// import { Metrics } from './metrics';
//
import type { TorrentInfoI, FileOrDirsStateI } from '../types';

class Torrentclear {
  /**
   * Config instance object.
   */
  private readonly _config: Config;
  /**
   * Logger instance object.
   */
  private readonly _logger: Logger;
  /**
   * Metrics instance object.
   */
  // private readonly metric: Metrics;
  /**
   * Connect commant for transmission-remote.
   * Example: `transmission-remote 127.0.0.1:9091 -n login:password`
   */
  private readonly _connect: string;
  /**
   * transmission-remote result success.
   * Example: `127.0.0.1:9091/transmission/rpc/ responded: "success"`
   */
  private readonly regexSuccess: RegExp = /success/i;
  /**
   * Torrent information extracted.
   * * Name
   * * State
   * * Location
   * * Percent Done
   * * Ratio
   * * Date finished (need trim)
   */
  private readonly regexTorrentInfo: RegExp =
    /(?<=Name:\s)(.*?)(?=\s*Hash:)|(?<=State:\s)(.*?)(?=\s*Location:)|(?<=Location:\s)(.*?)(?=\s*Percent Done:)|(?<=Percent Done:\s)(.*?)%(?=\s*ETA:)|(?<=Ratio:\s)(.*?)(?=\s*Corrupt DL:)|(?<=Date finished:\s)(.*?)(?=\s*Date started:|$)/g;
  /**
   * ENUM for Check torrent is file or directory
   */
  private readonly fileOrDirsState: FileOrDirsStateI = { FILE: 1, DIR: 2, NOTFOUND: 3, UNKNOWN: 4 };
  /**
   * Torrent information object
   * Implement interface TorrentInfoI
   */
  private _torrentInfo: TorrentInfoI;
  /**
   * Counter for success torrent cleared
   */
  private _torrentSuccessCount = 0;
  /**
   * Counter for all target torrents
   */
  private _torrentProcessCount = 0;
  /**
   * Torrent matched IDs array from transmission torrent list command
   */
  private _torrentIDs: number[] = [];

  constructor(root_path?: string) {
    this._config = new Config(root_path);
    this._logger = new ServerLogger(root_path).logger;
    // this.metric = new Metrics(this.config, this._logger);
    this._connect = this.connectCommandCreate();
    this._torrentInfo = {
      id: 0,
      name: '',
      state: '',
      location: '',
      percent: 0,
      ratio: 0,
      dateDone: '',
      dateDifference: 0
    };
  }

  /**
   * Get command transmission connect
   * @returns {string} transmission connect command
   */
  get connect(): string {
    return this._connect;
  }

  /**
   * Get Config instance object
   * @returns {Config} nconf instance object
   */
  get config(): Config {
    return this._config;
  }

  /**
   * Get logger instance object
   * @returns {Logger} log4js logger instance object
   */
  get logger(): Logger {
    return this._logger;
  }

  get torrentInfo(): TorrentInfoI {
    return this._torrentInfo;
  }

  set torrentInfo(torrent_info: TorrentInfoI) {
    this._torrentInfo = torrent_info;
  }

  get torrentSuccessCount(): number {
    return this._torrentSuccessCount;
  }

  set torrentSuccessCount(count: number) {
    this._torrentSuccessCount = count;
  }

  get torrentProcessCount(): number {
    return this._torrentProcessCount;
  }

  set torrentProcessCount(count: number) {
    this._torrentProcessCount = count;
  }

  get torrentIDs(): number[] {
    return this._torrentIDs;
  }

  /**
   * Main function. Start program.
   */
  async main(): Promise<void> {
    try {
      this.startInfo();
      // get torrents ID from torrents list
      await this.getIDs();
      // check torrents
      await this.torrentsProcess();
      this.endInfo();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      this.logger.error(error.message);
      this.endInfo(true);
    }
  }

  /**
   * Terminating delimiter output
   */
  private startInfo(): void {
    this.logger.info('##############################################################################################');
    this.logger.info(`transmission-torrentclear: "${this.config.appVersion}"`);
    this.logger.info('==============================================================================================');
  }

  /**
   * Terminating delimiter output
   */
  private endInfo(error_flag = false): void {
    this.logger.info('==============================================================================================');
    if (error_flag) this.logger.error(`Failed to complete torrent verification process`);
    else this.logger.info(`Completing the torrent verification process`);
    // this.metric.save();
    this.logger.info(
      '##############################################################################################\n'
    );
  }

  /**
   * Get all torrents IDs from transmission-daemon
   * @set this `torrentIDs` - IDs array list
   */
  private async getIDs(): Promise<void> {
    try {
      // List all torrents
      const command = `${this.connect} --list`;
      this.logger.debug(`Run command: "${command}"`);
      const execResult: string = await this.command(command);
      const resultTorrentsList: RegExpMatchArray | null = execResult.toString().match(/^\s+(\d+)\s.*?$/gim);
      if (resultTorrentsList === null || resultTorrentsList.length < 1) {
        this.logger.info(`Torrents not found`);
        return;
      }
      this.logger.debug(`Torrents list:`);
      for (const torrentLine of resultTorrentsList) {
        this.logger.debug(`torrent: "${torrentLine.trim()}"`);
        const match: RegExpMatchArray | null = torrentLine.trim().match(/^(\d+).+$/i);
        if (match !== null) {
          const id: string = match[1];
          this.logger.debug(`ID found: "${id}"`);
          this.torrentIDs.push(Number(id));
        }
      }
      if (this.torrentIDs.length > 0) this.logger.info(`IDs found: ${this.torrentIDs.join(', ')}`);
      this.torrentProcessCount = this.torrentIDs.length;
    } catch (error: unknown) {
      this.logger.trace(error);
      throw error;
    }
  }

  /**
   * Checking torrents. If the deletion conditions match, then the torrent is deleted
   */
  private async torrentsProcess(): Promise<void> {
    try {
      // If torrents > 0
      if (this.torrentIDs.length > 0) {
        // individual torrent process
        for (const id of this.torrentIDs) {
          this.logger.info(
            '=============================================================================================='
          );
          this.logger.info(`TORRENT ID: "${id}" START PROCESS ...`);
          // get torrent information
          await this.getTorrentInfo(id);
          // Only done torrents
          if (this.torrentInfo.percent === 100) {
            // If OK. Check Ratio
            const checkRatio: boolean = this.checkRatio(this.torrentInfo.ratio);
            if (checkRatio) {
              // ==> ACTION: Delete on Ratio
              this.logger.debug(`==> ACTION: Torrent delete on Ratio Limit`);
              await this.clearTorrent();
              this.torrentSuccessCount++;
              this.logger.info(
                `Stopping and deleting a torrent "${this.torrentInfo.name}" by ratio limit completed successfully`
              );
            } else {
              // Ratio < ratioLimit
              // Check Date Difference
              const checkDateDifference: boolean = this.checkDateDifference(this.torrentInfo.dateDifference);
              if (checkDateDifference) {
                // ==> ACTION: Delete on Date Difference
                this.logger.debug(`==> ACTION: Torrent delete on Date Difference`);
                await this.clearTorrent();
                this.torrentSuccessCount++;
                this.logger.info(
                  `Stopping and deleting a torrent "${this.torrentInfo.name}" by datetime limit completed successfully`
                );
              } else {
                // NO ACTION
                this.logger.info(`NO ACTION NEEDED (DATE AND RATIO)`);
              }
            }
          } else {
            // NO ACTION
            this.logger.info(`NO ACTION NEEDED (< 100)`);
          }
        }
      }
    } catch (error: unknown) {
      this.logger.trace(error);
      throw error;
    }
  }

  /**
   * Check torrent is a File or a Directory.
   * If is a File check extensions (mkv, avi, mp4 defaults)
   */
  private async clearTorrent(): Promise<void> {
    try {
      const torrentPath: string = normalize(`${this.torrentInfo.location}/${this.torrentInfo.name}`);
      this.logger.debug(`normalized torrentPath: "${torrentPath}"`);
      const fileOrDir: number = await this.isFileOrDirectoryOrUnknown(torrentPath);
      if (fileOrDir === this.fileOrDirsState.FILE) {
        // Is File
        this.logger.info(`Torrent: "${this.torrentInfo.name}" is a FILE`);
        await this.torrentStop();
        await this.torrentRemove();
      } else if (fileOrDir === this.fileOrDirsState.DIR) {
        // Is Directory
        this.logger.info(`Torrent: "${this.torrentInfo.name}" is a DIRECTORY`);
        // If Directory: Remove torrent and delete folder with files inside
        await this.torrentStop();
        await this.torrentRemoveAndDelete();
      } else if (fileOrDir === this.fileOrDirsState.NOTFOUND) {
        // File not Found into target directory
        this.logger.warn(`Torrent: "${this.torrentInfo.name}" FILE NOT FOUND`);
        // Only remove torrent
        await this.torrentStop();
        await this.torrentRemove();
      } else {
        // Unknown type: no next action
        this.logger.debug(`Torrent: "${this.torrentInfo.name}" is neither a file or a directory`);
      }
    } catch (error: unknown) {
      this.logger.trace(error);
      throw error;
    }
  }

  /**
   * Stop torrent command execution.
   */
  private async torrentStop(): Promise<void> {
    try {
      const command = `${this.connect} --torrent ${this.torrentInfo.id} --stop`;
      this.logger.debug(`Stop torrent: (${this.torrentInfo.id}) "${this.torrentInfo.name}"`);
      this.logger.debug(`Run command: "${command}"`);
      let execResultStop: string = await this.command(command);
      execResultStop = execResultStop.replace(/(\r\n|\n|\r)/gm, '');
      this.logger.debug(`execResultStop: ${execResultStop}`);
      if (!this.regexSuccess.test(execResultStop)) {
        throw new Error(
          `Failed to stop torrent (${this.torrentInfo.id}) "${this.torrentInfo.name}". Reason: Negative result of exec command: ${execResultStop}`
        );
      }
    } catch (error: unknown) {
      this.logger.trace(error);
      throw error;
    }
  }

  /**
   * Remove torrent command execution.
   * DOES NOT DELETE FILES (removes only from the transmission)
   */
  private async torrentRemove(): Promise<void> {
    try {
      const command = `${this.connect} --torrent ${this.torrentInfo.id} --remove`;
      this.logger.debug(`Remove torrent without deleting file: (${this.torrentInfo.id}) "${this.torrentInfo.name}"`);
      this.logger.debug(`Run command: "${command}"`);
      let execResult: string = await this.command(command);
      execResult = execResult.replace(/(\r\n|\n|\r)/gm, '');
      this.logger.debug(`execResultRemove: ${execResult}`);
      if (!this.regexSuccess.test(execResult)) {
        throw new Error(
          `Failed to remove (no del) torrent (${this.torrentInfo.id}) "${this.torrentInfo.name}". Reason: Negative result of exec command: ${execResult}`
        );
      }
    } catch (error: unknown) {
      this.logger.trace(error);
      throw error;
    }
  }

  /**
   * Remove torrent command execution.
   * DELETES INCLUDING ALL TORRENT FILES
   */
  private async torrentRemoveAndDelete(): Promise<void> {
    try {
      const command = `${this.connect} --torrent ${this.torrentInfo.id} --remove-and-delete`;
      this.logger.debug(`Remove torrent with deleting file: (${this.torrentInfo.id}) "${this.torrentInfo.name}"`);
      this.logger.debug(`Run command: "${command}"`);
      let execResult: string = await this.command(command);
      execResult = execResult.replace(/(\r\n|\n|\r)/gm, '');
      this.logger.debug(`execResultRemoveAndDelete: ${execResult}`);
      if (!this.regexSuccess.test(execResult)) {
        throw new Error(
          `Failed to remove and delete torrent (${this.torrentInfo.id}) "${this.torrentInfo.name}". Reason: Negative result of exec command: ${execResult}`
        );
      }
    } catch (error: unknown) {
      this.logger.trace(error);
      throw error;
    }
  }

  /**
   * Check ratio torrent.
   * Config ratio obtained from the transmission configuration file `settings.json`
   * @param {number} ratio - Torrent Ratio
   * @returns {boolean} (`true` or `false`) torrent ratio equal or greater
   */
  private checkRatio(ratio: number): boolean {
    if (ratio >= this.config.ratioLimit) {
      this.logger.info(`Torrent has reached the Ratio limit: "${ratio}" >= "${this.config.ratioLimit}"`);
      return true;
    }
    return false;
  }

  /**
   * Check torrent date difference.
   * The date difference limit is set in the configuration file of this application
   * @param {number} date_difference - Torrent difference date (now date - torrent end date)
   * @returns {boolean} (`true` or `false`) torrent date equal or greater
   */
  private checkDateDifference(date_difference: number): boolean {
    if (date_difference >= this.config.limitTime) {
      this.logger.info(
        `Torrent has reached the Date difference limit: "${date_difference}" >= "${this.config.limitTime}"`
      );
      return true;
    }
    return false;
  }

  /**
   * Getting the necessary information about the torrent with a separate command.
   * @param {number} id - Torrent ID
   * @set this `_torrentInfo` - Torrent info object
   */
  private async getTorrentInfo(id: number): Promise<void> {
    try {
      const command = `${this.connect} --torrent ${id} --info`;
      this.logger.debug(`Run command: "${command}"`);
      const execResult: string = await this.command(command);
      const matchAll: IterableIterator<RegExpMatchArray> = execResult.toString().matchAll(this.regexTorrentInfo);
      const matchArray: RegExpMatchArray[] = Array.from(matchAll);
      if (matchArray.length < 1) throw new Error(`Torrent info data is EMPTY`);
      const torrentName: string = matchArray[0][1];
      if (torrentName === undefined || torrentName === '')
        throw new Error(`Torrent name not found in torrent info: "${id}"`);
      const torrentState: string = matchArray[1][2];
      if (torrentState === undefined || torrentState === '')
        throw new Error(`Torrent state not found in torrent info: "${id}"`);
      const torrentLocation: string = matchArray[2][3];
      if (torrentLocation === undefined || torrentLocation === '')
        throw new Error(`Torrent location not found in torrent info: "${id}"`);
      const torrentPercent: string = matchArray[3][4];
      if (torrentPercent === undefined || torrentPercent === '')
        throw new Error(`Torrent percent not found in torrent info: "${id}"`);
      const torrentRatio: string = matchArray[4][5];
      if (torrentRatio === undefined || torrentRatio === '')
        throw new Error(`Torrent ratio not found in torrent info: "${id}"`);
      const torrentDateFinished: string = matchArray[5][6];
      if (torrentDateFinished === undefined || torrentDateFinished === '')
        throw new Error(`Torrent date done not found in torrent info: "${id}"`);
      const nowDate: number = Date.now(); // ms
      const parsedFinishDate: number = Date.parse(torrentDateFinished.trim()); // ms
      this.torrentInfo = {
        id: Number(id),
        name: torrentName.trim(),
        state: torrentState.trim(),
        location: torrentLocation.trim(),
        percent: Number(torrentPercent.trim()),
        ratio: Number(torrentRatio.trim()),
        dateDone: this.dateFormat(parsedFinishDate),
        dateDifference: Math.round((nowDate - parsedFinishDate) / 1000) // ms => sec
      };
      this.logger.debug(`Torrent ID "${this.torrentInfo.id}" info:`);
      this.logger.debug(`   Name: "${this.torrentInfo.name}"`);
      this.logger.debug(`   State: "${this.torrentInfo.state}"`);
      this.logger.debug(`   Location: "${this.torrentInfo.location}"`);
      this.logger.debug(`   Percent Done: "${this.torrentInfo.percent}%"`);
      this.logger.debug(`   Ratio: "${this.torrentInfo.ratio}" | limit: "${this.config.ratioLimit}"`);
      this.logger.debug(`   Date finished: "${this.torrentInfo.dateDone}"`);
      this.logger.debug(`   Date Difference: "${this.torrentInfo.dateDifference}" | limit: "${this.config.limitTime}"`);
    } catch (error: unknown) {
      this.logger.trace(error);
      throw error;
    }
  }

  /**
   * Basic constructor for creating a command to connect to a transmission-remote.
   * Example: `transmission-remote 127.0.0.1:9091 -n login:password`
   * @returns {string} connect command
   */
  private connectCommandCreate(): string {
    return `transmission-remote ${this.config.ipAddress}:${this.config.port} --auth ${this.config.login}:*****`;
  }

  /**
   * Format timestamp to a human date format.
   * * Formatted string accepted by the [moment](https://momentjs.com/docs/#/use-it/) module
   * @param {number} timestamp Unix timestamp in milliseconds
   * @returns {string} Formatted date string (Example: DD.MM.YYYY_HH:mm:ss => 27.04.2024_22:26:21)
   */
  private dateFormat(timestamp: number): string {
    const date: Date = new Date(timestamp);
    const formattedDate: string = moment(date).format(this.config.dateFormat);
    return formattedDate;
  }

  /**
   * Execution connect command to a transmission-remote.
   * @param {string} command - Command to a connect
   * @returns {string} Execution result
   */
  private async command(command: string): Promise<string> {
    try {
      return execSync(command, { timeout: 2000, encoding: 'utf8' });
    } catch (error) {
      this.logger.trace(error);
      throw error;
    }
  }

  /**
   * Check torrent is file or directory
   * @param {string} path - torrent path
   * @returns {number} `FILE: 1` torrent is File, `DIR: 2` torrent is Directory, `NOTFOUND: 3`, `UNKNOWN: 4` - not File, not Directory
   */
  private async isFileOrDirectoryOrUnknown(path: string): Promise<number> {
    try {
      const stat: Stats = lstatSync(path);
      const isFile: boolean = stat.isFile();
      const isDirectory: boolean = stat.isDirectory();
      if (isFile) return this.fileOrDirsState.FILE;
      if (isDirectory) return this.fileOrDirsState.DIR;
      return this.fileOrDirsState.UNKNOWN;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // For Error "ENOENT: no such file or directory, lstat ..."
      if (error.code === 'ENOENT') return this.fileOrDirsState.NOTFOUND;
      this.logger.trace(error);
      throw error;
    }
  }
}

export { Torrentclear };
