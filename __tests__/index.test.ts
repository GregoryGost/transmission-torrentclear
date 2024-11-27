/**
 * Unit tests for src/index.ts
 */
import { Torrentclear } from '../src/class/torrentclear';
import { Config } from '../src/class/config';

// Mock the action's entrypoint
let mainMock: jest.SpyInstance;

describe('index.ts', () => {
  beforeEach(() => {
    mainMock = jest.spyOn(Torrentclear.prototype, 'main').mockImplementation();
    jest.spyOn(Config.prototype, 'getParam').mockImplementation((param_name: string): string => {
      if (param_name === 'node_env') return 'production';
      if (param_name === 'log_level') return 'info';
      if (param_name === 'log_file_path') return '/var/log/transmission/torrentclear.log';
      if (param_name === 'date_format') return 'DD.MM.YYYY_HH:mm:ss';
      if (param_name === 'log_date_format') return 'dd.MM.yyyy_hh:mm:ss.SSS';
      if (param_name === 'ip_address') return '127.0.0.1';
      if (param_name === 'tcp_port') return '9091';
      if (param_name === 'limit_time') return '604800';
      if (param_name === 'login') return 'mock_login';
      if (param_name === 'password') return 'mock_password';
      if (param_name === 'settings_file_path') return '/etc/transmission-daemon/settings.json';
      return '';
    });
    jest.spyOn(Config.prototype, 'checkFileExists').mockImplementation();
    // fix EACCES: permission denied, mkdir '/var/log/transmission'
    jest.spyOn(Config.prototype, 'logFilePath', 'get').mockReturnValue('./var/log/transmission');
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('Torrentclear main run', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../src/index');
    expect(mainMock).toHaveBeenCalled();
  });
});
