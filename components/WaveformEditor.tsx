import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AudioFile, Selection } from '../types';
import { PRIMARY_COLOR, WAVEFORM_COLOR, SELECTION_COLOR, PLAYHEAD_COLOR } from '../constants';
import { Play, Pause, Download } from 'lucide-react';

interface WaveformEditorProps {
  audioFile: AudioFile | null;
  currentTime: number;
  isPlaying: boolean;
  selection: Selection;
  onSelectionChange: (selection: Selection) => void;
  onSeek: (time: number) => void;
  onPlayPause: () => void;
  onCut: () => void;
}

const WaveformEditor: React.FC<WaveformEditorProps> = ({
  audioFile,
  currentTime,
  isPlaying,
  selection,
  onSelectionChange,
  onSeek,
  onPlayPause,
  onCut
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Handle Resize
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Draw Waveform
  useEffect(() => {
    if (!audioFile || !canvasRef.current || !containerRef.current || containerWidth === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle Retina Displays
    const dpr = window.devicePixelRatio || 1;
    const height = 200;

    canvas.width = containerWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, containerWidth, height);

    // Draw centerline
    ctx.beginPath();
    ctx.strokeStyle = '#334155';
    ctx.moveTo(0, height / 2);
    ctx.lineTo(containerWidth, height / 2);
    ctx.stroke();

    // Draw Waveform Data
    const data = audioFile.buffer.getChannelData(0);
    const step = Math.ceil(data.length / containerWidth);
    const amp = height / 2;

    ctx.fillStyle = WAVEFORM_COLOR;
    ctx.beginPath();

    for (let i = 0; i < containerWidth; i++) {
      let min = 1.0;
      let max = -1.0;
      
      for (let j = 0; j < step; j++) {
        const datum = data[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      
      const y = (1 + min) * amp;
      const h = Math.max(1, (max - min) * amp);
      ctx.rect(i, y, 1, h);
    }
    ctx.fill();

    // Draw Selection Overlay
    const startX = (selection.start / audioFile.duration) * containerWidth;
    const endX = (selection.end / audioFile.duration) * containerWidth;
    
    ctx.fillStyle = SELECTION_COLOR;
    ctx.fillRect(startX, 0, endX - startX, height);
    
    // Draw Selection Borders
    ctx.strokeStyle = PRIMARY_COLOR;
    ctx.lineWidth = 2;
    
    // Start Handle
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, height);
    ctx.stroke();

    // End Handle
    ctx.beginPath();
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, height);
    ctx.stroke();

    // Draw Playhead
    const playheadX = (currentTime / audioFile.duration) * containerWidth;
    ctx.strokeStyle = PLAYHEAD_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

  }, [audioFile, selection, currentTime, containerWidth]);

  // Unified Pointer Events (Mouse + Touch)
  const getPointerTime = (e: React.PointerEvent | PointerEvent) => {
    if (!containerRef.current || !audioFile) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    return (x / rect.width) * audioFile.duration;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!audioFile) return;
    // Prevent default to stop text selection/scrolling logic interference
    e.preventDefault();
    
    const time = getPointerTime(e);
    
    // Detect if clicking near start or end handle with larger touch tolerance
    const duration = audioFile.duration;
    // ~5% tolerance or min 10px worth of time
    const tolerance = Math.max(duration * 0.05, (10 / containerWidth) * duration);

    if (Math.abs(time - selection.start) < tolerance) {
      setIsDragging('start');
      // Capture pointer to ensure we get moves even if cursor leaves the div
      (e.target as Element).setPointerCapture(e.pointerId);
    } else if (Math.abs(time - selection.end) < tolerance) {
      setIsDragging('end');
      (e.target as Element).setPointerCapture(e.pointerId);
    } else {
      onSeek(time);
    }
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !audioFile) return;
    const time = getPointerTime(e);
    
    let newSelection = { ...selection };
    // Minimum duration of 0.1s to prevent overlap
    const minDuration = 0.1;

    if (isDragging === 'start') {
      let newStart = Math.max(0, time);
      if (newStart >= selection.end - minDuration) {
        newStart = selection.end - minDuration;
      }
      newSelection.start = newStart;
    } else {
      let newEnd = Math.min(audioFile.duration, time);
      if (newEnd <= selection.start + minDuration) {
        newEnd = selection.start + minDuration;
      }
      newSelection.end = newEnd;
    }
    onSelectionChange(newSelection);
  }, [isDragging, audioFile, selection, onSelectionChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsDragging(null);
    (e.target as Element).releasePointerCapture(e.pointerId);
  }, []);

  if (!audioFile) {
    return (
      <div className="h-48 bg-slate-900 rounded-xl border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-500 animate-pulse">
        Upload a song to get started
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-scale-in">
      {/* Editor Area */}
      <div 
        ref={containerRef}
        className="relative h-[200px] bg-slate-900 rounded-xl overflow-hidden cursor-pointer select-none shadow-inner group touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ touchAction: 'none' }} // Critical for mobile drag
      >
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full block" />
        
        {/* Hover/Touch hint */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300 bg-black/10">
          <p className="text-white/70 text-xs sm:text-sm font-medium bg-slate-950/60 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-xl">
            Drag blue lines to cut
          </p>
        </div>
        
        {/* Time Labels */}
        <div className="absolute bottom-2 left-2 text-[10px] sm:text-xs text-cyan-400 font-mono bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800">
          Start: {selection.start.toFixed(2)}s
        </div>
        <div className="absolute bottom-2 right-2 text-[10px] sm:text-xs text-cyan-400 font-mono bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800">
          End: {selection.end.toFixed(2)}s
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 bg-slate-800 rounded-xl border border-slate-700 shadow-xl transition-all hover:shadow-2xl hover:border-slate-600">
        
        <div className="flex items-center gap-4">
          <button 
            onClick={onPlayPause}
            className="flex-shrink-0 w-14 h-14 flex items-center justify-center bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-full transition-all shadow-lg shadow-cyan-500/25 active:scale-95 hover:scale-105"
          >
            {isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" className="ml-1" />}
          </button>
          
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-0.5">Current Time</p>
            <p className="font-mono text-2xl text-white tabular-nums leading-none">{currentTime.toFixed(2)}<span className="text-sm text-slate-500">s</span></p>
          </div>
        </div>
        
        <button 
          onClick={onCut}
          className="flex items-center justify-center gap-2 px-6 py-4 sm:py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-95 hover:shadow-emerald-600/40"
        >
          <Download size={20} />
          <span>Export Selection</span>
        </button>
      </div>
    </div>
  );
};

export default WaveformEditor;