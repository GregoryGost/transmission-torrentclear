import{execSync}from"node:child_process";import{lstatSync}from"node:fs";import{normalize,extname}from"node:path";import{format}from"fecha";class Torrentclear{config;logger;connect;regexSuccess=/success/i;torrentInfo;constructor(t,e){this.config=t,this.logger=e,this.connect=this.connectCommandCreate(),this.torrentInfo={id:0,name:"",state:"",location:"",percent:0,ratio:0,dateDone:"",dateDifference:0}}async main(){try{this.startInfo(),await this.clearProcess(),this.endInfo()}catch(t){this.config.devmode?this.logger.trace(t.message,t.stack):this.logger.error(t.message),this.endInfo(!0)}}async clearProcess(){try{var t=await this.getIDs();await this.checkTorrents(t)}catch(t){throw t}}startInfo(){this.logger.info("##############################################################################################"),this.logger.info(`transmission-torrentclear "${this.config.appVersion}"`),this.logger.info("==============================================================================================")}endInfo(t=!1){this.logger.info("=============================================================================================="),t?this.logger.error("Failed to complete torrent verification process"):this.logger.info("Completing the torrent verification process"),this.logger.info("##############################################################################################\n")}async getIDs(){try{var t=this.connect+" --list";this.logger.debug(`Run command: "${t}"`);var e=(await Torrentclear.command(t)).toString().split(/\r\n|\r|\n/gm),r=(e.shift(),e.pop(),e.pop(),[]);this.logger.debug("Torrent list:");for(const i of e){this.logger.debug(`torrent: "${i}"`);var o,n=i.match(/^\s+(\d+).+$/i);null!==n&&(o=n[1],this.logger.debug(`ID found: "${o}"`),r.push(o))}return 0<r.length?this.logger.info("IDs found: "+r.join(", ")):this.logger.info("IDs not found"),r}catch(t){throw t}}async checkTorrents(t){try{if(0<t.length)for(const e of t)this.logger.info("=============================================================================================="),this.logger.info(`TORRENT ID: "${e}" START PROCESS ...`),await this.getTorrentInfo(e),100===this.torrentInfo.percent?this.checkRatio(this.torrentInfo.ratio)?(this.logger.debug("==> ACTION: Torrent delete on Ratio Limit"),await this.delete(),this.logger.info(`Stopping and deleting a torrent "${this.torrentInfo.name}" by ratio limit completed successfully`)):this.checkDateDifference(this.torrentInfo.dateDifference)?(this.logger.debug("==> ACTION: Torrent delete on Date Difference"),await this.delete(),this.logger.debug(`Stopping and deleting a torrent "${this.torrentInfo.name}" by datetime limit completed successfully`)):this.logger.info("NO ACTION NEEDED"):this.logger.info("NO ACTION NEEDED")}catch(t){throw t}}async delete(){try{await this.torrentStop(),await this.checkFileOrDirectory()}catch(t){throw t}}async checkFileOrDirectory(){try{var t,e=normalize(this.torrentInfo.location+"/"+this.torrentInfo.name),r=await Torrentclear.isFileOrDirectoryOrUnknown(e);!0===r?(t=extname(e),this.logger.info(`Torrent: "${this.torrentInfo.name}" is a FILE`),this.logger.debug(`Torrent: file extension: "${t}"`),this.config.allowedMediaExtensions.test(t)?await this.torrentRemove():(this.logger.debug(`Torrent: file extension "${t}" does not match allowed extensions regex: "${this.config.allowedMediaExtensions}"`),this.logger.info("Torrent does not match allowed extensions. NO ACTION"))):!1===r?(this.logger.info(`Torrent: "${this.torrentInfo.name}" is a DIRECTORY`),this.logger.debug(`Torrent: full path: "${e}"`),await this.torrentRemoveAndDelete()):(this.logger.debug(`Torrent: "${this.torrentInfo.name}" is neither a file or a directory`),this.logger.debug(`Torrent: full path: "${e}"`))}catch(t){throw t}}async torrentStop(){try{var e=`${this.connect} --torrent ${this.torrentInfo.id} --stop`;this.logger.debug(`Stop torrent: (${this.torrentInfo.id}) "${this.torrentInfo.name}"`),this.logger.debug(`Run command: "${e}"`);let t=await Torrentclear.command(e);if(t=t.replace(/(\r\n|\n|\r)/gm,""),this.logger.debug("execResultStop: "+t),!this.regexSuccess.test(t))throw new Error(`Failed to stop torrent (${this.torrentInfo.id}) "${this.torrentInfo.name}". Reason: Negative result of exec command: `+t)}catch(t){throw t}}async torrentRemove(){try{var e=`${this.connect} --torrent ${this.torrentInfo.id} --remove`;this.logger.debug(`Remove torrent without deleting file: (${this.torrentInfo.id}) "${this.torrentInfo.name}"`),this.logger.debug(`Run command: "${e}"`);let t=await Torrentclear.command(e);if(t=t.replace(/(\r\n|\n|\r)/gm,""),this.logger.debug("execResult: "+t),!this.regexSuccess.test(t))throw new Error(`Failed to remove (no del) torrent (${this.torrentInfo.id}) "${this.torrentInfo.name}". Reason: Negative result of exec command: `+t)}catch(t){throw t}}async torrentRemoveAndDelete(){try{var e=`${this.connect} --torrent ${this.torrentInfo.id} --remove-and-delete`;this.logger.debug(`Remove torrent with deleting file: (${this.torrentInfo.id}) "${this.torrentInfo.name}"`),this.logger.debug(`Run command: "${e}"`);let t=await Torrentclear.command(e);if(t=t.replace(/(\r\n|\n|\r)/gm,""),this.logger.debug("execResult: "+t),!this.regexSuccess.test(t))throw new Error(`Failed to remove and delete torrent (${this.torrentInfo.id}) "${this.torrentInfo.name}". Reason: Negative result of exec command: `+t)}catch(t){throw t}}checkRatio(t){return t>=this.config.ratioLimit&&(this.logger.info(`Torrent has reached the Ratio limit: "${t}" >= "${this.config.ratioLimit}"`),!0)}checkDateDifference(t){return t>=this.config.limitTime&&(this.logger.info(`Torrent has reached the Date difference limit: "${t}" >= "${this.config.limitTime}"`),!0)}async getTorrentInfo(t){try{var e=this.connect+` --torrent ${t} --info`;this.logger.debug(`Run command: "${e}"`);var r=(await Torrentclear.command(e)).toString().matchAll(/Name\:\s(.+)|Date\sfinished\:\s+(.+)|Percent\sDone\:\s(.+)\%|Ratio\:\s(.+)|State\:\s(.+)|Location\:\s(.+)/g),o=Array.from(r),n=o[0][1];if(void 0===n)throw new Error(`Torrent name not found in torrent info: "${t}"`);var i=o[1][5];if(void 0===i)throw new Error(`Torrent state not found in torrent info: "${t}"`);var s=o[2][6];if(void 0===s)throw new Error(`Torrent location not found in torrent info: "${t}"`);var a=o[3][3];if(void 0===a)throw new Error(`Torrent percent not found in torrent info: "${t}"`);var c=o[4][4];if(void 0===c)throw new Error(`Torrent ratio not found in torrent info: "${t}"`);var h=o[5][2];if(void 0===h)throw new Error(`Torrent date done not found in torrent info: "${t}"`);var g=Date.now();this.torrentInfo={id:Number(t),name:n,state:i,location:s,percent:Number(a),ratio:Number(c),dateDone:this.dateFormat(Date.parse(h)),dateDifference:Math.round((g-Date.parse(h))/1e3)},this.logger.debug(`Torrent ID "${this.torrentInfo.id}" info:`),this.logger.debug(`   Name: "${this.torrentInfo.name}"`),this.logger.debug(`   State: "${this.torrentInfo.state}"`),this.logger.debug(`   Location: "${this.torrentInfo.location}"`),this.logger.debug(`   Percent Done: "${this.torrentInfo.percent}%"`),this.logger.debug(`   Ratio: "${this.torrentInfo.ratio}" | limit: "${this.config.ratioLimit}"`),this.logger.debug(`   Date finished: "${this.torrentInfo.dateDone}"`),this.logger.debug(`   Date Difference: "${this.torrentInfo.dateDifference}" | limit: "${this.config.limitTime}"`)}catch(t){throw t}}connectCommandCreate(){return`transmission-remote ${this.config.ipAddress}:${this.config.port} --auth ${this.config.login}:`+this.config.password}dateFormat(t){t=new Date(t);return format(t,this.config.dateFormat)}static async command(t){try{return execSync(t,{timeout:2e3,encoding:"utf8"})}catch(t){throw t}}static async isFileOrDirectoryOrUnknown(t){try{var e=lstatSync(t),r=e.isFile(),o=e.isDirectory();return r?!0:!o&&void 0}catch(t){throw t}}}export{Torrentclear};