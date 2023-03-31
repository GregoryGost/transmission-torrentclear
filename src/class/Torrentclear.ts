import { execSync } from 'node:child_process';
import { lstatSync, Stats } from 'node:fs';
import { normalize, extname } from 'node:path';
import { format } from 'fecha';
import { Config } from './Config.js';
import { Logger } from './Logger.js';

interface TorrentInfoI {
  /**
   * Example: `999`
   */
  id: number;
  /**
   * Example: `Warrior.Nun.S02E03.1080p.rus.LostFilm.TV.mkv`
   */
  name: string;
  /**
   * Variants: [ `Idle` | `Seeding` | `Finished` ]
   */
  state: string;
  /**
   * Example: `/mnt/data/download`
   */
  location: string;
  /**
   * Example: `100`
   */
  percent: number;
  /**
   * Example: `1.2`
   */
  ratio: number;
  /**
   * Example: `Tue Nov 22 23:58:52 2022`
   */
  dateDone: string;
  /**
   * Date difference. Now date - torrent date.
   * Example: `123456` (seconds)
   */
  dateDifference: number;
}

class Torrentclear {
  /**
   * Config instance object.
   */
  private readonly config: Config;
  /**
   * Logger instance object.
   */
  private readonly logger: Logger;
  /**
   * Connect commant for transmission-remote.
   * Example: transmission-remote 127.0.0.1:9091 -n login:password
   */
  private readonly connect: string;
  /**
   * transmission-remote result success.
   * Example: 127.0.0.1:9091/transmission/rpc/ responded: "success"
   */
  private readonly regexSuccess = /success/i;
  /**
   * Torrent information object
   * Implement interface TorrentInfoI
   */
  private torrentInfo: TorrentInfoI;
  /**
   * ENUM for Check torrent is file or directory
   */
  private fileOrDirsState = { FILE: 1, DIR: 2, NOTFOUND: 3, UNKNOWN: 4 };

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.connect = this.connectCommandCreate();
    this.torrentInfo = {
      id: 0,
      name: '',
      state: '',
      location: '',
      percent: 0,
      ratio: 0,
      dateDone: '',
      dateDifference: 0,
    };
  }

  /**
   * Main function. Start program.
   */
  public async main(): Promise<void> {
    try {
      this.startInfo();
      await this.clearProcess();
      this.endInfo();
    } catch (error) {
      this.logger.debug(`Error code: ${error.code}`);
      this.logger.debug(`Error message: ${error.message}`);
      if (this.config.devmode) this.logger.trace(error.message, error.stack);
      else this.logger.error(error.message);
      this.endInfo(true);
    }
  }

  /**
   * Base function. Start clear process for torrents.
   * It is possible to run single tests without cron jobs.
   */
  public async clearProcess(): Promise<void> {
    try {
      const ids: string[] = await this.getIDs();
      await this.checkTorrents(ids);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Terminating delimiter output
   */
  private startInfo(): void {
    this.logger.info('##############################################################################################');
    this.logger.info(`transmission-torrentclear "${this.config.appVersion}"`);
    this.logger.info('==============================================================================================');
  }

  /**
   * Terminating delimiter output
   */
  private endInfo(error_flag = false): void {
    this.logger.info('==============================================================================================');
    if (error_flag) this.logger.error(`Failed to complete torrent verification process`);
    else this.logger.info(`Completing the torrent verification process`);
    this.logger.info(
      '##############################################################################################\n'
    );
  }

  /**
   * Get all torrents id from transmission.
   * @returns `ids` IDs array list
   */
  private async getIDs(): Promise<string[]> {
    try {
      // List all torrents
      const command = `${this.connect} --list`;
      this.logger.debug(`Run command: "${command}"`);
      const execResult: string = await Torrentclear.command(command);
      const resultArray = execResult.toString().split(/\r\n|\r|\n/gm);
      resultArray.shift(); // Remove header (ID;Done;Have;ETA;Up;Down;Ratio;Status;Name)
      resultArray.pop(); // Remove Sum
      resultArray.pop(); // Remove last space
      const ids: string[] = [];
      this.logger.debug(`Torrent list:`);
      for (const str of resultArray) {
        this.logger.debug(`torrent: "${str}"`);
        const match = str.match(/^\s+(\d+).+$/i);
        if (match !== null) {
          const id: string = match[1];
          this.logger.debug(`ID found: "${id}"`);
          ids.push(id);
        }
      }
      if (ids.length > 0) this.logger.info(`IDs found: ${ids.join(', ')}`);
      else this.logger.info(`IDs not found`);
      return ids;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Checking torrents. If the deletion conditions match, then the torrent is deleted.
   * @param ids IDs array list
   */
  private async checkTorrents(ids: string[]): Promise<void> {
    try {
      if (ids.length > 0) {
        for (const id of ids) {
          this.logger.info(
            '=============================================================================================='
          );
          this.logger.info(`TORRENT ID: "${id}" START PROCESS ...`);
          await this.getTorrentInfo(id);
          // Only done torrents
          if (this.torrentInfo.percent === 100) {
            // Check Ratio
            const checkRatio: boolean = this.checkRatio(this.torrentInfo.ratio);
            if (checkRatio) {
              // ==> ACTION: Delete on Ratio
              this.logger.debug(`==> ACTION: Torrent delete on Ratio Limit`);
              await this.delete();
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
                await this.delete();
                this.logger.debug(
                  `Stopping and deleting a torrent "${this.torrentInfo.name}" by datetime limit completed successfully`
                );
              } else {
                // NO ACTION
                this.logger.info(`NO ACTION NEEDED`);
              }
            }
          } else {
            // NO ACTION
            this.logger.info(`NO ACTION NEEDED`);
          }
        }
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Stop and Remove torrent (but before checkFileorDirectory check)
   */
  private async delete(): Promise<void> {
    // STOP and REMOVE torrent from Transmission
    try {
      await this.torrentStop();
      // Check torrent is File or Directory
      await this.checkFileOrDirectory();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check torrent is a File or a Directory.
   * If is a File check extensions (mkv, avi, mp4 defaults)
   */
  private async checkFileOrDirectory(): Promise<void> {
    try {
      const torrentPath: string = normalize(`${this.torrentInfo.location}/${this.torrentInfo.name}`);
      this.logger.debug(`normalized torrentPath: "${torrentPath}"`);
      const fileOrDir: number = await this.isFileOrDirectoryOrUnknown(torrentPath);
      if (fileOrDir === this.fileOrDirsState.FILE) {
        // Is File
        const fileExtension: string = extname(torrentPath);
        this.logger.info(`Torrent: "${this.torrentInfo.name}" is a FILE`);
        this.logger.debug(`Torrent: file extension: "${fileExtension}"`);
        // Only Media Files | mkv, avi, mp4 etc.
        if (this.config.allowedMediaExtensions.test(fileExtension)) {
          // If File: Remove torrent and not delete file
          await this.torrentRemove();
        } else {
          this.logger.debug(
            `Torrent: file extension "${fileExtension}" does not match allowed extensions regex: "${this.config.allowedMediaExtensions}"`
          );
          this.logger.info(`Torrent does not match allowed extensions. NO ACTION`);
        }
      } else if (fileOrDir === this.fileOrDirsState.DIR) {
        // Is Directory
        this.logger.info(`Torrent: "${this.torrentInfo.name}" is a DIRECTORY`);
        this.logger.debug(`Torrent: full path: "${torrentPath}"`);
        // If Directory: Remove torrent and delete folder with files inside
        await this.torrentRemoveAndDelete();
      } else if (fileOrDir === this.fileOrDirsState.NOTFOUND) {
        // File not Found into target directory
        this.logger.warn(`Torrent: "${this.torrentInfo.name}" FILE NOT FOUND`);
        // Only remove torrent
        await this.torrentRemove();
      } else {
        // Unknown type: no next action
        this.logger.debug(`Torrent: "${this.torrentInfo.name}" is neither a file or a directory`);
        this.logger.debug(`Torrent: full path: "${torrentPath}"`);
      }
    } catch (error) {
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
      let execResultStop: string = await Torrentclear.command(command);
      execResultStop = execResultStop.replace(/(\r\n|\n|\r)/gm, '');
      this.logger.debug(`execResultStop: ${execResultStop}`);
      if (!this.regexSuccess.test(execResultStop)) {
        throw new Error(
          `Failed to stop torrent (${this.torrentInfo.id}) "${this.torrentInfo.name}". Reason: Negative result of exec command: ${execResultStop}`
        );
      }
    } catch (error) {
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
      let execResult: string = await Torrentclear.command(command);
      execResult = execResult.replace(/(\r\n|\n|\r)/gm, '');
      this.logger.debug(`execResult: ${execResult}`);
      if (!this.regexSuccess.test(execResult)) {
        throw new Error(
          `Failed to remove (no del) torrent (${this.torrentInfo.id}) "${this.torrentInfo.name}". Reason: Negative result of exec command: ${execResult}`
        );
      }
    } catch (error) {
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
      let execResult: string = await Torrentclear.command(command);
      execResult = execResult.replace(/(\r\n|\n|\r)/gm, '');
      this.logger.debug(`execResult: ${execResult}`);
      if (!this.regexSuccess.test(execResult)) {
        throw new Error(
          `Failed to remove and delete torrent (${this.torrentInfo.id}) "${this.torrentInfo.name}". Reason: Negative result of exec command: ${execResult}`
        );
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check ratio torrent.
   * Config ratio obtained from the transmission configuration file `settings.json`
   * @param ratio - Torrent Ratio
   * @returns (`true` or `false`) torrent ratio equal or greater
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
   * @param date_difference - Torrent difference date (now date - torrent end date)
   * @returns (`true` or `false`) torrent date equal or greater
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
   * @param id - Torrent ID
   * @returns `object<TorrentInfoI>` - Torrent info object
   */
  private async getTorrentInfo(id: string): Promise<void> {
    try {
      const command = `${this.connect} --torrent ${id} --info`;
      this.logger.debug(`Run command: "${command}"`);
      const execResult: string = await Torrentclear.command(command);
      const matchAll = execResult
        .toString()
        .matchAll(
          /Name\:\s(.+)|Date\sfinished\:\s+(.+)|Percent\sDone\:\s(.+)\%|Ratio\:\s(.+)|State\:\s(.+)|Location\:\s(.+)/g
        );
      const match: RegExpMatchArray[] = Array.from(matchAll);
      const torrentName: string = match[0][1];
      if (torrentName === undefined) throw new Error(`Torrent name not found in torrent info: "${id}"`);
      const state: string = match[1][5];
      if (state === undefined) throw new Error(`Torrent state not found in torrent info: "${id}"`);
      const location: string = match[2][6];
      if (location === undefined) throw new Error(`Torrent location not found in torrent info: "${id}"`);
      const percent: string = match[3][3];
      if (percent === undefined) throw new Error(`Torrent percent not found in torrent info: "${id}"`);
      const ratio: string = match[4][4];
      if (ratio === undefined) throw new Error(`Torrent ratio not found in torrent info: "${id}"`);
      const dateDone: string = match[5][2];
      if (dateDone === undefined) throw new Error(`Torrent date done not found in torrent info: "${id}"`);
      const nowDate: number = Date.now(); // ms
      this.torrentInfo = {
        id: Number(id),
        name: torrentName,
        state: state,
        location: location,
        percent: Number(percent),
        ratio: Number(ratio),
        dateDone: this.dateFormat(Date.parse(dateDone)),
        dateDifference: Math.round((nowDate - Date.parse(dateDone)) / 1000),
      };
      this.logger.debug(`Torrent ID "${this.torrentInfo.id}" info:`);
      this.logger.debug(`   Name: "${this.torrentInfo.name}"`);
      this.logger.debug(`   State: "${this.torrentInfo.state}"`);
      this.logger.debug(`   Location: "${this.torrentInfo.location}"`);
      this.logger.debug(`   Percent Done: "${this.torrentInfo.percent}%"`);
      this.logger.debug(`   Ratio: "${this.torrentInfo.ratio}" | limit: "${this.config.ratioLimit}"`);
      this.logger.debug(`   Date finished: "${this.torrentInfo.dateDone}"`);
      this.logger.debug(`   Date Difference: "${this.torrentInfo.dateDifference}" | limit: "${this.config.limitTime}"`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Basic constructor for creating a command to connect to a transmission-remote.
   * Example: `transmission-remote 127.0.0.1:9091 -n login:password`
   * @returns connect command
   */
  private connectCommandCreate(): string {
    return `transmission-remote ${this.config.ipAddress}:${this.config.port} --auth ${this.config.login}:${this.config.password}`;
  }

  /**
   * Format timestamp to a human date format.
   * Formatted string accepted by the [fecha](https://github.com/taylorhakes/fecha) module
   * @param {number} timestamp Unix timestamp
   * @returns {string} Formatted date string (Example: DD.MM.YYYY HH:mm:ss => 03.12.2022 22:44:15)
   */
  private dateFormat(timestamp: number): string {
    const date: Date = new Date(timestamp);
    const formattedDate: string = format(date, this.config.dateFormat);
    return formattedDate;
  }

  /**
   * [Static]
   * Execution connect command to a transmission-remote.
   * @param command - Command to a connect
   * @returns Execution result
   */
  private static async command(command: string): Promise<string> {
    try {
      return execSync(command, { timeout: 2000, encoding: 'utf8' });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check torrent is file or directory
   * @param path - torrent path
   * @returns (boolean | undefined) - true: torrent is File, false: torrent is Directory / undefined - not File, not Directory
   */
  private async isFileOrDirectoryOrUnknown(path: string): Promise<number> {
    try {
      const stat: Stats = lstatSync(path);
      const isFile: boolean = stat.isFile();
      const isDirectory: boolean = stat.isDirectory();
      if (isFile) return this.fileOrDirsState.FILE;
      if (isDirectory) return this.fileOrDirsState.DIR;
      return this.fileOrDirsState.UNKNOWN;
    } catch (error) {
      // For Error "ENOENT: no such file or directory, lstat ..."
      if (error.code === 'ENOENT') return this.fileOrDirsState.NOTFOUND;
      throw error;
    }
  }
}

export { Torrentclear };
