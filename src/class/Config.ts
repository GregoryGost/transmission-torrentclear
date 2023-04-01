import { normalize, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  private readonly rootPath: string = normalize(join(dirname(fileURLToPath(import.meta.url)), '../..'));
  /**
   * Nconf implements
   */
  public readonly nconf: typeof nconf = nconf;
  /**
   * Development mode status
   * if development = true
   * Default: `development`
   */
  public readonly devmode: boolean;
  /**
   * This Application version
   * Read from base file package.json
   */
  public readonly appVersion: string;
  /**
   * Log level
   * if devmode(true) = trace
   * trace | debug | info | warn | error
   * Default: `info`
   */
  public readonly logLevel: string;
  /**
   * Date and time format. Used in winston and application.
   * Formatted string accepted by the [fecha](https://github.com/taylorhakes/fecha) module.
   * Default: `DD.MM.YYYY HH:mm:ss`
   */
  public readonly dateFormat: string;
  //
  // TRANSMISSION SETTINGS
  //
  /**
   * Torrent done log file path
   * Default: `/var/log/transmission/torrentclear.log`
   */
  public readonly logFilePath: string;
  /**
   * Transmission-daemon IP Address
   * Default: `127.0.0.1` (localhost)
   */
  public readonly ipAddress: string;
  /**
   * Transmission-daemon TCP Port
   * Default: `9091`
   */
  public readonly port: number;
  /**
   * Transmission-daemon access login
   */
  public readonly login: string;
  /**
   * Transmission-daemon access password
   */
  public readonly password: string;
  /**
   * Torrent limit time
   * After how many days should the torrent be deleted even if it has not reached the distribution coefficient = 2
   * Default: `604800` sec (7 days)
   */
  public readonly limitTime: number;
  /**
   * Transmission settings file path
   */
  public readonly settingsFilePath: string;
  /**
   * Transmission setting "ratio-limit-enabled"
   * `"ratio-limit-enabled": true`
   */
  public ratioEnabled = false;
  /**
   * Transmission setting "ratio-limit"
   * If `"ratio-limit-enabled": true`
   * else default 2
   */
  public ratioLimit = 2;
  /**
   * Allowed extensions for media files
   * Default: `mkv,mp4,avi`
   */
  public readonly allowedMediaExtensions: RegExp;

  constructor(config_file_path?: string) {
    this.init(config_file_path);
    this.login = this.getParam('login');
    this.password = this.getParam('password');
    this.devmode = this.getParam('node_env') === 'development';
    this.appVersion = this.getParam('version');
    this.logLevel = this.devmode ? 'trace' : this.getParam('log_level');
    this.dateFormat = this.getParam('date_format');
    this.logFilePath = this.getParam('log_file_path');
    this.ipAddress = this.getParam('ip_address');
    this.port = Number(this.getParam('tcp_port'));
    this.limitTime = Number(this.getParam('limit_time'));
    this.settingsFilePath = this.getParam('settings_file_path');
    this.allowedMediaExtensions = Config.extensionsRegexTemplate(this.getParam('allowed_media_extensions'));
    this.setRatio();
  }

  /**
   * Config base init.
   * Load params from `config.json`, `package.json`, `settings.json` from transmission and Environment
   * @param config_file_path - optional `config.json` file path
   */
  private init(config_file_path?: string): void {
    let configFile = normalize(`${this.rootPath}/config.json`);
    if (config_file_path !== undefined) configFile = config_file_path;
    this.nconf.env();
    this.nconf.file('config', configFile);
    this.nconf.file('package', normalize(`${this.rootPath}/package.json`));
    this.nconf.defaults({
      node_env: 'production',
      log_level: 'info',
      log_file_path: '/var/log/transmission/torrentclear.log',
      date_format: 'DD.MM.YYYY HH:mm:ss',
      ip_address: '127.0.0.1',
      tcp_port: '9091',
      limit_time: '604800',
      settings_file_path: '/etc/transmission-daemon/settings.json',
      cron_expression: '0 * * * *',
      allowed_media_extensions: 'mkv,mp4,avi',
    });
    this.nconf.load();
    this.check();
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
  private check(): void {
    const login: string = this.getParam('login');
    const password: string = this.getParam('password');
    if (login === undefined || password === undefined) {
      throw new Error('Login or password must be filled in config file or Environment');
    }
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

  /**
   * Check exists transmission `settings.json` file
   */
  private settingsFileExists(): void {
    const settingsFilePath: string = normalize(this.getParam('settings_file_path'));
    if (!existsSync(settingsFilePath))
      throw new Error(`Transmission settings file not found on path ${settingsFilePath}`);
  }

  /**
   * [Static]
   * Allowed media files extensions regex constructor
   * @param allowed_media_extensions - comma separated list of extensions. Example: `mkv,mp4,avi`
   * @returns RegExp object (new RegExp)
   */
  private static extensionsRegexTemplate(allowed_media_extensions: string): RegExp {
    const extensionArray: string[] = allowed_media_extensions.split(',');
    let regexString = `\.(`;
    if (extensionArray.length > 1) {
      for (const i in extensionArray) {
        if (Number(i) === 0) regexString += `${extensionArray[i]}|`;
        else if (Number(i) === extensionArray.length - 1) regexString += `|${extensionArray[i]}`;
        else regexString += extensionArray[i];
      }
    } else {
      regexString += extensionArray[0];
    }
    regexString += `)`;
    return new RegExp(regexString, 'i');
  }
}

export { Config };
