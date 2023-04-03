import{memoryUsage,resourceUsage,cpuUsage,pid,title,uptime}from"node:process";import{writeFileSync}from"node:fs";import{normalize}from"node:path";class Metrics{config;logger;pid;uptime;processTitle;cpuUsage;startDate;constructor(t,e){this.config=t,this.logger=e,this.pid=pid,this.processTitle=title,this.uptime=0,this.cpuUsage=cpuUsage(),this.startDate=Date.now(),this.init()}init(){this.logger.debug(`Start save metrics for process PID: ${this.pid}, TITLE: `+this.processTitle)}async save(){try{var t=memoryUsage(),e=(this.cpuUsage=cpuUsage(this.cpuUsage),resourceUsage()),s=(this.uptime=uptime(),normalize(this.config.metricsFilePath)),i={pid:this.pid,title:this.processTitle,memory:t,cpu:this.cpuUsage,pcpu:100*(this.cpuUsage.user+this.cpuUsage.system)/(1e3*(Date.now()-this.startDate)),resource:e,uptime:this.uptime,unix_timestamp:Math.trunc(Date.now()/1e3)};writeFileSync(s,JSON.stringify(i),"utf-8"),this.logger.debug(`Metrics saved to file "${s}"`)}catch(t){throw t}}}export{Metrics};