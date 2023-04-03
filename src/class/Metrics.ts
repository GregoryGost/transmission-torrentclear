import { memoryUsage, resourceUsage, cpuUsage, pid, title, uptime } from 'node:process';
import { writeFileSync } from 'node:fs';
import { Config } from './Config.js';
import { Logger } from './Logger.js';
import { normalize } from 'node:path';

interface MetricsI {
  pid: number;
  title: string;
  memory: NodeJS.MemoryUsage;
  cpu: NodeJS.CpuUsage;
  pcpu: number;
  resource: NodeJS.ResourceUsage;
  uptime: number;
  unix_timestamp: number;
}

/**
 * Metrics class
 * Save metrics to metrics File.
 * Doc:
 * [memoryUsage](https://nodejs.org/docs/latest-v16.x/api/process.html#processmemoryusage),
 * [resourceUsage](https://nodejs.org/docs/latest-v16.x/api/process.html#processresourceusage),
 * [cpuUsage](https://nodejs.org/docs/latest-v16.x/api/process.html#processcpuusagepreviousvalue)
 */
class Metrics {
  /**
   * Config instance object.
   */
  private readonly config: Config;
  /**
   * Logger instance object.
   */
  private readonly logger: Logger;
  /**
   * PID process
   */
  private readonly pid: number;
  /**
   * Number of seconds the current Node.js process has been running.
   */
  private uptime: number;
  /**
   * Current process title
   */
  private readonly processTitle: string;
  /**
   * User and System CPU time usage of the current process
   * Example: `{ user: 38579, system: 6986 }`
   */
  private cpuUsage: NodeJS.CpuUsage;
  /**
   * Start Date for CPU usage in Percent
   */
  private startDate: number;

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.pid = pid;
    this.processTitle = title;
    this.uptime = 0;
    this.cpuUsage = cpuUsage();
    this.startDate = Date.now();
    this.init();
  }

  private init(): void {
    this.logger.debug(`Start save metrics for process PID: ${this.pid}, TITLE: ${this.processTitle}`);
  }

  public async save(): Promise<void> {
    try {
      const memory: NodeJS.MemoryUsage = memoryUsage();
      this.cpuUsage = cpuUsage(this.cpuUsage);
      const resource: NodeJS.ResourceUsage = resourceUsage();
      this.uptime = uptime();
      const file: string = normalize(this.config.metricsFilePath);
      //
      const metrics: MetricsI = {
        pid: this.pid,
        title: this.processTitle,
        memory: memory,
        cpu: this.cpuUsage,
        pcpu: (100 * (this.cpuUsage.user + this.cpuUsage.system)) / ((Date.now() - this.startDate) * 1000),
        resource: resource,
        uptime: this.uptime,
        unix_timestamp: Math.trunc(Date.now() / 1000), // ms
      };
      //
      writeFileSync(file, JSON.stringify(metrics), 'utf-8');
      this.logger.debug(`Metrics saved to file "${file}"`);
    } catch (error) {
      throw error;
    }
  }
}

export { Metrics };
