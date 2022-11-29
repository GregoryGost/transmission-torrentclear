import{normalize}from"node:path";import{existsSync}from"node:fs";import nconf from"nconf";import{validate}from"node-cron";class Config{rootPath=process.cwd();devmode;logLevel;logDateFormat;logFilePath;ipAddress;port;login;password;limitTime;settingsFilePath;cronExpression;ratioEnabled=!1;ratioLimit=2;allowedMediaExtensions;constructor(i){this.init(i),this.login=Config.getParam("login"),this.password=Config.getParam("password"),this.devmode="development"===Config.getParam("node_env"),this.logLevel=this.devmode?"trace":Config.getParam("log_level"),this.logDateFormat=Config.getParam("log_date_format"),this.logFilePath=Config.getParam("log_file_path"),this.ipAddress=Config.getParam("ip_address"),this.port=Number(Config.getParam("tcp_port")),this.limitTime=Number(Config.getParam("limit_time")),this.settingsFilePath=Config.getParam("settings_file_path"),this.cronExpression=Config.getParam("cron_expression"),this.allowedMediaExtensions=Config.extensionsRegexTemplate(Config.getParam("allowed_media_extensions")),this.setRatio(),this.cronExpressionValidate()}init(i){let e=normalize(this.rootPath+"/config.json");void 0!==i&&(e=i),nconf.env(),nconf.file("config",e),nconf.defaults({node_env:"production",log_level:"info",log_file_path:"/var/log/transmission/torrentclear.log",log_date_format:"DD.MM.YYYY HH:mm:ss",ip_address:"127.0.0.1",tcp_port:"9091",limit_time:"604800",settings_file_path:"/etc/transmission-daemon/settings.json",cron_expression:"0 * * * *",allowed_media_extensions:"mkv,mp4,avi"}),nconf.load(),Config.check(),Config.settingsFileExists();i=normalize(Config.getParam("settings_file_path"));nconf.file("transmission",i),nconf.load()}setRatio(){this.ratioEnabled=Boolean(Config.getParam("ratio-limit-enabled")),this.ratioEnabled&&(this.ratioLimit=Number(Config.getParam("ratio-limit")))}cronExpressionValidate(){if(!validate(this.cronExpression))throw new Error(`Cron expression "${this.cronExpression}" is invalid`)}static check(){var i=Config.getParam("login"),e=Config.getParam("password");if(void 0===i||void 0===e)throw new Error("Login or password must be filled in config file or Environment")}static getParam(i){let e=nconf.get(i);return e=void 0===e?nconf.get(i.toUpperCase()):e}static settingsFileExists(){var i=normalize(Config.getParam("settings_file_path"));if(!existsSync(i))throw new Error("Transmission settings file not found on path "+i)}static extensionsRegexTemplate(i){var e=i.split(",");let t=".(";if(1<e.length)for(const o in e)0===Number(o)?t+=e[o]+"|":Number(o)===e.length-1?t+="|"+e[o]:t+=e[o];else t+=e[0];return t+=")",new RegExp(t,"i")}}export{Config};