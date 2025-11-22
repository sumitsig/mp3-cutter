/**
 * Decodes an ArrayBuffer into an AudioBuffer
 */
export const decodeAudioData = async (arrayBuffer: ArrayBuffer, context: AudioContext): Promise<AudioBuffer> => {
  return await context.decodeAudioData(arrayBuffer);
};

/**
 * Slices an AudioBuffer from start to end (seconds)
 */
export const sliceAudioBuffer = (buffer: AudioBuffer, start: number, end: number, context: AudioContext): AudioBuffer => {
  const sampleRate = buffer.sampleRate;
  const startSample = Math.floor(start * sampleRate);
  const endSample = Math.floor(end * sampleRate);
  const frameCount = endSample - startSample;

  if (frameCount <= 0) {
    // Return empty small buffer to prevent crash
    return context.createBuffer(buffer.numberOfChannels, 1, sampleRate);
  }

  const newBuffer = context.createBuffer(buffer.numberOfChannels, frameCount, sampleRate);

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    const channelData = buffer.getChannelData(i);
    const newChannelData = newBuffer.getChannelData(i);
    // Copy the slice
    for (let j = 0; j < frameCount; j++) {
      newChannelData[j] = channelData[startSample + j] || 0;
    }
  }

  return newBuffer;
};

/**
 * Joins multiple AudioBuffers sequentially
 */
export const joinAudioBuffers = (buffers: AudioBuffer[], context: AudioContext): AudioBuffer => {
  if (buffers.length === 0) {
    return context.createBuffer(1, 1, 44100);
  }

  const numberOfChannels = Math.max(...buffers.map(b => b.numberOfChannels));
  const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
  const sampleRate = buffers[0].sampleRate; // Assuming all have same sample rate for simplicity

  const newBuffer = context.createBuffer(numberOfChannels, totalLength, sampleRate);

  for (let i = 0; i < numberOfChannels; i++) {
    const channelData = newBuffer.getChannelData(i);
    let offset = 0;
    buffers.forEach(buffer => {
      // Handle mono to stereo mixing if needed (simplistic approach: duplicate mono to stereo channels if source has fewer channels)
      // For this tool, we assume we copy channel i if it exists, else copy channel 0
      const sourceChannel = buffer.numberOfChannels > i ? buffer.getChannelData(i) : buffer.getChannelData(0);
      channelData.set(sourceChannel, offset);
      offset += buffer.length;
    });
  }

  return newBuffer;
};

/**
 * Converts AudioBuffer to WAV Blob
 * Adapted from standard audioBufferToWav implementations
 */
export const bufferToWav = (buffer: AudioBuffer): Blob => {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let i: number;
  let sample: number;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this example)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < buffer.length) {
    for (i = 0; i < numOfChan; i++) {
      // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(44 + offset, sample, true);
      offset += 2;
    }
    pos++;
  }

  return new Blob([bufferArray], { type: 'audio/wav' });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
};