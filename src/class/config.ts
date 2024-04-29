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
   * Path to root application dir
   */
  private readonly _rootPath: string;
  /**
   * Nconf implements
   */
  private readonly nconf: typeof nconf = nconf;
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
  private readonly _login: string | undefined;
  /**
   * Transmission-daemon access password
   */
  private readonly _password: string | undefined;
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
   * else default 2
   */
  ratioLimit = 2;
  /**
   * Metrics save file path
   * Default: `/var/log/transmission/torrentclear_metrics.log`
   */
  // private readonly _metricsFilePath: string;

  constructor(root_path?: string) {
    this._rootPath = root_path ?? Config.getRootDir();
    this.init();
    this._login = this.getParam('login');
    this._password = this.getParam('password');
    this._devmode = this.getParam('node_env') === 'development';
    this._appVersion = this.getParam('version');
    this._logLevel = this._devmode ? 'trace' : this.getParam('log_level');
    this._dateFormat = this.getParam('date_format');
    this._logDateFormat = this.getParam('log_date_format');
    this._logFilePath = this.getParam('log_file_path');
    // this._metricsFilePath = this.getParam('metrics_file_path');
    this._ipAddress = this.getParam('ip_address');
    this._port = Number(this.getParam('tcp_port'));
    this._limitTime = Number(this.getParam('limit_time'));
    this._settingsFilePath = this.getParam('settings_file_path');
    this.setRatio();
    this.check();
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

  get login(): string | undefined {
    return this._login;
  }

  get password(): string | undefined {
    return this._password;
  }

  // get metricsFilePath(): string {
  //   return this._metricsFilePath;
  // }

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
    const configFile: string = normalize(`${this._rootPath}/config.json`);
    this.nconf.env();
    this.nconf.file('config', configFile);
    this.nconf.file('package', normalize(`${this._rootPath}/package.json`));
    this.nconf.defaults({
      node_env: 'production',
      log_level: 'info',
      log_file_path: '/var/log/transmission/torrentclear.log',
      // metrics_file_path: '/var/log/transmission/torrentclear_metrics.log',
      date_format: 'DD.MM.YYYY_HH:mm:ss', // https://www.npmjs.com/package/moment
      log_date_format: 'dd.MM.yyyy_hh:mm:ss.SSS', // https://www.npmjs.com/package/date-format
      ip_address: '127.0.0.1',
      tcp_port: '9091',
      limit_time: '604800',
      settings_file_path: '/etc/transmission-daemon/settings.json',
    });
    this.nconf.load();
    this.settingsFileExists();
    const settingFile: string = normalize(this.getParam('settings_file_path'));
    this.nconf.file('transmission', settingFile);
    this.nconf.load();
  }

  /**
   * Get Ratio from `settings.json` transmission settings file
   */
  private setRatio(): void {
    this.ratioEnabled = Boolean(this.getParam('ratio-limit-enabled'));
    if (this.ratioEnabled) this.ratioLimit = Number(this.getParam('ratio-limit'));
  }

  /**
   * Check login or password not found
   */
  check(): void {
    const login: string = this.getParam('login');
    const password: string = this.getParam('password');
    if (login === undefined || login === '' || password === undefined || password === '') {
      throw new Error('Login or password must be filled in config.json file or Environment');
    }
  }

  /**
   * Check exists transmission `settings.json` file
   */
  settingsFileExists(): void {
    const settingsFilePath: string = normalize(this.getParam('settings_file_path'));
    if (!existsSync(settingsFilePath)) {
      const relativeSettingsPath: string = resolve(settingsFilePath);
      if (!existsSync(relativeSettingsPath)) {
        throw new Error(`Transmission settings file not found on path ${settingsFilePath}`);
      }
    }
  }

  /**
   * Determining the Project Root Path
   * @returns {string} application root path
   */
  private static getRootDir(): string {
    const filename: string = fileURLToPath(pathToFileURL(__filename).toString());
    const dir = dirname(filename);
    let currentDir: string = dir;
    while (!existsSync(join(currentDir, 'package.json'))) {
      currentDir = join(currentDir, '..');
    }
    return normalize(currentDir);
  }

  /**
   * Get param value
   * @param param_name - parameter name
   * @returns parameter value
   */
  private getParam(param_name: string): string {
    // From config file. Example: login | log_level
    let param = this.nconf.get(param_name);
    // Else not found from config file, get from Environment (uppercase).
    // Example: LOGIN | LOG_LEVEL
    if (param === undefined) param = this.nconf.get(param_name.toUpperCase());
    return param;
  }
}

export { Config };
