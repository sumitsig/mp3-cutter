import React, { useState } from 'react';
import { Clip } from '../types';
import { generateCreativeName } from '../services/geminiService';
import { Trash2, Download, Wand2, Merge, Music4 } from 'lucide-react';

interface ClipManagerProps {
  clips: Clip[];
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onJoin: () => void;
}

const ClipManager: React.FC<ClipManagerProps> = ({ clips, onDelete, onRename, onJoin }) => {
  const [isGeneratingName, setIsGeneratingName] = useState<string | null>(null);

  const handleSmartRename = async (id: string) => {
    setIsGeneratingName(id);
    // Small delay to allow UI to update before prompt halts execution
    setTimeout(async () => {
        const description = prompt("Describe this sound (e.g. 'funky bass loop'):");
        if (description) {
          const newName = await generateCreativeName(description);
          onRename(id, newName);
        }
        setIsGeneratingName(null);
    }, 50);
  };

  const handleDownload = (clip: Clip) => {
    if (!clip.blob) return;
    const url = URL.createObjectURL(clip.blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `${clip.name}.wav`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (clips.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 animate-fade-in">
        <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4">
           <Music4 className="opacity-20" size={32}/>
        </div>
        <p>No clips yet.</p>
        <p className="text-sm mt-2">Use the tool on the left to cut some audio!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <h3 className="text-xl font-bold text-slate-200">Clip Library</h3>
        <span className="text-xs font-medium px-2 py-1 bg-slate-800 text-cyan-400 rounded-full border border-slate-700">
          {clips.length} {clips.length === 1 ? 'clip' : 'clips'}
        </span>
      </div>

      <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 -mr-1 custom-scrollbar pb-4">
        {clips.map((clip, index) => (
          <div 
            key={clip.id} 
            className="animate-slide-up bg-slate-800 p-3 sm:p-4 rounded-xl flex items-center justify-between border border-slate-700 hover:border-cyan-500/50 transition-all group shadow-sm hover:shadow-md"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex-1 min-w-0 mr-3">
              <div className="flex items-center gap-2">
                 <input 
                  value={clip.name}
                  onChange={(e) => onRename(clip.id, e.target.value)}
                  className="bg-transparent font-medium text-slate-200 focus:outline-none focus:border-b-2 border-cyan-500 w-full truncate py-1 transition-colors"
                />
                <button 
                  onClick={() => handleSmartRename(clip.id)}
                  disabled={!!isGeneratingName}
                  className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors flex-shrink-0"
                  title="AI Smart Rename"
                >
                  <Wand2 size={16} className={isGeneratingName === clip.id ? "animate-spin" : ""} />
                </button>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-1 flex items-center gap-2">
                <span className="bg-slate-900 px-1.5 py-0.5 rounded">{clip.buffer.duration.toFixed(2)}s</span>
                <span className="hidden sm:inline">• {clip.buffer.numberOfChannels}ch</span>
                <span className="hidden sm:inline">• {clip.buffer.sampleRate}Hz</span>
              </p>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
               <button 
                onClick={() => handleDownload(clip)}
                className="p-3 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded-xl transition-all active:scale-90"
                title="Download WAV"
              >
                <Download size={20} />
              </button>
              <button 
                onClick={() => onDelete(clip.id)}
                className="p-3 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all active:scale-90"
                title="Delete"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {clips.length > 1 && (
        <div className="pt-4 border-t border-slate-800 shrink-0 animate-fade-in">
          <button 
            onClick={onJoin}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98] hover:shadow-indigo-600/40"
          >
            <Merge size={22} />
            <span>Join All & Download</span>
          </button>
          <p className="text-center text-xs text-slate-500 mt-3">
            Merges {clips.length} clips sequentially into one track.
          </p>
        </div>
      )}
    </div>
  );
};

export default ClipManager;