/// <reference types="node" />

import { type Configuration } from 'log4js';

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Logger
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export type ServerLoggerConfiguration = Configuration;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Torrentclear
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface TorrentInfoI {
  /**
   * Example: `999`
   */
  id: number;
  /**
   * Example: `Warrior.Nun.S02E03.1080p.rus.LostFilm.TV.mkv`
   */
  name: string;
  /**
   * Variants: [ `Idle` | `Seeding` | `Finished` ]
   */
  state: string;
  /**
   * Example: `/mnt/data/download`
   */
  location: string;
  /**
   * Example: `100`
   */
  percent: number;
  /**
   * Example: `1.2`
   */
  ratio: number;
  /**
   * Example: `Tue Nov 22 23:58:52 2022`
   */
  dateDone: string;
  /**
   * Date difference. Now date - torrent date.
   * Example: `123456` (seconds)
   */
  dateDifference: number;
}

export interface FileOrDirsStateI {
  FILE: number;
  DIR: number;
  NOTFOUND: number;
  UNKNOWN: number;
}
