import { execSync } from 'node:child_process';
import { lstatSync, Stats } from 'node:fs';
import { normalize, extname } from 'node:path';
import { schedule, ScheduledTask } from 'node-cron';
import cronParser from 'cron-parser';
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
   * Date difference. Now date - torrent date
   * Example: `123456` (seconds)
   */
  dateDifference: number;
}

class Torrentclear {
  /**
   * Config instance object
   */
  private readonly config: Config;
  /**
   * Logger instance object
   */
  private readonly logger: Logger;
  /**
   * Connect commant for transmission-remote
   * Example: transmission-remote 127.0.0.1:9091 -n login:password
   */
  private readonly connect: string;
  /**
   * transmission-remote result success
   * Example: 127.0.0.1:9091/transmission/rpc/ responded: "success"
   */
  private readonly regexSuccess = /success/i;

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.connect = this.connectCommandCreate();
  }

  public main(): void {
    this.cronInit();
  }

  // public async main(): Promise<void> {
  //   try {
  //     this.logger.info(
  //       '##############################################################################################'
  //     );
  //     await this.clearProcess();
  //     this.logger.info(
  //       '##############################################################################################\n'
  //     );
  //   } catch (error) {
  //     if (this.config.devmode) this.logger.trace(error.message, error.stack);
  //     else this.logger.error(error.message);
  //     this.logger.info(
  //       '##############################################################################################\n'
  //     );
  //   }
  // }

  // For single run test
  public async clearProcess(): Promise<void> {
    try {
      const ids: string[] = this.getIDs();
      await this.checkTorrents(ids);
    } catch (error) {
      throw error;
    }
  }

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
          const nextTickDate: string = Torrentclear.dateFormat(Date.parse(interval.next().toString()));
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
    const nextTickDate: string = Torrentclear.dateFormat(Date.parse(interval.next().toString()));
    this.logger.info(`NodeCron task START at [${nextTickDate}]`);
    this.logger.info('##############################################################################################');
    task.start();
  }

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

  private async delete(id: string, torrent_info: TorrentInfoI): Promise<void> {
    try {
      // STOP and REMOVE torrent from Transmission
      this.torrentStop(id, torrent_info.name);
      // Check torrent is File or Directory
      await this.checkFileOrDirectory(id, torrent_info);
    } catch (error) {
      throw error;
    }
  }

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

  private checkRatio(ratio: number): boolean {
    if (ratio >= this.config.ratioLimit) {
      this.logger.info(`Torrent has reached the Ratio limit: "${ratio}" >= "${this.config.ratioLimit}"`);
      return true;
    }
    return false;
  }

  private checkDateDifference(date_difference: number): boolean {
    if (date_difference >= this.config.limitTime) {
      this.logger.info(
        `Torrent has reached the Date difference limit: "${date_difference}" >= "${this.config.limitTime}"`
      );
      return true;
    }
    return false;
  }

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
        dateDone: Torrentclear.dateFormat(dateDone),
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

  private connectCommandCreate(): string {
    return `transmission-remote ${this.config.ipAddress}:${this.config.port} -n ${this.config.login}:${this.config.password}`;
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

  private static command(command: string): string {
    return execSync(command, { timeout: 2000, encoding: 'utf8' });
  }

  private static dateFormat(timestamp: number): string {
    const date: Date = new Date(timestamp);
    const day: number | string = date.getDate() > 9 ? date.getDate() : '0' + date.getDate();
    const mounthReal: number = date.getMonth() + 1;
    const mounth: number | string = mounthReal > 9 ? mounthReal : '0' + mounthReal;
    const year: number = date.getFullYear();
    const hours: number | string = date.getHours() > 9 ? date.getHours() : '0' + date.getHours();
    const minutes: number | string = date.getMinutes() > 9 ? date.getMinutes() : '0' + date.getMinutes();
    const seconds: number | string = date.getSeconds() > 9 ? date.getSeconds() : '0' + date.getSeconds();
    return `${day}.${mounth}.${year} ${hours}:${minutes}:${seconds}`;
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
