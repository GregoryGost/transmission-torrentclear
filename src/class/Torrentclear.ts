import { execSync } from 'node:child_process';
import { lstatSync, Stats } from 'node:fs';
import { normalize, extname } from 'node:path';
import { schedule, ScheduledTask } from 'node-cron';
import cronParser from 'cron-parser';
import { format } from 'fecha';
import { Config } from './Config.js';
import { Logger } from './Logger.js';

interface TorrentInfoI {
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

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.connect = this.connectCommandCreate();
  }

  /**
   * Main function. Start program.
   */
  public main(): void {
    this.cronInit();
  }

  /**
   * Base function. Start clear process for torrents.
   * It is possible to run single tests without cron jobs.
   */
  public async clearProcess(): Promise<void> {
    try {
      const ids: string[] = this.getIDs();
      await this.checkTorrents(ids);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Init cron task. Start cron task.
   */
  private cronInit(): void {
    this.logger.info('##############################################################################################');
    this.logger.info(`NodeCron task "${this.config.cronExpression}" SETUP`);
    // Create cron task
    const task: ScheduledTask = schedule(
      this.config.cronExpression,
      async () => {
        try {
          await this.clearProcess();
          const interval: cronParser.CronExpression = cronParser.parseExpression(this.config.cronExpression);
          const nextTickDate: string = this.dateFormat(Date.parse(interval.next().toString()));
          this.logger.info(`NodeCron task "${this.config.cronExpression}" END. Next tick [${nextTickDate}]`);
          this.logger.info(
            '##############################################################################################\n'
          );
        } catch (error) {
          if (this.config.devmode) this.logger.trace(error.message, error.stack);
          else this.logger.error(error.message);
          this.logger.info(
            '##############################################################################################\n'
          );
        }
      },
      {
        scheduled: false,
        timezone: Torrentclear.getTimeZone(),
      }
    );
    const interval: cronParser.CronExpression = cronParser.parseExpression(this.config.cronExpression);
    const nextTickDate: string = this.dateFormat(Date.parse(interval.next().toString()));
    this.logger.info(`NodeCron task START at [${nextTickDate}]`);
    this.logger.info('##############################################################################################');
    task.start();
  }

  /**
   * Get all torrents id from transmission.
   * @returns `ids` IDs array list
   */
  private getIDs(): string[] {
    // List all torrents
    const command = `${this.connect} -l`;
    this.logger.debug(`Run command: "${command}"`);
    const execResult: string = Torrentclear.command(command);
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
  }

  /**
   * Checking torrents. If the deletion conditions match, then the torrent is deleted.
   * @param ids IDs array list
   */
  private async checkTorrents(ids: string[]): Promise<void> {
    try {
      if (ids.length > 0) {
        this.logger.info(
          '=============================================================================================='
        );
        for (const id of ids) {
          this.logger.info(`TORRENT ID: "${id}" START PROCESS ...`);
          const torrentInfo: TorrentInfoI = await this.getTorrentInfo(id);
          // Only done torrents
          if (torrentInfo.percent === 100) {
            // Check Ratio
            const checkRatio: boolean = this.checkRatio(torrentInfo.ratio);
            if (checkRatio) {
              // ==> ACTION: Delete on Ratio
              this.logger.debug(`==> ACTION: Torrent delete on Ratio Limit`);
              await this.delete(id, torrentInfo);
              this.logger.info(
                `Stopping and deleting a torrent "${torrentInfo.name}" by ratio limit completed successfully`
              );
            } else {
              // Ratio < ratioLimit
              // Check Date Difference
              const checkDateDifference: boolean = this.checkDateDifference(torrentInfo.dateDifference);
              if (checkDateDifference) {
                // ==> ACTION: Delete on Date Difference
                this.logger.debug(`==> ACTION: Torrent delete on Date Difference`);
                await this.delete(id, torrentInfo);
                this.logger.debug(
                  `Stopping and deleting a torrent "${torrentInfo.name}" by datetime limit completed successfully`
                );
              } else {
                // NO ACTION
                this.logger.info(`NO ACTION NEEDED`);
                this.logger.info(
                  '=============================================================================================='
                );
              }
            }
          } else {
            // NO ACTION
            this.logger.info(`NO ACTION NEEDED`);
            this.logger.info(
              '=============================================================================================='
            );
          }
        }
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Stop and Remove torrent (but before checkFileorDirectory check)
   * @param id - Torrent ID
   * @param torrent_info - Torrent info data (interface TorrentInfoI)
   */
  private async delete(id: string, torrent_info: TorrentInfoI): Promise<void> {
    // STOP and REMOVE torrent from Transmission
    try {
      this.torrentStop(id, torrent_info.name);
      // Check torrent is File or Directory
      await this.checkFileOrDirectory(id, torrent_info);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check torrent is a File or a Directory.
   * If is a File check extensions (mkv, avi, mp4 defaults)
   * @param id - Torrent ID
   * @param torrent_info - Torrent info data (interface TorrentInfoI)
   */
  private async checkFileOrDirectory(id: string, torrent_info: TorrentInfoI): Promise<void> {
    try {
      const torrentPath: string = normalize(`${torrent_info.location}/${torrent_info.name}`);
      const fileOrDir: boolean | undefined = await Torrentclear.isFileOrDirectoryOrUnknown(torrentPath);
      if (fileOrDir === true) {
        // Is File
        const fileExtension: string = extname(torrentPath);
        this.logger.info(`Torrent: "${torrent_info.name}" is a FILE`);
        this.logger.debug(`Torrent: file extension: "${fileExtension}"`);
        // Only Media Files | mkv, avi, mp4 etc.
        if (this.config.allowedMediaExtensions.test(fileExtension)) {
          // If File: Remove torrent and not delete file
          await this.torrentRemove(id, torrent_info.name);
        } else {
          this.logger.debug(
            `Torrent: file extension "${fileExtension}" does not match allowed extensions regex: "${this.config.allowedMediaExtensions}"`
          );
          this.logger.info(`Torrent does not match allowed extensions. NO ACTION`);
        }
      } else if (fileOrDir === false) {
        // Is Directory
        this.logger.info(`Torrent: "${torrent_info.name}" is a DIRECTORY`);
        this.logger.debug(`Torrent: full path: "${torrentPath}"`);
        // If Directory: Remove torrent and delete folder with files inside
        await this.torrentRemoveAndDelete(id, torrent_info.name);
      } else {
        // Unknown type: no next action
        this.logger.debug(`Torrent: "${torrent_info.name}" is neither a file or a directory`);
        this.logger.debug(`Torrent: full path: "${torrentPath}"`);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Stop torrent command execution.
   * @param id - Torrent ID
   * @param name - Torrent name
   */
  private torrentStop(id: string, name: string): void {
    const command = `${this.connect} -t ${id} -S`;
    this.logger.debug(`Stop torrent: (${id}) "${name}"`);
    this.logger.debug(`Run command: "${command}"`);
    const execResultStop: string = Torrentclear.command(command).replace(/(\r\n|\n|\r)/gm, '');
    this.logger.debug(`execResultStop: ${execResultStop}`);
    if (!this.regexSuccess.test(execResultStop)) {
      throw new Error(
        `Failed to stop torrent (${id}) "${name}". Reason: Negative result of exec command: ${execResultStop}`
      );
    }
  }

  /**
   * Remove torrent command execution.
   * DOES NOT DELETE FILES (removes only from the transmission)
   * @param id - Torrent ID
   * @param name - Torrent name
   */
  private async torrentRemove(id: string, name: string): Promise<void> {
    try {
      const command = `${this.connect} -t ${id} -r`;
      this.logger.debug(`Remove torrent without deleting file: (${id}) "${name}"`);
      this.logger.debug(`Run command: "${command}"`);
      const execResult: string = Torrentclear.command(command).replace(/(\r\n|\n|\r)/gm, '');
      this.logger.debug(`execResult: ${execResult}`);
      if (!this.regexSuccess.test(execResult)) {
        throw new Error(
          `Failed to remove (no del) torrent (${id}) "${name}". Reason: Negative result of exec command: ${execResult}`
        );
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove torrent command execution.
   * DELETES INCLUDING ALL TORRENT FILES
   * @param id - Torrent ID
   * @param name - Torrent name
   */
  private async torrentRemoveAndDelete(id: string, name: string): Promise<void> {
    try {
      const command = `${this.connect} -t ${id} --remove-and-delete`;
      this.logger.debug(`Remove torrent with deleting file: (${id}) "${name}"`);
      this.logger.debug(`Run command: "${command}"`);
      const execResult: string = Torrentclear.command(command).replace(/(\r\n|\n|\r)/gm, '');
      this.logger.debug(`execResult: ${execResult}`);
      if (!this.regexSuccess.test(execResult)) {
        throw new Error(
          `Failed to remove and delete torrent (${id}) "${name}". Reason: Negative result of exec command: ${execResult}`
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
  private async getTorrentInfo(id: string): Promise<TorrentInfoI> {
    try {
      const command = `${this.connect} -t ${id} -i`;
      this.logger.debug(`Run command: "${command}"`);
      const execResult: string = Torrentclear.command(command);
      const matchAll = execResult
        .toString()
        .matchAll(
          /Name\:\s(.+)|Date\sfinished\:\s+(.+)|Percent\sDone\:\s(.+)\%|Ratio\:\s(.+)|State\:\s(.+)|Location\:\s(.+)/g
        );
      const match: RegExpMatchArray[] = Array.from(matchAll);
      const torrentName: string = match[0][1];
      if (torrentName === undefined) throw new Error(`Required data not found in torrent info - ID: "${id}"`);
      const dateDone: number = Date.parse(match[5][2]); // ms
      const nowDate: number = Date.now(); // ms
      const torrentInfo: TorrentInfoI = {
        name: torrentName,
        state: match[1][5],
        location: match[2][6],
        percent: Number(match[3][3]),
        ratio: Number(match[4][4]),
        dateDone: this.dateFormat(dateDone),
        dateDifference: Math.round((nowDate - dateDone) / 1000),
      };
      this.logger.debug(`Torrent ID "${id}" info:`);
      this.logger.debug(`   Name: "${torrentInfo.name}"`);
      this.logger.debug(`   State: "${torrentInfo.state}"`);
      this.logger.debug(`   Location: "${torrentInfo.location}"`);
      this.logger.debug(`   Percent Done: "${torrentInfo.percent}%"`);
      this.logger.debug(`   Ratio: "${torrentInfo.ratio}" | limit: "${this.config.ratioLimit}"`);
      this.logger.debug(`   Date finished: "${torrentInfo.dateDone}"`);
      this.logger.debug(`   Date Difference: "${torrentInfo.dateDifference}" | limit: "${this.config.limitTime}"`);
      return torrentInfo;
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
    return `transmission-remote ${this.config.ipAddress}:${this.config.port} -n ${this.config.login}:${this.config.password}`;
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
   * Get system timezone / Debian: dpkg-reconfigure tzdata
   * Example: Europe/Moscow
   * @returns `timezone`
   */
  private static getTimeZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  /**
   * [Static]
   * Execution connect command to a transmission-remote.
   * @param command - Command to a connect
   * @returns Execution result
   */
  private static command(command: string): string {
    return execSync(command, { timeout: 2000, encoding: 'utf8' });
  }

  /**
   * [Static]
   * Check torrent is file or directory
   * @param path - torrent path
   * @returns (boolean | undefined) - true: torrent is File, false: torrent is Directory / undefined - not File, not Directory
   */
  private static async isFileOrDirectoryOrUnknown(path: string): Promise<boolean | undefined> {
    try {
      const stat: Stats = lstatSync(path);
      const isFile: boolean = stat.isFile();
      const isDirectory: boolean = stat.isDirectory();
      if (isFile) return true;
      if (isDirectory) return false;
      return undefined;
    } catch (error) {
      throw error;
    }
  }
}

export { Torrentclear };
