import { normalize } from 'node:path';
import { existsSync } from 'node:fs';
import nconf from 'nconf';
import { validate } from 'node-cron';

/**
 * Config class
 * Basic configuration parameters
 */
class Config {
  /**
   * Path to root application dir
   */
  private readonly rootPath: string = process.cwd();
  /**
   * Development mode status
   * if development = true
   * Default: development
   */
  public readonly devmode: boolean;
  /**
   * Log level
   * if devmode(true) = trace
   * trace | debug | info | warn | error
   * Default: info
   */
  public readonly logLevel: string;
  /**
   * Log date and time format (winston)
   * Default DD.MM.YYYY HH:mm:ss
   */
  public readonly logDateFormat: string;
  //
  // TRANSMISSION SETTINGS
  //
  /**
   * Torrent done log file path
   * Default: /var/log/transmission/torrentclear.log
   */
  public readonly logFilePath: string;
  /**
   * Transmission-daemon IP Address
   * Default: 127.0.0.1 (localhost)
   */
  public readonly ipAddress: string;
  /**
   * Transmission-daemon TCP Port
   * Default: 9091
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
   * Default: 604800 sec (7 days)
   */
  public readonly limitTime: number;
  /**
   * Transmission settings file path
   */
  public readonly settingsFilePath: string;
  /**
   * ┌────────────── second (optional)
   * │ ┌──────────── minute
   * │ │ ┌────────── hour
   * │ │ │ ┌──────── day of month
   * │ │ │ │ ┌────── month
   * │ │ │ │ │ ┌──── day of week
   * │ │ │ │ │ │
   * │ │ │ │ │ │
   * * * * * * *
   * Default: 0 * * * * (every hour)
   */
  public readonly cronExpression: string;
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
   * Default: mkv, mp4, avi
   */
  public readonly allowedMediaExtensions: RegExp;

  constructor(config_file_path?: string) {
    this.init(config_file_path);
    this.login = Config.getParam('login');
    this.password = Config.getParam('password');
    this.devmode = Config.getParam('node_env') === 'development';
    this.logLevel = this.devmode ? 'trace' : Config.getParam('log_level');
    this.logDateFormat = Config.getParam('log_date_format');
    this.logFilePath = Config.getParam('log_file_path');
    this.ipAddress = Config.getParam('ip_address');
    this.port = Number(Config.getParam('tcp_port'));
    this.limitTime = Number(Config.getParam('limit_time'));
    this.settingsFilePath = Config.getParam('settings_file_path');
    this.cronExpression = Config.getParam('cron_expression');
    this.allowedMediaExtensions = Config.extensionsRegexTemplate(Config.getParam('allowed_media_extensions'));
    this.setRatio();
    this.cronExpressionValidate();
  }

  private init(config_file_path?: string): void {
    // .../dist/config.json
    let configFile = normalize(`${this.rootPath}/config.json`);
    if (config_file_path !== undefined) configFile = config_file_path;
    nconf.env();
    nconf.file('config', configFile);
    nconf.defaults({
      node_env: 'production',
      log_level: 'info',
      log_file_path: '/var/log/transmission/torrentclear.log',
      log_date_format: 'DD.MM.YYYY HH:mm:ss',
      ip_address: '127.0.0.1',
      tcp_port: '9091',
      limit_time: '604800',
      settings_file_path: '/etc/transmission-daemon/settings.json',
      cron_expression: '0 * * * *',
      allowed_media_extensions: 'mkv,mp4,avi',
    });
    nconf.load();
    Config.check();
    Config.settingsFileExists();
    const settingFile: string = normalize(Config.getParam('settings_file_path'));
    nconf.file('transmission', settingFile);
    nconf.load();
  }

  private setRatio(): void {
    this.ratioEnabled = Boolean(Config.getParam('ratio-limit-enabled'));
    if (this.ratioEnabled) this.ratioLimit = Number(Config.getParam('ratio-limit'));
  }

  private cronExpressionValidate(): void {
    const expressionStatus = validate(this.cronExpression);
    if (!expressionStatus) throw new Error(`Cron expression "${this.cronExpression}" is invalid`);
  }

  /**
   * Static check login or password not found
   */
  private static check(): void {
    const login: string = Config.getParam('login');
    const password: string = Config.getParam('password');
    if (login === undefined || password === undefined) {
      throw new Error('Login or password must be filled in config file or Environment');
    }
  }

  private static getParam(param_name: string): string {
    // From config file. Example: login | log_level
    let param = nconf.get(param_name);
    // Else not found from config file, get from Environment (uppercase).
    // Example: LOGIN | LOG_LEVEL
    if (param === undefined) param = nconf.get(param_name.toUpperCase());
    return param;
  }

  private static settingsFileExists(): void {
    const settingsFilePath: string = normalize(Config.getParam('settings_file_path'));
    if (!existsSync(settingsFilePath))
      throw new Error(`Transmission settings file not found on path ${settingsFilePath}`);
  }

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
