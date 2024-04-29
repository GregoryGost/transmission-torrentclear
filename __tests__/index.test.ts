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
    jest.spyOn(Config.prototype, 'check').mockImplementation();
    jest.spyOn(Config.prototype, 'settingsFileExists').mockImplementation();
    // fix EACCES: permission denied, mkdir '/var/log/transmission'
    jest.spyOn(Config.prototype, 'logFilePath', 'get').mockReturnValue('./var/log/transmission');
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('Torrentclear main run', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../src/index');
    expect(mainMock).toHaveBeenCalled();
  });
});
