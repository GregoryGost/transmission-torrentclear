import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, normalize, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import nconf from 'nconf';

/**
 * Config class
 * Basic configuration parameters
 */
class Config {
  /**
   * Nconf implements
   */
  private readonly nconf: typeof nconf = nconf;
  /**
   * Path to root application dir
   */
  private readonly _rootPath: string;
  /**
   * Development mode status
   * if development = true
   * Default: `development`
   */
  private readonly _devmode: boolean;
  /**
   * This Application version
   * Read from base file package.json
   */
  private readonly _appVersion: string;
  /**
   * Log level
   * if devmode(true) = trace
   * trace | debug | info | warn | error
   * Default: `info`
   */
  private readonly _logLevel: string;
  /**
   * Date and time format. Used in application.
   * Formatted string accepted by the [moment](https://www.npmjs.com/package/moment).
   * Default: `DD.MM.YYYY_HH:mm:ss`
   */
  private readonly _dateFormat: string;
  /**
   * Date and time format. Used in log4js.
   * Formatted string accepted by the [date-format](https://www.npmjs.com/package/date-format).
   * Default: `dd.MM.yyyy_hh:mm:ss.SSS`
   */
  private readonly _logDateFormat: string;
  //
  // TRANSMISSION SETTINGS
  //
  /**
   * Torrent done log file path
   * Default: `/var/log/transmission/torrentclear.log`
   */
  private readonly _logFilePath: string;
  /**
   * Transmission-daemon IP Address
   * Default: `127.0.0.1` (localhost)
   */
  private readonly _ipAddress: string;
  /**
   * Transmission-daemon TCP Port
   * Default: `9091`
   */
  private readonly _port: number;
  /**
   * Transmission-daemon access login
   */
  private readonly _login: string;
  /**
   * Transmission-daemon access password
   */
  private readonly _password: string;
  /**
   * Torrent limit time
   * After how many days should the torrent be deleted even if it has not reached the distribution coefficient = 2
   * Default: `604800` sec (7 days)
   */
  private readonly _limitTime: number;
  /**
   * Transmission settings file path
   */
  private readonly _settingsFilePath: string;
  /**
   * Transmission setting "ratio-limit-enabled"
   * `"ratio-limit-enabled": true`
   */
  ratioEnabled = false;
  /**
   * Transmission setting "ratio-limit"
   * If `"ratio-limit-enabled": true`
   * else default `2.0`
   */
  ratioLimit = 2.0;

  constructor(root_path?: string) {
    this._rootPath = root_path ?? Config.getRootDir();
    this.init();
    this._devmode = this.getParam('node_env') === 'development';
    this._appVersion = this.getParam('version');
    this._logLevel = this._devmode ? 'trace' : this.getParam('log_level');
    this._dateFormat = this.getParam('date_format');
    this._logDateFormat = this.getParam('log_date_format');
    this._logFilePath = this.getParam('log_file_path');
    this._login = this.getParam('login');
    this._password = this.getParam('password');
    this._ipAddress = this.getParam('ip_address');
    this._port = parseInt(this.getParam('tcp_port'), 10);
    this._limitTime = parseInt(this.getParam('limit_time'), 10);
    this._settingsFilePath = this.getParam('settings_file_path');
    this.setRatio();
  }

  get rootPath(): string {
    return this._rootPath;
  }

  get devmode(): boolean {
    return this._devmode;
  }

  get appVersion(): string {
    return this._appVersion;
  }

  get logLevel(): string {
    return this._logLevel;
  }

  get dateFormat(): string {
    return this._dateFormat;
  }

  get logDateFormat(): string {
    return this._logDateFormat;
  }

  get logFilePath(): string {
    return this._logFilePath;
  }

  get ipAddress(): string {
    return this._ipAddress;
  }

  get port(): number {
    return this._port;
  }

  get login(): string {
    return this._login;
  }

  get password(): string {
    return this._password;
  }

  get limitTime(): number {
    return this._limitTime;
  }

  get settingsFilePath(): string {
    return this._settingsFilePath;
  }

