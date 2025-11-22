export interface AudioFile {
  name: string;
  buffer: AudioBuffer;
  duration: number;
}

export interface Clip {
  id: string;
  name: string;
  buffer: AudioBuffer;
  blob?: Blob;
}

export interface Selection {
  start: number; // seconds
  end: number; // seconds
}

export enum PlayerState {
  STOPPED = 'STOPPED',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED'
}