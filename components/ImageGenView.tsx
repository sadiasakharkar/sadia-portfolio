
import React, { useState } from 'react';
import { generateImage } from '../geminiService';
import { GeneratedImage } from '../types';

const ImageGenView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "16:9" | "9:16">("1:1");

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    
    setIsGenerating(true);
    try {
      const url = await generateImage(prompt, aspectRatio);
      const newImg: GeneratedImage = {
        id: Date.now().toString(),
        url,
        prompt,
        timestamp: new Date()
      };
      setImages(prev => [newImg, ...prev]);
    } catch (error) {
      console.error("Image generation failed:", error);
      alert("Failed to generate image. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-6 border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image you want to create..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
            </div>
            
            <div className="flex gap-2">
              <select 
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as any)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                <option value="1:1">Square (1:1)</option>
                <option value="16:9">Landscape (16:9)</option>
                <option value="9:16">Portrait (9:16)</option>
              </select>
              
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-900/30 flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="max-w-6xl mx-auto">
          {images.length === 0 && !isGenerating && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-4">
              <div className="p-6 rounded-full bg-slate-800/30 border border-slate-800">
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-400">No images yet</h3>
              <p className="max-w-xs text-center text-sm">Use the prompt bar above to start generating unique AI artwork.</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {isGenerating && (
              <div className="aspect-square rounded-2xl bg-slate-800 animate-pulse border border-slate-700 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-indigo-500 animate-spin"></div>
                <p className="text-xs text-slate-500 font-medium">Imagining...</p>
              </div>
            )}
            {images.map((img) => (
              <div key={img.id} className="group relative bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/50">
                <img 
                  src={img.url} 
                  alt={img.prompt} 
                  className="w-full h-auto object-cover aspect-square bg-slate-900" 
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                  <p className="text-sm font-medium line-clamp-2 mb-2 text-white">{img.prompt}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">{img.timestamp.toLocaleDateString()}</span>
                    <button 
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = img.url;
                        link.download = `gemini-gen-${img.id}.png`;
                        link.click();
                      }}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGenView;