  /**
   * Config base init.
   * Load params from `config.json`, `package.json`, `settings.json` from transmission and Environment
   * @param config_file_path - optional `config.json` file path
   */
  private init(): void {
    const configFile: string = normalize(`${this.rootPath}/config.json`);
    const packageFile: string = normalize(`${this.rootPath}/package.json`);
    this.checkFileExists(configFile);
    this.checkFileExists(packageFile);
    this.nconf.env();
    this.nconf.file('config', configFile);
    this.nconf.file('package', packageFile);
    this.nconf.defaults({
      node_env: 'production',
      log_level: 'info',
      log_file_path: '/var/log/transmission/torrentclear.log',
      date_format: 'DD.MM.YYYY_HH:mm:ss', // https://www.npmjs.com/package/moment
      log_date_format: 'dd.MM.yyyy_hh:mm:ss.SSS', // https://www.npmjs.com/package/date-format
      ip_address: '127.0.0.1',
      tcp_port: '9091',
      limit_time: '604800',
      settings_file_path: '/etc/transmission-daemon/settings.json'
    });
    const settingFilePath: string = this.getParam('settings_file_path');
    const settingFile: string = normalize(settingFilePath);
    this.checkFileExists(settingFile);
    this.nconf.file('transmission', settingFile);
    // this.check();
  }

  /**
   * Get Ratio from `settings.json` transmission settings file
   * Transmission 4 support new snake_case settings format.
   * Transmission 5 snake_case settings is Default !!!
   * * Doc: https://github.com/transmission/transmission/blob/main/docs/Editing-Configuration-Files.md
   */
  private setRatio(): void {
    const trSaveVersionFormat: string | undefined = this.getUndefinedParam('TR_SAVE_VERSION_FORMAT');
    // kebab-case
    let ratioLimitEnableName = 'ratio-limit-enabled';
    let ratioLimitName = 'ratio-limit';
    // snake_case
    if (trSaveVersionFormat !== undefined && Number(trSaveVersionFormat) >= 5) {
      ratioLimitEnableName = 'ratio_limit_enabled';
      ratioLimitName = 'ratio_limit';
    }
    this.ratioEnabled = Boolean(this.getParam(ratioLimitEnableName));
    const ratioLimit: string = this.getParam(ratioLimitName);
    if (this.ratioEnabled) this.ratioLimit = parseFloat(ratioLimit);
  }

  /**
   * Check login or password not found
   */
  // check(): void {
  //   const login: string = this.getParam('login');
  //   const password: string = this.getParam('password');
  //   if (login === '' || password === '') {
  //     throw new Error('Login or password must be filled in config.json file or Environment');
  //   }
  // }

  /**
   * Check exists any file
   */
  checkFileExists(file_path: string): void {
    if (!existsSync(file_path)) {
      const relativePath: string = resolve(file_path) as string;
      if (!existsSync(relativePath)) {
        throw new Error(`File not found on path "${file_path}" or relative path "${relativePath}"`);
      }
    }
  }

  /**
   * Determining the Project Root Path
   * @returns {string} application root path
   */
  private static getRootDir(): string {
    const filename: string = fileURLToPath(String(pathToFileURL(__filename)));
    const dir = dirname(filename);
    let currentDir: string = dir;
    while (!existsSync(join(currentDir, 'package.json'))) {
      currentDir = join(currentDir, '..');
    }
    return String(normalize(currentDir));
  }

  /**
   * Get param value
   * @param {string} param_name - parameter name
   * @returns {string} parameter value
   */
  private getParam(param_name: string): string {
    // From config file. Example: login | log_level
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let param: any = this.nconf.get(param_name);
    // Else not found from config file, get from Environment (uppercase).
    // Example: LOGIN | LOG_LEVEL
    if (param === undefined || param === '') param = this.nconf.get(param_name.toUpperCase());
    if (param === undefined || param === '')
      throw new Error(`Parameter "${param_name}" incorrect value "${param}" of type "${typeof param}"`);
    return String(param);
  }

  /**
   * Get param value
   * @param {string} param_name - parameter name
   * @returns {string | undefined} parameter value
   */
  private getUndefinedParam(param_name: string): string | undefined {
    // From config file. Example: login | log_level
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let param: any = this.nconf.get(param_name);
    // Else not found from config file, get from Environment (uppercase).
    // Example: LOGIN | LOG_LEVEL
    if (param === undefined || param === '') param = this.nconf.get(param_name.toUpperCase());
    if (param !== undefined) return String(param);
    return param;
  }
}

export { Config };
