/**
 * Unit tests for src/class/torrentclear.ts
 */
import cproc from 'node:child_process';
import fs, { Stats } from 'node:fs';
import { cwd } from 'node:process';
import { normalize, join } from 'node:path';
import moment from 'moment';
import type { Level } from 'log4js';
//
import { Torrentclear } from '../src/class/torrentclear';

const fakeRootPath: string = normalize(join(cwd(), '__tests__', 'configs'));
// Transmission date format: Thu Apr 25 22:20:32 2024
const nowFormatedDate = moment(new Date()).format('ddd MMM DD HH:mm:ss YYYY');

// Mock logger
let logInfoMock: jest.SpyInstance;
let logDebugMock: jest.SpyInstance;
let logErrorMock: jest.SpyInstance;

describe('torrentclear.ts - Positive tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  /**
   * Instance test
   */
  it('Torrentclear instance and init params', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    expect(torrentclear instanceof Torrentclear).toBe(true);
    expect(torrentclear.torrentInfo).toStrictEqual({
      id: 0,
      name: '',
      state: '',
      location: '',
      percent: 0,
      ratio: 0,
      dateDone: '',
      dateDifference: 0
    });
    expect(torrentclear.torrentProcessCount).toBe(0);
    expect(torrentclear.torrentSuccessCount).toBe(0);
    expect(torrentclear.torrentIDs).toStrictEqual([]);
    torrentclear.torrentInfo = {
      id: 777,
      name: 'Test',
      state: 'Test state',
      location: 'Test location',
      percent: 50,
      ratio: 1.1,
      dateDone: '99.99.9999',
      dateDifference: 555
    };
    expect(torrentclear.torrentInfo).toStrictEqual({
      id: 777,
      name: 'Test',
      state: 'Test state',
      location: 'Test location',
      percent: 50,
      ratio: 1.1,
      dateDone: '99.99.9999',
      dateDifference: 555
    });
  });
  /**
   * Clear OK process test
   */
  it('Torrentclear - clear process torrent is DIR, date diff', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list') {
        const result = `ID     Done       Have  ETA           Up    Down  Ratio  Status       Name
  35   100%   22.11 GB  12 days      0.0     0.0    0.0  Seeding      Шерлок Холмс S01 Serial WEB-DL (1080p)
Sum:          24.08 GB              15.0  18007.0`;
        return result;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --info'
      ) {
        const result = `NAME
  Id: 35
  Name: Шерлок Холмс S01 Serial WEB-DL (1080p)
  Hash: 64fab1c4a1fb9f48da1a886b252ac04b796df348
  Labels: 

TRANSFER
  State: Idle
  Location: ${normalize(`${fakeRootPath}/mnt/downloads`)}
  Percent Done: 100%
  ETA: 0 seconds (0 seconds)
  Download Speed: 0 kB/s
  Upload Speed: 0 kB/s
  Have: 2.86 GB (2.86 GB verified)
  Availability: 100%
  Total size: 2.86 GB (2.86 GB wanted)
  Downloaded: 2.89 GB
  Uploaded: 1.81 GB
  Ratio: 0.6
  Corrupt DL: None
  Peers: connected to 4, uploading to 0, downloading from 0

HISTORY
  Date added:       Thu Apr 25 22:16:07 2024
  Date finished:    Thu Apr 25 22:20:32 2024
  Date started:     Thu Apr 25 22:16:07 2024
  Latest activity:  Sat Apr 27 18:47:33 2024
  Downloading Time: 4 minutes (267 seconds)
  Seeding Time:     2 days, 2 hours (180111 seconds)

ORIGINS
  Date created: Tue Apr 16 19:15:17 2024
  Public torrent: Yes
  Comment: LostFilm.TV(c)
  Creator: uTorrent/3310
  Piece Count: 682
  Piece Size: 4.00 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal
`;
        return result;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --stop'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      if (
        command ===
        'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --remove-and-delete'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      return 'no action';
    });
    //
    logInfoMock = jest
      .spyOn(torrentclear.logger, 'info')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logDebugMock = jest
      .spyOn(torrentclear.logger, 'debug')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    //
    torrentclear.main();
    //
    expect(torrentclear.torrentInfo.id).toEqual(35);
    expect(torrentclear.torrentInfo.name).toEqual('Шерлок Холмс S01 Serial WEB-DL (1080p)');
    expect(torrentclear.torrentInfo.state).toEqual('Idle');
    expect(torrentclear.torrentInfo.location).toEqual(normalize(`${fakeRootPath}/mnt/downloads`));
    expect(torrentclear.torrentInfo.percent).toEqual(100);
    expect(torrentclear.torrentInfo.ratio).toEqual(0.6);
    // log Info
    expect(logInfoMock).toHaveBeenNthCalledWith(2, `transmission-torrentclear: "99.99.99"`);
    expect(logInfoMock).toHaveBeenNthCalledWith(4, `IDs found: 35`);
    expect(logInfoMock).toHaveBeenNthCalledWith(6, `TORRENT ID: "35" START PROCESS ...`);
    expect(logInfoMock).toHaveBeenNthCalledWith(8, `Torrent: "Шерлок Холмс S01 Serial WEB-DL (1080p)" is a DIRECTORY`);
    expect(logInfoMock).toHaveBeenNthCalledWith(
      9,
      `Stopping and deleting a torrent "Шерлок Холмс S01 Serial WEB-DL (1080p)" by datetime limit completed successfully`
    );
    // log Debug
    expect(logDebugMock).toHaveBeenNthCalledWith(
      1,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      3,
      `torrent: "35   100%   22.11 GB  12 days      0.0     0.0    0.0  Seeding      Шерлок Холмс S01 Serial WEB-DL (1080p)"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(4, `ID found: "35"`);
    expect(logDebugMock).toHaveBeenNthCalledWith(
      5,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --info"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(6, `Torrent ID "35" info:`);
    expect(logDebugMock).toHaveBeenNthCalledWith(7, `   Name: "Шерлок Холмс S01 Serial WEB-DL (1080p)"`);
    expect(logDebugMock).toHaveBeenNthCalledWith(14, `==> ACTION: Torrent delete on Date Difference`);
    expect(logDebugMock).toHaveBeenNthCalledWith(
      15,
      `normalized torrentPath: "${normalize(`${fakeRootPath}/mnt/downloads/Шерлок Холмс S01 Serial WEB-DL (1080p)`)}"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(16, `Stop torrent: (35) "Шерлок Холмс S01 Serial WEB-DL (1080p)"`);
    expect(logDebugMock).toHaveBeenNthCalledWith(
      17,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --stop"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      18,
      `execResultStop: 192.168.88.22:9092/transmission/rpc/responded: "success"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      19,
      `Remove torrent with deleting file: (35) "Шерлок Холмс S01 Serial WEB-DL (1080p)"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      20,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --remove-and-delete"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      21,
      `execResultRemoveAndDelete: 192.168.88.22:9092/transmission/rpc/responded: "success"`
    );
    // Log Error
    expect(logErrorMock).not.toHaveBeenCalled();
    //
    expect(torrentclear.torrentProcessCount).toBe(1);
    expect(torrentclear.torrentSuccessCount).toBe(1);
    expect(torrentclear.torrentIDs).toStrictEqual([35]);
  });
  it('Torrentclear - clear process torrent is DIR, ratio', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list') {
        const result = `ID     Done       Have  ETA           Up    Down  Ratio  Status       Name
  35   100%   22.11 GB  12 days      0.0     0.0    3.0  Seeding      Шерлок Холмс S01 Serial WEB-DL (1080p)
Sum:          24.08 GB              15.0  18007.0`;
        return result;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --info'
      ) {
        const result = `NAME
  Id: 35
  Name: Шерлок Холмс S01 Serial WEB-DL (1080p)
  Hash: 64fab1c4a1fb9f48da1a886b252ac04b796df348
  Labels: 

TRANSFER
  State: Idle
  Location: ${normalize(`${fakeRootPath}/mnt/downloads`)}
  Percent Done: 100%
  ETA: 0 seconds (0 seconds)
  Download Speed: 0 kB/s
  Upload Speed: 0 kB/s
  Have: 2.86 GB (2.86 GB verified)
  Availability: 100%
  Total size: 2.86 GB (2.86 GB wanted)
  Downloaded: 2.89 GB
  Uploaded: 1.81 GB
  Ratio: 3.0
  Corrupt DL: None
  Peers: connected to 4, uploading to 0, downloading from 0

HISTORY
  Date added:       Thu Apr 25 22:16:07 2024
  Date finished:    Thu Apr 25 22:20:32 2024
  Date started:     Thu Apr 25 22:16:07 2024
  Latest activity:  Sat Apr 27 18:47:33 2024
  Downloading Time: 4 minutes (267 seconds)
  Seeding Time:     2 days, 2 hours (180111 seconds)

ORIGINS
  Date created: Tue Apr 16 19:15:17 2024
  Public torrent: Yes
  Comment: LostFilm.TV(c)
  Creator: uTorrent/3310
  Piece Count: 682
  Piece Size: 4.00 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal
`;
        return result;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --stop'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      if (
        command ===
        'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --remove-and-delete'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      return 'no action';
    });
    //
    logInfoMock = jest
      .spyOn(torrentclear.logger, 'info')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logDebugMock = jest
      .spyOn(torrentclear.logger, 'debug')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    //
    torrentclear.main();
    //
    expect(torrentclear.torrentInfo.id).toEqual(35);
    expect(torrentclear.torrentInfo.name).toEqual('Шерлок Холмс S01 Serial WEB-DL (1080p)');
    expect(torrentclear.torrentInfo.state).toEqual('Idle');
    expect(torrentclear.torrentInfo.location).toEqual(normalize(`${fakeRootPath}/mnt/downloads`));
    expect(torrentclear.torrentInfo.percent).toEqual(100);
    expect(torrentclear.torrentInfo.ratio).toEqual(3);
    // log Info
    expect(logInfoMock).toHaveBeenNthCalledWith(2, `transmission-torrentclear: "99.99.99"`);
    expect(logInfoMock).toHaveBeenNthCalledWith(4, `IDs found: 35`);
    expect(logInfoMock).toHaveBeenNthCalledWith(6, `TORRENT ID: "35" START PROCESS ...`);
    expect(logInfoMock).toHaveBeenNthCalledWith(8, `Torrent: "Шерлок Холмс S01 Serial WEB-DL (1080p)" is a DIRECTORY`);
    expect(logInfoMock).toHaveBeenNthCalledWith(
      9,
      `Stopping and deleting a torrent "Шерлок Холмс S01 Serial WEB-DL (1080p)" by ratio limit completed successfully`
    );
    // log Debug
    expect(logDebugMock).toHaveBeenNthCalledWith(
      1,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      3,
      `torrent: "35   100%   22.11 GB  12 days      0.0     0.0    3.0  Seeding      Шерлок Холмс S01 Serial WEB-DL (1080p)"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(4, `ID found: "35"`);
    expect(logDebugMock).toHaveBeenNthCalledWith(
      5,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --info"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(7, `   Name: "Шерлок Холмс S01 Serial WEB-DL (1080p)"`);
    expect(logDebugMock).toHaveBeenNthCalledWith(14, `==> ACTION: Torrent delete on Ratio Limit`);
    expect(logDebugMock).toHaveBeenNthCalledWith(
      15,
      `normalized torrentPath: "${normalize(`${fakeRootPath}/mnt/downloads/Шерлок Холмс S01 Serial WEB-DL (1080p)`)}"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(16, `Stop torrent: (35) "Шерлок Холмс S01 Serial WEB-DL (1080p)"`);
    expect(logDebugMock).toHaveBeenNthCalledWith(
      17,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --stop"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      18,
      `execResultStop: 192.168.88.22:9092/transmission/rpc/responded: "success"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      19,
      `Remove torrent with deleting file: (35) "Шерлок Холмс S01 Serial WEB-DL (1080p)"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      20,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --remove-and-delete"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      21,
      `execResultRemoveAndDelete: 192.168.88.22:9092/transmission/rpc/responded: "success"`
    );
    // Log Error
    expect(logErrorMock).not.toHaveBeenCalled();
    //
    expect(torrentclear.torrentProcessCount).toBe(1);
    expect(torrentclear.torrentSuccessCount).toBe(1);
    expect(torrentclear.torrentIDs).toStrictEqual([35]);
  });
  it('Torrentclear - clear process torrent is FILE, date diff', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list') {
        const result = `    ID   Done       Have  ETA           Up    Down  Ratio  Status       Name
       7   100%    2.86 GB  Unknown      0.0     0.0    0.6  Idle         Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv
  Sum:             4.08 GB             150.0     0.0`;
        return result;
      }
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --info') {
        const result = `NAME
  Id: 7
  Name: Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv
  Hash: 64fab1c4a1fb9f48da1a886b252ac04b796df348
  Labels: 

TRANSFER
  State: Idle
  Location: ${normalize(`${fakeRootPath}/mnt/downloads`)}
  Percent Done: 100%
  ETA: 1 day, 7 hours (114465 seconds)
  Download Speed: 0 kB/s
  Upload Speed: 84 kB/s
  Have: 2.86 GB (2.86 GB verified)
  Availability: 100%
  Total size: 2.86 GB (2.86 GB wanted)
  Downloaded: 2.89 GB
  Uploaded: 1.92 GB
  Ratio: 0.6
  Corrupt DL: None
  Peers: connected to 16, uploading to 1, downloading from 0

HISTORY
  Date added:       Thu Apr 25 22:16:07 2024
  Date finished:    Thu Apr 25 22:20:32 2024
  Date started:     Thu Apr 25 22:16:07 2024
  Latest activity:  Sat Apr 27 18:47:33 2024
  Downloading Time: 4 minutes (267 seconds)
  Seeding Time:     2 days, 2 hours (180111 seconds)

ORIGINS
  Date created: Tue Apr 16 19:15:17 2024
  Public torrent: Yes
  Comment: LostFilm.TV(c)
  Creator: uTorrent/3310
  Piece Count: 682
  Piece Size: 4.00 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal
`;
        return result;
      }
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --stop') {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --remove'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      return 'no action';
    });
    //
    logInfoMock = jest
      .spyOn(torrentclear.logger, 'info')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logDebugMock = jest
      .spyOn(torrentclear.logger, 'debug')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    //
    torrentclear.main();
    //
    expect(torrentclear.torrentInfo.id).toEqual(7);
    expect(torrentclear.torrentInfo.name).toEqual('Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv');
    expect(torrentclear.torrentInfo.state).toEqual('Idle');
    expect(torrentclear.torrentInfo.location).toEqual(normalize(`${fakeRootPath}/mnt/downloads`));
    expect(torrentclear.torrentInfo.percent).toEqual(100);
    expect(torrentclear.torrentInfo.ratio).toEqual(0.6);
    // log Info
    expect(logInfoMock).toHaveBeenNthCalledWith(2, `transmission-torrentclear: "99.99.99"`);
    expect(logInfoMock).toHaveBeenNthCalledWith(4, `IDs found: 7`);
    expect(logInfoMock).toHaveBeenNthCalledWith(6, `TORRENT ID: "7" START PROCESS ...`);
    expect(logInfoMock).toHaveBeenNthCalledWith(8, `Torrent: "Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv" is a FILE`);
    expect(logInfoMock).toHaveBeenNthCalledWith(
      9,
      `Stopping and deleting a torrent "Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv" by datetime limit completed successfully`
    );
    // log Debug
    expect(logDebugMock).toHaveBeenNthCalledWith(
      1,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      3,
      `torrent: "7   100%    2.86 GB  Unknown      0.0     0.0    0.6  Idle         Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(4, `ID found: "7"`);
    expect(logDebugMock).toHaveBeenNthCalledWith(
      5,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --info"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(7, `   Name: "Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv"`);
    expect(logDebugMock).toHaveBeenNthCalledWith(14, `==> ACTION: Torrent delete on Date Difference`);
    expect(logDebugMock).toHaveBeenNthCalledWith(
      15,
      `normalized torrentPath: "${normalize(`${fakeRootPath}/mnt/downloads/Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv`)}"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(16, `Stop torrent: (7) "Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv"`);
    expect(logDebugMock).toHaveBeenNthCalledWith(
      17,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --stop"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      18,
      `execResultStop: 192.168.88.22:9092/transmission/rpc/responded: "success"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      19,
      `Remove torrent without deleting file: (7) "Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      20,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --remove"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      21,
      `execResultRemove: 192.168.88.22:9092/transmission/rpc/responded: "success"`
    );
    // Log Error
    expect(logErrorMock).not.toHaveBeenCalled();
    //
    expect(torrentclear.torrentProcessCount).toBe(1);
    expect(torrentclear.torrentSuccessCount).toBe(1);
    expect(torrentclear.torrentIDs).toStrictEqual([7]);
  });
  it('Torrentclear - clear process torrent is FILE, ratio', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list') {
        const result = `    ID   Done       Have  ETA           Up    Down  Ratio  Status       Name
       7   100%    2.86 GB  Unknown      0.0     0.0    3.5  Idle         Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv
  Sum:             4.08 GB             150.0     0.0`;
        return result;
      }
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --info') {
        const result = `NAME
  Id: 7
  Name: Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv
  Hash: 64fab1c4a1fb9f48da1a886b252ac04b796df348
  Labels: 

TRANSFER
  State: Idle
  Location: ${normalize(`${fakeRootPath}/mnt/downloads`)}
  Percent Done: 100%
  ETA: 1 day, 7 hours (114465 seconds)
  Download Speed: 0 kB/s
  Upload Speed: 84 kB/s
  Have: 2.86 GB (2.86 GB verified)
  Availability: 100%
  Total size: 2.86 GB (2.86 GB wanted)
  Downloaded: 2.89 GB
  Uploaded: 1.92 GB
  Ratio: 3.5
  Corrupt DL: None
  Peers: connected to 16, uploading to 1, downloading from 0

HISTORY
  Date added:       Thu Apr 25 22:16:07 2024
  Date finished:    Thu Apr 25 22:20:32 2024
  Date started:     Thu Apr 25 22:16:07 2024
  Latest activity:  Sat Apr 27 18:47:33 2024
  Downloading Time: 4 minutes (267 seconds)
  Seeding Time:     2 days, 2 hours (180111 seconds)

ORIGINS
  Date created: Tue Apr 16 19:15:17 2024
  Public torrent: Yes
  Comment: LostFilm.TV(c)
  Creator: uTorrent/3310
  Piece Count: 682
  Piece Size: 4.00 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal
`;
        return result;
      }
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --stop') {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --remove'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      return 'no action';
    });
    //
    logInfoMock = jest
      .spyOn(torrentclear.logger, 'info')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logDebugMock = jest
      .spyOn(torrentclear.logger, 'debug')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    //
    torrentclear.main();
    //
    expect(torrentclear.torrentInfo.id).toEqual(7);
    expect(torrentclear.torrentInfo.name).toEqual('Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv');
    expect(torrentclear.torrentInfo.state).toEqual('Idle');
    expect(torrentclear.torrentInfo.location).toEqual(normalize(`${fakeRootPath}/mnt/downloads`));
    expect(torrentclear.torrentInfo.percent).toEqual(100);
    expect(torrentclear.torrentInfo.ratio).toEqual(3.5);
    // log Info
    expect(logInfoMock).toHaveBeenNthCalledWith(2, `transmission-torrentclear: "99.99.99"`);
    expect(logInfoMock).toHaveBeenNthCalledWith(4, `IDs found: 7`);
    expect(logInfoMock).toHaveBeenNthCalledWith(6, `TORRENT ID: "7" START PROCESS ...`);
    expect(logInfoMock).toHaveBeenNthCalledWith(8, `Torrent: "Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv" is a FILE`);
    expect(logInfoMock).toHaveBeenNthCalledWith(
      9,
      `Stopping and deleting a torrent "Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv" by ratio limit completed successfully`
    );
    // log Debug
    expect(logDebugMock).toHaveBeenNthCalledWith(
      1,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      3,
      `torrent: "7   100%    2.86 GB  Unknown      0.0     0.0    3.5  Idle         Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(4, `ID found: "7"`);
    expect(logDebugMock).toHaveBeenNthCalledWith(
      5,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --info"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(7, `   Name: "Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv"`);
    expect(logDebugMock).toHaveBeenNthCalledWith(14, `==> ACTION: Torrent delete on Ratio Limit`);
    expect(logDebugMock).toHaveBeenNthCalledWith(
      15,
      `normalized torrentPath: "${normalize(`${fakeRootPath}/mnt/downloads/Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv`)}"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(16, `Stop torrent: (7) "Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv"`);
    expect(logDebugMock).toHaveBeenNthCalledWith(
      17,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --stop"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      18,
      `execResultStop: 192.168.88.22:9092/transmission/rpc/responded: "success"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      19,
      `Remove torrent without deleting file: (7) "Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      20,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --remove"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      21,
      `execResultRemove: 192.168.88.22:9092/transmission/rpc/responded: "success"`
    );
    // Log Error
    expect(logErrorMock).not.toHaveBeenCalled();
    //
    expect(torrentclear.torrentProcessCount).toBe(1);
    expect(torrentclear.torrentSuccessCount).toBe(1);
    expect(torrentclear.torrentIDs).toStrictEqual([7]);
  });
  it('Torrentclear - clear process two torrents', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list') {
        const result = `    ID   Done       Have  ETA           Up    Down  Ratio  Status       Name
       7   100%    2.86 GB  Unknown      0.0     0.0    3.5  Idle         Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv
       9   100%    1.23 GB  3 hrs      150.0     0.0    3.3  Idle         Star.Wars.The.Bad.Batch.S03E14.1080p.rus.LostFilm.TV.mkv
  Sum:             4.08 GB             150.0     0.0`;
        return result;
      }
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --info') {
        const result = `NAME
  Id: 7
  Name: Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv
  Hash: 64fab1c4a1fb9f48da1a886b252ac04b796df348
  Labels: 

TRANSFER
  State: Idle
  Location: ${normalize(`${fakeRootPath}/mnt/downloads`)}
  Percent Done: 100%
  ETA: 1 day, 7 hours (114465 seconds)
  Download Speed: 0 kB/s
  Upload Speed: 84 kB/s
  Have: 2.86 GB (2.86 GB verified)
  Availability: 100%
  Total size: 2.86 GB (2.86 GB wanted)
  Downloaded: 2.89 GB
  Uploaded: 1.92 GB
  Ratio: 3.5
  Corrupt DL: None
  Peers: connected to 16, uploading to 1, downloading from 0

HISTORY
  Date added:       Thu Apr 25 22:16:07 2024
  Date finished:    Thu Apr 25 22:20:32 2024
  Date started:     Thu Apr 25 22:16:07 2024
  Latest activity:  Sat Apr 27 18:47:33 2024
  Downloading Time: 4 minutes (267 seconds)
  Seeding Time:     2 days, 2 hours (180111 seconds)

ORIGINS
  Date created: Tue Apr 16 19:15:17 2024
  Public torrent: Yes
  Comment: LostFilm.TV(c)
  Creator: uTorrent/3310
  Piece Count: 682
  Piece Size: 4.00 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal
`;
        return result;
      }
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 9 --info') {
        const result = `NAME
  Id: 9
  Name: Star.Wars.The.Bad.Batch.S03E14.1080p.rus.LostFilm.TV.mkv
  Hash: 6ade5af6d45d44650de54480a5114ea6af3fbdfd
  Labels: 

TRANSFER
  State: Seeding
  Location: ${normalize(`${fakeRootPath}/mnt/downloads`)}
  Percent Done: 100%
  ETA: 3 hours, 48 minutes (13699 seconds)
  Download Speed: 0 kB/s
  Upload Speed: 261 kB/s
  Have: 1.23 GB (1.23 GB verified)
  Availability: 100%
  Total size: 1.23 GB (1.23 GB wanted)
  Downloaded: 1.28 GB
  Uploaded: 1.53 GB
  Ratio: 3.3
  Corrupt DL: None
  Peers: connected to 21, uploading to 3, downloading from 0

HISTORY
  Date added:       Thu Apr 25 22:16:07 2024
  Date finished:    Thu Apr 25 22:20:32 2024
  Date started:     Thu Apr 25 22:16:07 2024
  Latest activity:  Sat Apr 27 18:47:33 2024
  Downloading Time: 4 minutes (267 seconds)
  Seeding Time:     2 days, 2 hours (180111 seconds)

ORIGINS
  Date created: Sat Apr 27 20:50:07 2024
  Public torrent: Yes
  Comment: LostFilm.TV (c)
  Creator: uTorrent/3.6
  Piece Count: 586
  Piece Size: 2.00 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal
`;
        return result;
      }
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --stop') {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 9 --stop') {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --remove'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 9 --remove'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      return 'no action';
    });
    //
    logInfoMock = jest
      .spyOn(torrentclear.logger, 'info')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logDebugMock = jest
      .spyOn(torrentclear.logger, 'debug')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    //
    torrentclear.main();
    // Log Error
    expect(logErrorMock).not.toHaveBeenCalled();
    //
    expect(torrentclear.torrentProcessCount).toBe(2);
    expect(torrentclear.torrentSuccessCount).toBe(2);
    expect(torrentclear.torrentIDs).toStrictEqual([7, 9]);
  });
  it('Torrentclear - no torrent downloaded file but torrent exists', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      // console.log('execSync command:', command);
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list') {
        const result = `    ID   Done       Have  ETA           Up    Down  Ratio  Status       Name
       17   100%    2.86 GB  Unknown      0.0     0.0    3.6  Idle         NoFile.S01E01.1080p.rus.LostFilm.TV.mkv
  Sum:             2.86 GB             150.0     0.0`;
        return result;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 17 --info'
      ) {
        const result = `NAME
  Id: 7
  Name: NoFile.S01E01.1080p.rus.LostFilm.TV.mkv
  Hash: 64fab1c4a1fb9f48da1a886b252ac04b796df348
  Labels: 

TRANSFER
  State: Idle
  Location: ${normalize(`${fakeRootPath}/mnt/downloads`)}
  Percent Done: 100%
  ETA: 1 day, 7 hours (114465 seconds)
  Download Speed: 0 kB/s
  Upload Speed: 84 kB/s
  Have: 2.86 GB (2.86 GB verified)
  Availability: 100%
  Total size: 2.86 GB (2.86 GB wanted)
  Downloaded: 2.89 GB
  Uploaded: 1.92 GB
  Ratio: 3.6
  Corrupt DL: None
  Peers: connected to 16, uploading to 1, downloading from 0

HISTORY
  Date added:       Thu Apr 25 22:16:07 2024
  Date finished:    ${nowFormatedDate}
  Date started:     Thu Apr 25 22:16:07 2024
  Latest activity:  Sat Apr 27 18:47:33 2024
  Downloading Time: 4 minutes (267 seconds)
  Seeding Time:     2 days, 2 hours (180111 seconds)

ORIGINS
  Date created: Tue Apr 16 19:15:17 2024
  Public torrent: Yes
  Comment: LostFilm.TV(c)
  Creator: uTorrent/3310
  Piece Count: 682
  Piece Size: 4.00 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal
`;
        return result;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 17 --stop'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 17 --remove'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      return 'no action';
    });
    //
    logInfoMock = jest
      .spyOn(torrentclear.logger, 'info')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logDebugMock = jest
      .spyOn(torrentclear.logger, 'debug')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    jest.spyOn(torrentclear.logger, 'warn').mockImplementation();
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    //
    torrentclear.main();
    // log Info
    expect(logInfoMock).toHaveBeenNthCalledWith(4, `IDs found: 17`);
    expect(logInfoMock).toHaveBeenNthCalledWith(6, `TORRENT ID: "17" START PROCESS ...`);
    expect(logInfoMock).toHaveBeenNthCalledWith(
      8,
      `Stopping and deleting a torrent "NoFile.S01E01.1080p.rus.LostFilm.TV.mkv" by ratio limit completed successfully`
    );
    expect(logInfoMock).toHaveBeenNthCalledWith(10, `Completing the torrent verification process`);
    // log Debug
    expect(logDebugMock).toHaveBeenNthCalledWith(
      1,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      3,
      `torrent: "17   100%    2.86 GB  Unknown      0.0     0.0    3.6  Idle         NoFile.S01E01.1080p.rus.LostFilm.TV.mkv"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(4, `ID found: "17"`);
    expect(logDebugMock).toHaveBeenNthCalledWith(14, `==> ACTION: Torrent delete on Ratio Limit`);
    expect(logDebugMock).toHaveBeenNthCalledWith(16, `Stop torrent: (17) "NoFile.S01E01.1080p.rus.LostFilm.TV.mkv"`);
    expect(logDebugMock).toHaveBeenNthCalledWith(
      19,
      `Remove torrent without deleting file: (17) "NoFile.S01E01.1080p.rus.LostFilm.TV.mkv"`
    );
    // Log Error
    expect(logErrorMock).not.toHaveBeenCalled();
    //
    expect(torrentclear.torrentProcessCount).toBe(1);
    expect(torrentclear.torrentSuccessCount).toBe(1);
    expect(torrentclear.torrentIDs).toStrictEqual([17]);
  });
  it('Torrentclear - new version 4.1.0-beta.2', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      // console.log('execSync command:', command);
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list') {
        const result = `    ID   Done       Have  ETA           Up    Down  Ratio  Status       Name
       355   100%    2.86 GB  Unknown      0.0     0.0    3.5  Idle         Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv
  Sum:             4.08 GB             150.0     0.0`;
        return result;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 355 --info'
      ) {
        const result = `NAME
  Id: 4
  Name: Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv
  Hash: 79925d274e0774b1ff087c9bf8aca10977b0cfd9
  Magnet: 
  Labels: 

TRANSFER
  State: Seeding
  Location: ${normalize(`${fakeRootPath}/mnt/downloads`)}
  Sequential Download: No
  Percent Done: 100%
  ETA: 12 hours (44338 seconds)
  Download Speed: 0 B/s
  Upload Speed: 8.20 kB/s
  Have: 2.37 GB (2.37 GB verified)
  Availability: 100%
  Total size: 2.37 GB (2.37 GB wanted)
  Downloaded: 2.41 GB
  Uploaded: 9.13 GB
  Ratio: 3.84
  Peers: connected to 8, uploading to 1, downloading from 0

HISTORY
  Date added:       Sat Dec 20 12:24:22 2025
  Date finished:    Sat Dec 20 12:28:51 2025
  Date started:     Fri Dec 26 22:59:33 2025
  Latest activity:  Sat Dec 27 00:52:49 2025
  Downloading Time: 4 minutes (263 seconds)
  Seeding Time:     7 days (619056 seconds)

ORIGINS
  Date created: Fri Dec 12 22:07:14 2025
  Public torrent: Yes
  Comment: LostFilm.TV (c)
  Creator: uTorrent/3.6
  Source: LostFilm.TV
  Piece Count: 566
  Piece Size: 4 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Idle Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal

`;
        return result;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 355 --stop'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      return 'no action';
    });
    //
    jest.spyOn(torrentclear.logger, 'info').mockImplementation();
    logDebugMock = jest
      .spyOn(torrentclear.logger, 'debug')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    //
    torrentclear.main();
    //
    expect(torrentclear.torrentInfo.location).toEqual(normalize(`${fakeRootPath}/mnt/downloads`));
    expect(torrentclear.torrentInfo.percent).toEqual(100);
    expect(torrentclear.torrentInfo.ratio).toEqual(3.84);
    // log Debug
    expect(logDebugMock).toHaveBeenNthCalledWith(14, `==> ACTION: Torrent delete on Ratio Limit`);
    // Log Error
    expect(logErrorMock).toHaveBeenNthCalledWith(2, `Failed to complete torrent verification process`);
  });
});

describe('torrentclear.ts - No action tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('Torrentclear - no torrents', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list') {
        const result = `    ID   Done       Have  ETA           Up    Down  Ratio  Status       Name
Sum:                None               0.0     0.0`;
        return result;
      }
      return 'no action';
    });
    //
    logInfoMock = jest
      .spyOn(torrentclear.logger, 'info')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logDebugMock = jest
      .spyOn(torrentclear.logger, 'debug')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    //
    torrentclear.main();
    // log Info
    expect(logInfoMock).toHaveBeenNthCalledWith(4, `Torrents not found`);
    expect(logInfoMock).toHaveBeenNthCalledWith(6, `Completing the torrent verification process`);
    // log Debug
    expect(logDebugMock).toHaveBeenNthCalledWith(
      1,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list"`
    );
    // Log Error
    expect(logErrorMock).not.toHaveBeenCalled();
    //
    expect(torrentclear.torrentProcessCount).toBe(0);
    expect(torrentclear.torrentSuccessCount).toBe(0);
    expect(torrentclear.torrentIDs).toStrictEqual([]);
  });
  it('Torrentclear - no action needed', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      // console.log('execSync command:', command);
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list') {
        const result = `    ID   Done       Have  ETA           Up    Down  Ratio  Status       Name
       7   100%    2.86 GB  Unknown      0.0     0.0    0.6  Idle         Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv
       9   100%    1.23 GB  3 hrs      150.0     0.0    1.2  Idle         Star.Wars.The.Bad.Batch.S03E14.1080p.rus.LostFilm.TV.mkv
  Sum:             4.08 GB             150.0     0.0`;
        return result;
      }
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --info') {
        const result = `NAME
  Id: 7
  Name: Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv
  Hash: 64fab1c4a1fb9f48da1a886b252ac04b796df348
  Labels: 

TRANSFER
  State: Idle
  Location: ${normalize(`${fakeRootPath}/mnt/downloads`)}
  Percent Done: 100%
  ETA: 1 day, 7 hours (114465 seconds)
  Download Speed: 0 kB/s
  Upload Speed: 84 kB/s
  Have: 2.86 GB (2.86 GB verified)
  Availability: 100%
  Total size: 2.86 GB (2.86 GB wanted)
  Downloaded: 2.89 GB
  Uploaded: 1.92 GB
  Ratio: 0.6
  Corrupt DL: None
  Peers: connected to 16, uploading to 1, downloading from 0

HISTORY
  Date added:       Thu Apr 25 22:16:07 2024
  Date finished:    ${nowFormatedDate}
  Date started:     Thu Apr 25 22:16:07 2024
  Latest activity:  Sat Apr 27 18:47:33 2024
  Downloading Time: 4 minutes (267 seconds)
  Seeding Time:     2 days, 2 hours (180111 seconds)

ORIGINS
  Date created: Tue Apr 16 19:15:17 2024
  Public torrent: Yes
  Comment: LostFilm.TV(c)
  Creator: uTorrent/3310
  Piece Count: 682
  Piece Size: 4.00 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal
`;
        return result;
      }
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 9 --info') {
        const result = `NAME
  Id: 9
  Name: Star.Wars.The.Bad.Batch.S03E14.1080p.rus.LostFilm.TV.mkv
  Hash: 6ade5af6d45d44650de54480a5114ea6af3fbdfd
  Labels: 

TRANSFER
  State: Seeding
  Location: ${normalize(`${fakeRootPath}/mnt/downloads`)}
  Percent Done: 100%
  ETA: 3 hours, 48 minutes (13699 seconds)
  Download Speed: 0 kB/s
  Upload Speed: 261 kB/s
  Have: 1.23 GB (1.23 GB verified)
  Availability: 100%
  Total size: 1.23 GB (1.23 GB wanted)
  Downloaded: 1.28 GB
  Uploaded: 1.53 GB
  Ratio: 1.2
  Corrupt DL: None
  Peers: connected to 21, uploading to 3, downloading from 0

HISTORY
  Date added:       Thu Apr 25 22:16:07 2024
  Date finished:    ${nowFormatedDate}
  Date started:     Thu Apr 25 22:16:07 2024
  Latest activity:  Sat Apr 27 18:47:33 2024
  Downloading Time: 4 minutes (267 seconds)
  Seeding Time:     2 days, 2 hours (180111 seconds)

ORIGINS
  Date created: Sat Apr 27 20:50:07 2024
  Public torrent: Yes
  Comment: LostFilm.TV (c)
  Creator: uTorrent/3.6
  Piece Count: 586
  Piece Size: 2.00 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal
`;
        return result;
      }
      return 'no action';
    });
    //
    logInfoMock = jest
      .spyOn(torrentclear.logger, 'info')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logDebugMock = jest
      .spyOn(torrentclear.logger, 'debug')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    //
    torrentclear.main();
    // log Info
    expect(logInfoMock).toHaveBeenNthCalledWith(4, `IDs found: 7, 9`);
    expect(logInfoMock).toHaveBeenNthCalledWith(6, `TORRENT ID: "7" START PROCESS ...`);
    expect(logInfoMock).toHaveBeenNthCalledWith(7, `NO ACTION NEEDED (DATE AND RATIO)`);
    expect(logInfoMock).toHaveBeenNthCalledWith(9, `TORRENT ID: "9" START PROCESS ...`);
    expect(logInfoMock).toHaveBeenNthCalledWith(10, `NO ACTION NEEDED (DATE AND RATIO)`);
    expect(logInfoMock).toHaveBeenNthCalledWith(12, `Completing the torrent verification process`);
    // log Debug
    expect(logDebugMock).toHaveBeenNthCalledWith(
      1,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      3,
      `torrent: "7   100%    2.86 GB  Unknown      0.0     0.0    0.6  Idle         Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(4, `ID found: "7"`);
    expect(logDebugMock).toHaveBeenNthCalledWith(
      5,
      `torrent: "9   100%    1.23 GB  3 hrs      150.0     0.0    1.2  Idle         Star.Wars.The.Bad.Batch.S03E14.1080p.rus.LostFilm.TV.mkv"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(6, `ID found: "9"`);
    // Log Error
    expect(logErrorMock).not.toHaveBeenCalled();
    //
    expect(torrentclear.torrentProcessCount).toBe(2);
    expect(torrentclear.torrentSuccessCount).toBe(0);
    expect(torrentclear.torrentIDs).toStrictEqual([7, 9]);
  });
  it('Torrentclear - not 100% completed', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      // console.log('execSync command:', command);
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list') {
        const result = `    ID   Done       Have  ETA           Up    Down  Ratio  Status       Name
       7   66%    2.86 GB  Unknown      0.0     0.0    0.6  Idle         Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv
       9   35%    1.23 GB  3 hrs      150.0     0.0    0.3  Idle         Star.Wars.The.Bad.Batch.S03E14.1080p.rus.LostFilm.TV.mkv
  Sum:             4.08 GB             150.0     0.0`;
        return result;
      }
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --info') {
        const result = `NAME
  Id: 7
  Name: Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv
  Hash: 64fab1c4a1fb9f48da1a886b252ac04b796df348
  Labels: 

TRANSFER
  State: Idle
  Location: ${normalize(`${fakeRootPath}/mnt/downloads`)}
  Percent Done: 66%
  ETA: 1 day, 7 hours (114465 seconds)
  Download Speed: 0 kB/s
  Upload Speed: 84 kB/s
  Have: 2.86 GB (2.86 GB verified)
  Availability: 66%
  Total size: 2.86 GB (2.86 GB wanted)
  Downloaded: 2.89 GB
  Uploaded: 1.92 GB
  Ratio: 3.5
  Corrupt DL: None
  Peers: connected to 16, uploading to 1, downloading from 0

HISTORY
  Date added:       Thu Apr 25 22:16:07 2024
  Date finished:    Thu Apr 25 22:20:32 2024
  Date started:     Thu Apr 25 22:16:07 2024
  Latest activity:  Sat Apr 27 18:47:33 2024
  Downloading Time: 4 minutes (267 seconds)
  Seeding Time:     2 days, 2 hours (180111 seconds)

ORIGINS
  Date created: Tue Apr 16 19:15:17 2024
  Public torrent: Yes
  Comment: LostFilm.TV(c)
  Creator: uTorrent/3310
  Piece Count: 682
  Piece Size: 4.00 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal
`;
        return result;
      }
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 9 --info') {
        const result = `NAME
  Id: 9
  Name: Star.Wars.The.Bad.Batch.S03E14.1080p.rus.LostFilm.TV.mkv
  Hash: 6ade5af6d45d44650de54480a5114ea6af3fbdfd
  Labels: 

TRANSFER
  State: Seeding
  Location: ${normalize(`${fakeRootPath}/mnt/downloads`)}
  Percent Done: 35%
  ETA: 3 hours, 48 minutes (13699 seconds)
  Download Speed: 0 kB/s
  Upload Speed: 261 kB/s
  Have: 1.23 GB (1.23 GB verified)
  Availability: 35%
  Total size: 1.23 GB (1.23 GB wanted)
  Downloaded: 1.28 GB
  Uploaded: 1.53 GB
  Ratio: 3.3
  Corrupt DL: None
  Peers: connected to 21, uploading to 3, downloading from 0

HISTORY
  Date added:       Thu Apr 25 22:16:07 2024
  Date finished:    Thu Apr 25 22:20:32 2024
  Date started:     Thu Apr 25 22:16:07 2024
  Latest activity:  Sat Apr 27 18:47:33 2024
  Downloading Time: 4 minutes (267 seconds)
  Seeding Time:     2 days, 2 hours (180111 seconds)

ORIGINS
  Date created: Sat Apr 27 20:50:07 2024
  Public torrent: Yes
  Comment: LostFilm.TV (c)
  Creator: uTorrent/3.6
  Piece Count: 586
  Piece Size: 2.00 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal
`;
        return result;
      }
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --stop') {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 9 --stop') {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --remove'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 9 --remove'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      return 'no action';
    });
    //
    logInfoMock = jest
      .spyOn(torrentclear.logger, 'info')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logDebugMock = jest
      .spyOn(torrentclear.logger, 'debug')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    //
    torrentclear.main();
    // log Info
    expect(logInfoMock).toHaveBeenNthCalledWith(4, `IDs found: 7, 9`);
    expect(logInfoMock).toHaveBeenNthCalledWith(6, `TORRENT ID: "7" START PROCESS ...`);
    expect(logInfoMock).toHaveBeenNthCalledWith(7, `NO ACTION NEEDED (< 100)`);
    expect(logInfoMock).toHaveBeenNthCalledWith(9, `TORRENT ID: "9" START PROCESS ...`);
    expect(logInfoMock).toHaveBeenNthCalledWith(10, `NO ACTION NEEDED (< 100)`);
    expect(logInfoMock).toHaveBeenNthCalledWith(12, `Completing the torrent verification process`);
    // Log Error
    expect(logErrorMock).not.toHaveBeenCalled();
    //
    expect(torrentclear.torrentProcessCount).toBe(2);
    expect(torrentclear.torrentSuccessCount).toBe(0);
    expect(torrentclear.torrentIDs).toStrictEqual([7, 9]);
  });
  it('Torrentclear - Torrent no file or directory', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      // console.log('execSync command:', command);
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list') {
        const result = `    ID   Done       Have  ETA           Up    Down  Ratio  Status       Name
       7   100%    2.86 GB  Unknown      0.0     0.0    3.6  Idle         Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv
  Sum:             4.08 GB             150.0     0.0`;
        return result;
      }
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --info') {
        const result = `NAME
  Id: 7
  Name: Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv
  Hash: 64fab1c4a1fb9f48da1a886b252ac04b796df348
  Labels: 

TRANSFER
  State: Idle
  Location: ${normalize(`${fakeRootPath}/mnt/downloads`)}
  Percent Done: 100%
  ETA: 1 day, 7 hours (114465 seconds)
  Download Speed: 0 kB/s
  Upload Speed: 84 kB/s
  Have: 2.86 GB (2.86 GB verified)
  Availability: 100%
  Total size: 2.86 GB (2.86 GB wanted)
  Downloaded: 2.89 GB
  Uploaded: 1.92 GB
  Ratio: 3.6
  Corrupt DL: None
  Peers: connected to 16, uploading to 1, downloading from 0

HISTORY
  Date added:       Thu Apr 25 22:16:07 2024
  Date finished:    ${nowFormatedDate}
  Date started:     Thu Apr 25 22:16:07 2024
  Latest activity:  Sat Apr 27 18:47:33 2024
  Downloading Time: 4 minutes (267 seconds)
  Seeding Time:     2 days, 2 hours (180111 seconds)

ORIGINS
  Date created: Tue Apr 16 19:15:17 2024
  Public torrent: Yes
  Comment: LostFilm.TV(c)
  Creator: uTorrent/3310
  Piece Count: 682
  Piece Size: 4.00 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal
`;
        return result;
      }
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --stop') {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --remove'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      return 'no action';
    });
    const isFileMock = jest.spyOn(Stats.prototype, 'isFile').mockReturnValue(false);
    const isDirectoryMock = jest.spyOn(Stats.prototype, 'isDirectory').mockReturnValue(false);
    //
    logInfoMock = jest
      .spyOn(torrentclear.logger, 'info')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logDebugMock = jest
      .spyOn(torrentclear.logger, 'debug')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    //
    torrentclear.main();
    // log Info
    expect(logInfoMock).toHaveBeenNthCalledWith(4, `IDs found: 7`);
    expect(logInfoMock).toHaveBeenNthCalledWith(6, `TORRENT ID: "7" START PROCESS ...`);
    expect(logInfoMock).toHaveBeenNthCalledWith(
      8,
      `Stopping and deleting a torrent "Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv" by ratio limit completed successfully`
    );
    // log Debug
    expect(logDebugMock).toHaveBeenNthCalledWith(
      1,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      3,
      `torrent: "7   100%    2.86 GB  Unknown      0.0     0.0    3.6  Idle         Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(4, `ID found: "7"`);
    expect(logDebugMock).toHaveBeenNthCalledWith(14, `==> ACTION: Torrent delete on Ratio Limit`);
    expect(logDebugMock).toHaveBeenNthCalledWith(
      16,
      `Torrent: "Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv" is neither a file or a directory`
    );
    // Log Error
    expect(logErrorMock).not.toHaveBeenCalled();
    //
    expect(torrentclear.torrentProcessCount).toBe(1);
    expect(torrentclear.torrentSuccessCount).toBe(1);
    expect(torrentclear.torrentIDs).toStrictEqual([7]);
    //
    isFileMock.mockRestore();
    isDirectoryMock.mockRestore();
  });
});

describe('torrentclear.ts - Error tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('Torrentclear - Error torrents list command', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      // console.log('execSync command:', command);
      throw new Error(`error execSync command`);
    });
    //
    logInfoMock = jest
      .spyOn(torrentclear.logger, 'info')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logDebugMock = jest
      .spyOn(torrentclear.logger, 'debug')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    //
    torrentclear.main();
    // log Debug
    expect(logDebugMock).toHaveBeenNthCalledWith(
      1,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list"`
    );
    // Log Error
    expect(logErrorMock).toHaveBeenNthCalledWith(1, `error execSync command`);
    expect(logErrorMock).toHaveBeenNthCalledWith(2, `Failed to complete torrent verification process`);
    //
    expect(torrentclear.torrentProcessCount).toBe(0);
    expect(torrentclear.torrentSuccessCount).toBe(0);
    expect(torrentclear.torrentIDs).toStrictEqual([]);
  });
  it('Torrentclear - Error stop torrent command', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      // console.log('execSync command:', command);
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list') {
        const result = `    ID   Done       Have  ETA           Up    Down  Ratio  Status       Name
       7   100%    2.86 GB  Unknown      0.0     0.0    3.6  Idle         Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv
  Sum:             4.08 GB             150.0     0.0`;
        return result;
      }
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --info') {
        const result = `NAME
  Id: 7
  Name: Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv
  Hash: 64fab1c4a1fb9f48da1a886b252ac04b796df348
  Labels: 

TRANSFER
  State: Idle
  Location: ${normalize(`${fakeRootPath}/mnt/downloads`)}
  Percent Done: 100%
  ETA: 1 day, 7 hours (114465 seconds)
  Download Speed: 0 kB/s
  Upload Speed: 84 kB/s
  Have: 2.86 GB (2.86 GB verified)
  Availability: 100%
  Total size: 2.86 GB (2.86 GB wanted)
  Downloaded: 2.89 GB
  Uploaded: 1.92 GB
  Ratio: 3.6
  Corrupt DL: None
  Peers: connected to 16, uploading to 1, downloading from 0

HISTORY
  Date added:       Thu Apr 25 22:16:07 2024
  Date finished:    ${nowFormatedDate}
  Date started:     Thu Apr 25 22:16:07 2024
  Latest activity:  Sat Apr 27 18:47:33 2024
  Downloading Time: 4 minutes (267 seconds)
  Seeding Time:     2 days, 2 hours (180111 seconds)

ORIGINS
  Date created: Tue Apr 16 19:15:17 2024
  Public torrent: Yes
  Comment: LostFilm.TV(c)
  Creator: uTorrent/3310
  Piece Count: 682
  Piece Size: 4.00 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal
`;
        return result;
      }
      return 'no action';
    });
    //
    logInfoMock = jest
      .spyOn(torrentclear.logger, 'info')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logDebugMock = jest
      .spyOn(torrentclear.logger, 'debug')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    //
    torrentclear.main();
    // log Info
    expect(logInfoMock).toHaveBeenNthCalledWith(4, `IDs found: 7`);
    expect(logInfoMock).toHaveBeenNthCalledWith(6, `TORRENT ID: "7" START PROCESS ...`);
    expect(logInfoMock).toHaveBeenNthCalledWith(8, `Torrent: "Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv" is a FILE`);
    // log Debug
    expect(logDebugMock).toHaveBeenNthCalledWith(
      1,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      3,
      `torrent: "7   100%    2.86 GB  Unknown      0.0     0.0    3.6  Idle         Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(4, `ID found: "7"`);
    expect(logDebugMock).toHaveBeenNthCalledWith(14, `==> ACTION: Torrent delete on Ratio Limit`);
    expect(logDebugMock).toHaveBeenNthCalledWith(18, `execResultStop: no action`);
    // Log Error
    expect(logErrorMock).toHaveBeenNthCalledWith(
      1,
      `Failed to stop torrent (7) "Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv". Reason: Negative result of exec command: no action`
    );
    expect(logErrorMock).toHaveBeenNthCalledWith(2, `Failed to complete torrent verification process`);
    //
    expect(torrentclear.torrentProcessCount).toBe(1);
    expect(torrentclear.torrentSuccessCount).toBe(0);
    expect(torrentclear.torrentIDs).toStrictEqual([7]);
  });
  it('Torrentclear - Error remove torrent command', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      // console.log('execSync command:', command);
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list') {
        const result = `    ID   Done       Have  ETA           Up    Down  Ratio  Status       Name
       7   100%    2.86 GB  Unknown      0.0     0.0    3.6  Idle         Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv
  Sum:             4.08 GB             150.0     0.0`;
        return result;
      }
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --info') {
        const result = `NAME
  Id: 7
  Name: Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv
  Hash: 64fab1c4a1fb9f48da1a886b252ac04b796df348
  Labels: 

TRANSFER
  State: Idle
  Location: ${normalize(`${fakeRootPath}/mnt/downloads`)}
  Percent Done: 100%
  ETA: 1 day, 7 hours (114465 seconds)
  Download Speed: 0 kB/s
  Upload Speed: 84 kB/s
  Have: 2.86 GB (2.86 GB verified)
  Availability: 100%
  Total size: 2.86 GB (2.86 GB wanted)
  Downloaded: 2.89 GB
  Uploaded: 1.92 GB
  Ratio: 3.6
  Corrupt DL: None
  Peers: connected to 16, uploading to 1, downloading from 0

HISTORY
  Date added:       Thu Apr 25 22:16:07 2024
  Date finished:    ${nowFormatedDate}
  Date started:     Thu Apr 25 22:16:07 2024
  Latest activity:  Sat Apr 27 18:47:33 2024
  Downloading Time: 4 minutes (267 seconds)
  Seeding Time:     2 days, 2 hours (180111 seconds)

ORIGINS
  Date created: Tue Apr 16 19:15:17 2024
  Public torrent: Yes
  Comment: LostFilm.TV(c)
  Creator: uTorrent/3310
  Piece Count: 682
  Piece Size: 4.00 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal
`;
        return result;
      }
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --stop') {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      return 'no action';
    });
    //
    logInfoMock = jest
      .spyOn(torrentclear.logger, 'info')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logDebugMock = jest
      .spyOn(torrentclear.logger, 'debug')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    //
    torrentclear.main();
    // log Info
    expect(logInfoMock).toHaveBeenNthCalledWith(4, `IDs found: 7`);
    expect(logInfoMock).toHaveBeenNthCalledWith(6, `TORRENT ID: "7" START PROCESS ...`);
    expect(logInfoMock).toHaveBeenNthCalledWith(8, `Torrent: "Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv" is a FILE`);
    // log Debug
    expect(logDebugMock).toHaveBeenNthCalledWith(
      1,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      3,
      `torrent: "7   100%    2.86 GB  Unknown      0.0     0.0    3.6  Idle         Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(4, `ID found: "7"`);
    expect(logDebugMock).toHaveBeenNthCalledWith(14, `==> ACTION: Torrent delete on Ratio Limit`);
    expect(logDebugMock).toHaveBeenNthCalledWith(21, `execResultRemove: no action`);
    // Log Error
    expect(logErrorMock).toHaveBeenNthCalledWith(
      1,
      `Failed to remove (no del) torrent (7) "Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv". Reason: Negative result of exec command: no action`
    );
    expect(logErrorMock).toHaveBeenNthCalledWith(2, `Failed to complete torrent verification process`);
    //
    expect(torrentclear.torrentProcessCount).toBe(1);
    expect(torrentclear.torrentSuccessCount).toBe(0);
    expect(torrentclear.torrentIDs).toStrictEqual([7]);
  });
  it('Torrentclear - Error remove and delete torrent command', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      // console.log('execSync command:', command);
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list') {
        const result = `ID     Done       Have  ETA           Up    Down  Ratio  Status       Name
  35   100%   22.11 GB  12 days      0.0     0.0    0.0  Seeding      Шерлок Холмс S01 Serial WEB-DL (1080p)
Sum:          24.08 GB              15.0  18007.0`;
        return result;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --info'
      ) {
        const result = `NAME
  Id: 35
  Name: Шерлок Холмс S01 Serial WEB-DL (1080p)
  Hash: 64fab1c4a1fb9f48da1a886b252ac04b796df348
  Labels: 

TRANSFER
  State: Idle
  Location: ${normalize(`${fakeRootPath}/mnt/downloads`)}
  Percent Done: 100%
  ETA: 0 seconds (0 seconds)
  Download Speed: 0 kB/s
  Upload Speed: 0 kB/s
  Have: 2.86 GB (2.86 GB verified)
  Availability: 100%
  Total size: 2.86 GB (2.86 GB wanted)
  Downloaded: 2.89 GB
  Uploaded: 1.81 GB
  Ratio: 3.6
  Corrupt DL: None
  Peers: connected to 4, uploading to 0, downloading from 0

HISTORY
  Date added:       Thu Apr 25 22:16:07 2024
  Date finished:    Thu Apr 25 22:20:32 2024
  Date started:     Thu Apr 25 22:16:07 2024
  Latest activity:  Sat Apr 27 18:47:33 2024
  Downloading Time: 4 minutes (267 seconds)
  Seeding Time:     2 days, 2 hours (180111 seconds)

ORIGINS
  Date created: Tue Apr 16 19:15:17 2024
  Public torrent: Yes
  Comment: LostFilm.TV(c)
  Creator: uTorrent/3310
  Piece Count: 682
  Piece Size: 4.00 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal
`;
        return result;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --stop'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      return 'no action';
    });
    //
    logInfoMock = jest
      .spyOn(torrentclear.logger, 'info')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logDebugMock = jest
      .spyOn(torrentclear.logger, 'debug')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    //
    torrentclear.main();
    // log Info
    expect(logInfoMock).toHaveBeenNthCalledWith(4, `IDs found: 35`);
    expect(logInfoMock).toHaveBeenNthCalledWith(6, `TORRENT ID: "35" START PROCESS ...`);
    expect(logInfoMock).toHaveBeenNthCalledWith(8, `Torrent: "Шерлок Холмс S01 Serial WEB-DL (1080p)" is a DIRECTORY`);
    // log Debug
    expect(logDebugMock).toHaveBeenNthCalledWith(
      1,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      3,
      `torrent: "35   100%   22.11 GB  12 days      0.0     0.0    0.0  Seeding      Шерлок Холмс S01 Serial WEB-DL (1080p)"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(4, `ID found: "35"`);
    expect(logDebugMock).toHaveBeenNthCalledWith(14, `==> ACTION: Torrent delete on Ratio Limit`);
    expect(logDebugMock).toHaveBeenNthCalledWith(21, `execResultRemoveAndDelete: no action`);
    // Log Error
    expect(logErrorMock).toHaveBeenNthCalledWith(
      1,
      `Failed to remove and delete torrent (35) "Шерлок Холмс S01 Serial WEB-DL (1080p)". Reason: Negative result of exec command: no action`
    );
    expect(logErrorMock).toHaveBeenNthCalledWith(2, `Failed to complete torrent verification process`);
    //
    expect(torrentclear.torrentProcessCount).toBe(1);
    expect(torrentclear.torrentSuccessCount).toBe(0);
    expect(torrentclear.torrentIDs).toStrictEqual([35]);
  });
  it('Torrentclear - Error torrent information data (name, state, etc.)', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      // console.log('execSync command:', command);
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list') {
        const result = `    ID   Done       Have  ETA           Up    Down  Ratio  Status       Name
       7   100%    2.86 GB  Unknown      0.0     0.0    3.6  Idle         Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv
  Sum:             4.08 GB             150.0     0.0`;
        return result;
      }
      return 'no action';
    });
    //
    logInfoMock = jest
      .spyOn(torrentclear.logger, 'info')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logDebugMock = jest
      .spyOn(torrentclear.logger, 'debug')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    //
    torrentclear.main();
    // log Info
    expect(logInfoMock).toHaveBeenNthCalledWith(4, `IDs found: 7`);
    expect(logInfoMock).toHaveBeenNthCalledWith(6, `TORRENT ID: "7" START PROCESS ...`);
    // log Debug
    expect(logDebugMock).toHaveBeenNthCalledWith(
      1,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(
      3,
      `torrent: "7   100%    2.86 GB  Unknown      0.0     0.0    3.6  Idle         Beacon.23.S02E02.1080p.rus.LostFilm.TV.mkv"`
    );
    expect(logDebugMock).toHaveBeenNthCalledWith(4, `ID found: "7"`);
    expect(logDebugMock).toHaveBeenNthCalledWith(
      5,
      `Run command: "transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 7 --info"`
    );
    // Log Error
    expect(logErrorMock).toHaveBeenNthCalledWith(1, `Torrent info data is EMPTY`);
    expect(logErrorMock).toHaveBeenNthCalledWith(2, `Failed to complete torrent verification process`);
    //
    expect(torrentclear.torrentProcessCount).toBe(1);
    expect(torrentclear.torrentSuccessCount).toBe(0);
    expect(torrentclear.torrentIDs).toStrictEqual([7]);
  });
  it('Torrentclear - Error torrent name not found', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    const execSyncMock = jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list') {
        const result = `ID     Done       Have  ETA           Up    Down  Ratio  Status       Name
  35   100%   22.11 GB  12 days      0.0     0.0    0.0  Seeding      Шерлок Холмс S01 Serial WEB-DL (1080p)
Sum:          24.08 GB              15.0  18007.0`;
        return result;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --info'
      ) {
        const result = `NAME
  Id: 35
  Name: 
  Hash: 64fab1c4a1fb9f48da1a886b252ac04b796df348
  Labels: 

TRANSFER
  State: Idle
  Location: ${normalize(`${fakeRootPath}/mnt/downloads`)}
  Percent Done: 100%
  ETA: 0 seconds (0 seconds)
  Download Speed: 0 kB/s
  Upload Speed: 0 kB/s
  Have: 2.86 GB (2.86 GB verified)
  Availability: 100%
  Total size: 2.86 GB (2.86 GB wanted)
  Downloaded: 2.89 GB
  Uploaded: 1.81 GB
  Ratio: 0.6
  Corrupt DL: None
  Peers: connected to 4, uploading to 0, downloading from 0

HISTORY
  Date added:       Thu Apr 25 22:16:07 2024
  Date finished:    Thu Apr 25 22:20:32 2024
  Date started:     Thu Apr 25 22:16:07 2024
  Latest activity:  Sat Apr 27 18:47:33 2024
  Downloading Time: 4 minutes (267 seconds)
  Seeding Time:     2 days, 2 hours (180111 seconds)

ORIGINS
  Date created: Tue Apr 16 19:15:17 2024
  Public torrent: Yes
  Comment: LostFilm.TV(c)
  Creator: uTorrent/3310
  Piece Count: 682
  Piece Size: 4.00 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal
`;
        return result;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --stop'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      if (
        command ===
        'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --remove-and-delete'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      return 'no action';
    });
    //
    jest.spyOn(torrentclear.logger, 'info').mockImplementation();
    jest.spyOn(torrentclear.logger, 'debug').mockImplementation();
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    //
    torrentclear.main();
    // Log Error
    expect(logErrorMock).toHaveBeenNthCalledWith(1, `Torrent name not found in torrent info: "35"`);
    expect(logErrorMock).toHaveBeenNthCalledWith(2, `Failed to complete torrent verification process`);
    //
    execSyncMock.mockRestore();
  });
  it('Torrentclear - Error torrent state not found', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    const execSyncMock = jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list') {
        const result = `ID     Done       Have  ETA           Up    Down  Ratio  Status       Name
  35   100%   22.11 GB  12 days      0.0     0.0    0.0  Seeding      Шерлок Холмс S01 Serial WEB-DL (1080p)
Sum:          24.08 GB              15.0  18007.0`;
        return result;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --info'
      ) {
        const result = `NAME
  Id: 35
  Name: Шерлок Холмс S01 Serial WEB-DL (1080p)
  Hash: 64fab1c4a1fb9f48da1a886b252ac04b796df348
  Labels: 

TRANSFER
  State: 
  Location: ${normalize(`${fakeRootPath}/mnt/downloads`)}
  Percent Done: 100%
  ETA: 0 seconds (0 seconds)
  Download Speed: 0 kB/s
  Upload Speed: 0 kB/s
  Have: 2.86 GB (2.86 GB verified)
  Availability: 100%
  Total size: 2.86 GB (2.86 GB wanted)
  Downloaded: 2.89 GB
  Uploaded: 1.81 GB
  Ratio: 0.6
  Corrupt DL: None
  Peers: connected to 4, uploading to 0, downloading from 0

HISTORY
  Date added:       Thu Apr 25 22:16:07 2024
  Date finished:    Thu Apr 25 22:20:32 2024
  Date started:     Thu Apr 25 22:16:07 2024
  Latest activity:  Sat Apr 27 18:47:33 2024
  Downloading Time: 4 minutes (267 seconds)
  Seeding Time:     2 days, 2 hours (180111 seconds)

ORIGINS
  Date created: Tue Apr 16 19:15:17 2024
  Public torrent: Yes
  Comment: LostFilm.TV(c)
  Creator: uTorrent/3310
  Piece Count: 682
  Piece Size: 4.00 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal
`;
        return result;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --stop'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      if (
        command ===
        'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --remove-and-delete'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      return 'no action';
    });
    //
    jest.spyOn(torrentclear.logger, 'info').mockImplementation();
    jest.spyOn(torrentclear.logger, 'debug').mockImplementation();
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    //
    torrentclear.main();
    // Log Error
    expect(logErrorMock).toHaveBeenNthCalledWith(1, `Torrent state not found in torrent info: "35"`);
    expect(logErrorMock).toHaveBeenNthCalledWith(2, `Failed to complete torrent verification process`);
    //
    execSyncMock.mockRestore();
  });
  it('Torrentclear - Error torrent location not found', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    const execSyncMock = jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list') {
        const result = `ID     Done       Have  ETA           Up    Down  Ratio  Status       Name
  35   100%   22.11 GB  12 days      0.0     0.0    0.0  Seeding      Шерлок Холмс S01 Serial WEB-DL (1080p)
Sum:          24.08 GB              15.0  18007.0`;
        return result;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --info'
      ) {
        const result = `NAME
  Id: 35
  Name: Шерлок Холмс S01 Serial WEB-DL (1080p)
  Hash: 64fab1c4a1fb9f48da1a886b252ac04b796df348
  Labels: 

TRANSFER
  State: Idle
  Location: 
  Percent Done: 100%
  ETA: 0 seconds (0 seconds)
  Download Speed: 0 kB/s
  Upload Speed: 0 kB/s
  Have: 2.86 GB (2.86 GB verified)
  Availability: 100%
  Total size: 2.86 GB (2.86 GB wanted)
  Downloaded: 2.89 GB
  Uploaded: 1.81 GB
  Ratio: 0.6
  Corrupt DL: None
  Peers: connected to 4, uploading to 0, downloading from 0

HISTORY
  Date added:       Thu Apr 25 22:16:07 2024
  Date finished:    Thu Apr 25 22:20:32 2024
  Date started:     Thu Apr 25 22:16:07 2024
  Latest activity:  Sat Apr 27 18:47:33 2024
  Downloading Time: 4 minutes (267 seconds)
  Seeding Time:     2 days, 2 hours (180111 seconds)

ORIGINS
  Date created: Tue Apr 16 19:15:17 2024
  Public torrent: Yes
  Comment: LostFilm.TV(c)
  Creator: uTorrent/3310
  Piece Count: 682
  Piece Size: 4.00 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal
`;
        return result;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --stop'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      if (
        command ===
        'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --remove-and-delete'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      return 'no action';
    });
    //
    jest.spyOn(torrentclear.logger, 'info').mockImplementation();
    jest.spyOn(torrentclear.logger, 'debug').mockImplementation();
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    //
    torrentclear.main();
    // Log Error
    expect(logErrorMock).toHaveBeenNthCalledWith(1, `Torrent location not found in torrent info: "35"`);
    expect(logErrorMock).toHaveBeenNthCalledWith(2, `Failed to complete torrent verification process`);
    //
    execSyncMock.mockRestore();
  });
  it('Torrentclear - Error date done not found', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    const execSyncMock = jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list') {
        const result = `ID     Done       Have  ETA           Up    Down  Ratio  Status       Name
  35   100%   22.11 GB  12 days      0.0     0.0    0.0  Seeding      Шерлок Холмс S01 Serial WEB-DL (1080p)
Sum:          24.08 GB              15.0  18007.0`;
        return result;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --info'
      ) {
        const result = `NAME
  Id: 35
  Name: Шерлок Холмс S01 Serial WEB-DL (1080p)
  Hash: 64fab1c4a1fb9f48da1a886b252ac04b796df348
  Labels: 

TRANSFER
  State: Idle
  Location: ${normalize(`${fakeRootPath}/mnt/downloads`)}
  Percent Done: 100%
  ETA: 0 seconds (0 seconds)
  Download Speed: 0 kB/s
  Upload Speed: 0 kB/s
  Have: 2.86 GB (2.86 GB verified)
  Availability: 100%
  Total size: 2.86 GB (2.86 GB wanted)
  Downloaded: 2.89 GB
  Uploaded: 1.81 GB
  Ratio: 0.6
  Corrupt DL: None
  Peers: connected to 4, uploading to 0, downloading from 0

HISTORY
  Date added:       Thu Apr 25 22:16:07 2024
  Date finished:    
  Date started:     Thu Apr 25 22:16:07 2024
  Latest activity:  Sat Apr 27 18:47:33 2024
  Downloading Time: 4 minutes (267 seconds)
  Seeding Time:     2 days, 2 hours (180111 seconds)

ORIGINS
  Date created: Tue Apr 16 19:15:17 2024
  Public torrent: Yes
  Comment: LostFilm.TV(c)
  Creator: uTorrent/3310
  Piece Count: 682
  Piece Size: 4.00 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal
`;
        return result;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --stop'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      if (
        command ===
        'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --remove-and-delete'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      return 'no action';
    });
    //
    jest.spyOn(torrentclear.logger, 'info').mockImplementation();
    jest.spyOn(torrentclear.logger, 'debug').mockImplementation();
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    //
    torrentclear.main();
    // Log Error
    expect(logErrorMock).toHaveBeenNthCalledWith(1, `Torrent date done not found in torrent info: "35"`);
    expect(logErrorMock).toHaveBeenNthCalledWith(2, `Failed to complete torrent verification process`);
    //
    execSyncMock.mockRestore();
  });
});

// Error torrent is simlink (unlikely...)

// main() throw error
// - clearProcess throw error
// -- getIDs throw error
// -- or checkTorrents throw error

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// PARANOID TESTS
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

describe('torrentclear.ts - deep tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('Torrentclear - Throw Error isFileOrDirectoryOrUnknown', () => {
    const torrentclear: Torrentclear = new Torrentclear(fakeRootPath);
    //
    jest.spyOn(cproc, 'execSync').mockImplementation((command: string, _options: any): any => {
      // console.log('execSync command:', command);
      if (command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --list') {
        const result = `ID     Done       Have  ETA           Up    Down  Ratio  Status       Name
  35   100%   22.11 GB  12 days      0.0     0.0    0.0  Seeding      Шерлок Холмс S01 Serial WEB-DL (1080p)
Sum:          24.08 GB              15.0  18007.0`;
        return result;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --info'
      ) {
        const result = `NAME
  Id: 35
  Name: Шерлок Холмс S01 Serial WEB-DL (1080p)
  Hash: 64fab1c4a1fb9f48da1a886b252ac04b796df348
  Labels: 

TRANSFER
  State: Idle
  Location: ${normalize(`${fakeRootPath}/mnt/downloads`)}
  Percent Done: 100%
  ETA: 0 seconds (0 seconds)
  Download Speed: 0 kB/s
  Upload Speed: 0 kB/s
  Have: 2.86 GB (2.86 GB verified)
  Availability: 100%
  Total size: 2.86 GB (2.86 GB wanted)
  Downloaded: 2.89 GB
  Uploaded: 1.81 GB
  Ratio: 3.6
  Corrupt DL: None
  Peers: connected to 4, uploading to 0, downloading from 0

HISTORY
  Date added:       Thu Apr 25 22:16:07 2024
  Date finished:    Thu Apr 25 22:20:32 2024
  Date started:     Thu Apr 25 22:16:07 2024
  Latest activity:  Sat Apr 27 18:47:33 2024
  Downloading Time: 4 minutes (267 seconds)
  Seeding Time:     2 days, 2 hours (180111 seconds)

ORIGINS
  Date created: Tue Apr 16 19:15:17 2024
  Public torrent: Yes
  Comment: LostFilm.TV(c)
  Creator: uTorrent/3310
  Piece Count: 682
  Piece Size: 4.00 MiB

LIMITS & BANDWIDTH
  Download Limit: Unlimited
  Upload Limit: Unlimited
  Ratio Limit: Default
  Honors Session Limits: Yes
  Peer limit: 50
  Bandwidth Priority: Normal
`;
        return result;
      }
      if (
        command === 'transmission-remote 192.168.88.22:9092 --auth test_dev:1234567890123456789 --torrent 35 --stop'
      ) {
        return `192.168.88.22:9092/transmission/rpc/\nresponded: "success"`;
      }
      return 'no action';
    });
    //
    const lstatSyncMock = jest.spyOn(fs, 'lstatSync').mockImplementation(() => {
      throw new Error('lstatSync error emulation');
    });
    //
    jest.spyOn(torrentclear.logger, 'info').mockImplementation();
    jest.spyOn(torrentclear.logger, 'debug').mockImplementation();
    jest.spyOn(torrentclear.logger, 'trace').mockImplementation();
    logErrorMock = jest
      .spyOn(torrentclear.logger, 'error')
      .mockImplementation((_level: string | Level, ...args: any[]): any => {
        return args;
      });
    //
    torrentclear.main();
    // Log Error
    expect(logErrorMock).toHaveBeenNthCalledWith(1, `lstatSync error emulation`);
    expect(logErrorMock).toHaveBeenNthCalledWith(2, `Failed to complete torrent verification process`);
    //
    lstatSyncMock.mockRestore();
  });
});
