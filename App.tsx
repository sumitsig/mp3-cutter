import React, { useState, useEffect, useRef } from 'react';
import { Upload, Music, Layers } from 'lucide-react';
import WaveformEditor from './components/WaveformEditor';
import ClipManager from './components/ClipManager';
import { AudioFile, Selection, Clip } from './types';
import { decodeAudioData, sliceAudioBuffer, bufferToWav, joinAudioBuffers } from './services/audioUtils';

export default function App() {
  // State
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [mainAudio, setMainAudio] = useState<AudioFile | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 10 });
  const [clips, setClips] = useState<Clip[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Refs for playback
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

  // Initialize AudioContext
  useEffect(() => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    setAudioContext(ctx);
    return () => {
      ctx.close();
    };
  }, []);

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !audioContext) return;

    setIsProcessing(true);
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const decodedBuffer = await decodeAudioData(arrayBuffer, audioContext);
        
        setMainAudio({
          name: file.name,
          buffer: decodedBuffer,
          duration: decodedBuffer.duration
        });
        
        // Reset state
        setSelection({ start: 0, end: Math.min(decodedBuffer.duration, 15) });
        setCurrentTime(0);
        pauseTimeRef.current = 0;
        stopAudio();
      } catch (err) {
        alert("Error decoding audio file. Please try a valid MP3/WAV.");
        console.error(err);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Playback Logic
  const playAudio = (offset: number) => {
    if (!audioContext || !mainAudio) return;
    
    // Resume context if suspended (browser policy)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const source = audioContext.createBufferSource();
    source.buffer = mainAudio.buffer;
    source.connect(audioContext.destination);
    
    // Play strictly within selection for previewing the cut
    let startPos = offset;
    if (startPos < selection.start || startPos >= selection.end) {
      startPos = selection.start;
    }
    
    const duration = selection.end - startPos;
    
    source.start(0, startPos, duration);
    
    startTimeRef.current = audioContext.currentTime - startPos;
    sourceNodeRef.current = source;
    setIsPlaying(true);

    source.onended = () => {
      setIsPlaying(false);
    };

    // Start animation loop
    const update = () => {
      const now = audioContext.currentTime;
      const trackTime = now - startTimeRef.current;
      
      if (trackTime >= selection.end) {
        setCurrentTime(selection.start); // Loop back visual
        stopAudio();
        return;
      }

      setCurrentTime(trackTime);
      animationFrameRef.current = requestAnimationFrame(update);
    };
    update();
  };

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsPlaying(false);
    // Save current time for resume
    pauseTimeRef.current = currentTime;
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      // If we are at the end of selection, restart from start of selection
      let start = currentTime;
      if (start >= selection.end || start < selection.start) {
        start = selection.start;
      }
      playAudio(start);
    }
  };

  const handleSeek = (time: number) => {
    stopAudio();
    setCurrentTime(time);
    pauseTimeRef.current = time;
  };

  const handleCut = async () => {
    if (!mainAudio || !audioContext) return;
    
    // 1. Create new buffer from selection
    const newBuffer = sliceAudioBuffer(mainAudio.buffer, selection.start, selection.end, audioContext);
    
    // 2. Create Blob for download
    const blob = bufferToWav(newBuffer);
    
    // 3. Generate Filename
    const timestamp = new Date().toISOString().slice(11,19).replace(/:/g,'-');
    const originalName = mainAudio.name.split('.')[0];
    const newName = `${originalName}_cut_${timestamp}`;

    // 4. Trigger Immediate Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `${newName}.wav`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    
    // 5. Add to clips for joining (History)
    const newClip: Clip = {
      id: Date.now().toString(),
      name: newName,
      buffer: newBuffer,
      blob: blob
    };
    
    setClips((prev) => [...prev, newClip]);
  };

  const handleJoin = () => {
    if (clips.length < 2 || !audioContext) return;
    
    const buffers = clips.map(c => c.buffer);
    const joinedBuffer = joinAudioBuffers(buffers, audioContext);
    const blob = bufferToWav(joinedBuffer);
    
    // Trigger Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `Joined_Mix_${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Logic to delete clip
  const deleteClip = (id: string) => {
    setClips(clips.filter(c => c.id !== id));
  };

  const renameClip = (id: string, name: string) => {
    setClips(clips.map(c => c.id === id ? { ...c, name } : c));
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20 transform transition-transform hover:scale-105">
              <Music className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 tracking-tight">
              SonicSlice
            </h1>
          </div>
          
          <div className="hidden sm:block text-sm text-slate-500 font-medium">
             Browser-based Audio Editor
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 pb-20">
        
        {/* Left Column: Editor */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Upload Zone (if no audio) or File Info */}
          {!mainAudio && (
            <div className="h-[300px] sm:h-[400px] border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center bg-slate-900/30 hover:bg-slate-900/50 transition-all duration-300 group cursor-pointer relative animate-scale-in">
              <input 
                type="file" 
                accept="audio/*" 
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 group-hover:shadow-2xl group-hover:shadow-cyan-500/20">
                {isProcessing ? (
                   <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Upload className="w-8 h-8 text-cyan-500" />
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 text-center px-4">Upload Audio File</h2>
              <p className="text-slate-400 text-sm text-center px-4">Tap to Select MP3/WAV</p>
            </div>
          )}

          {mainAudio && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold text-white truncate">{mainAudio.name}</h2>
                  <p className="text-slate-400 font-mono text-sm">
                    Original Duration: {mainAudio.duration.toFixed(2)}s
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setMainAudio(null); 
                    stopAudio();
                  }}
                  className="self-start sm:self-auto text-sm px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                >
                  Change File
                </button>
              </div>

              <WaveformEditor 
                audioFile={mainAudio}
                currentTime={currentTime}
                isPlaying={isPlaying}
                selection={selection}
                onSelectionChange={setSelection}
                onSeek={handleSeek}
                onPlayPause={togglePlayPause}
                onCut={handleCut}
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 transition-transform hover:scale-[1.02]">
                  <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-bold">Selection Start</span>
                  <div className="text-xl sm:text-2xl font-mono text-cyan-400">{selection.start.toFixed(3)}s</div>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-right transition-transform hover:scale-[1.02]">
                  <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-bold">Selection End</span>
                  <div className="text-xl sm:text-2xl font-mono text-cyan-400">{selection.end.toFixed(3)}s</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Clip Manager */}
        <div className="lg:col-span-4 h-auto">
          <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-800 p-4 sm:p-6 h-[500px] lg:h-auto lg:sticky lg:top-24 flex flex-col shadow-xl">
             <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-800 shrink-0">
               <div className="p-2 bg-indigo-500/10 rounded-lg">
                 <Layers className="text-indigo-400 w-6 h-6" />
               </div>
               <div>
                 <h2 className="font-bold text-white">Clip Manager</h2>
                 <p className="text-xs text-slate-500">History & Joining</p>
               </div>
             </div>

             <ClipManager 
                clips={clips} 
                onDelete={deleteClip} 
                onRename={renameClip} 
                onJoin={handleJoin}
             />
          </div>
        </div>

      </main>
    </div>
  );
}