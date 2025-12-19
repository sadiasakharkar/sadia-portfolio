import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getGeminiClient, encode, decode, decodeRawPcm } from '../geminiService';
import { Modality, LiveServerMessage } from '@google/genai';

const LiveView: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [transcription, setTranscription] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('Ready to talk');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);

  const stopSession = useCallback(() => {
    setIsActive(false);
    setStatus('Ready to talk');
    
    if (sessionRef.current) {
      sessionRef.current.close?.();
      sessionRef.current = null;
    }
    
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach(track => track.stop());
      microphoneStreamRef.current = null;
    }
    
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const startSession = async () => {
    try {
      setStatus('Connecting...');
      const ai = getGeminiClient();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneStreamRef.current = stream;
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      if (!outputAudioContextRef.current) {
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: 'You are a helpful and articulate companion. Speak naturally and keep responses engaging but concise.',
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsActive(true);
            setStatus('Live');
            
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Audio processing
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              // CRITICAL: We use our custom decodeRawPcm function here.
              // We avoid calling the native AudioContext.decodeAudioData because it
              // is intended for file formats like WAV/MP3, not raw PCM streams,
              // and would throw "Data read, but end of buffer not reached".
              const audioBuffer = await decodeRawPcm(
                decode(base64Audio),
                ctx,
                24000,
                1,
              );
              
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
              });
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            // Transcription processing
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              if (text) {
                setTranscription(prev => {
                  const last = prev[prev.length - 1];
                  if (last && !last.endsWith('.') && !last.endsWith('?') && !last.endsWith('!')) {
                    return [...prev.slice(0, -1), last + text];
                  }
                  return [...prev, text];
                });
              }
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error("Live error:", e);
            setStatus('Connection Error');
            stopSession();
          },
          onclose: () => {
            stopSession();
          }
        }
      });
      
      sessionRef.current = await sessionPromise;
    } catch (error) {
      console.error("Live failed:", error);
      setStatus('Microphone access denied or connection failed');
      setIsActive(false);
    }
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  return (
    <div className="flex flex-col h-full items-center justify-center p-6 bg-slate-900">
      <div className="max-w-2xl w-full flex flex-col items-center gap-12">
        <div className="relative flex flex-col items-center">
          <div className={`w-48 h-48 rounded-full flex items-center justify-center transition-all duration-700 ${
            isActive ? 'bg-indigo-600/20 scale-110 shadow-[0_0_80px_rgba(79,70,229,0.3)]' : 'bg-slate-800'
          }`}>
            <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all duration-500 ${
              isActive ? 'border-indigo-400 border-t-white animate-spin' : 'border-slate-700'
            }`}>
              <svg className={`w-12 h-12 transition-colors ${isActive ? 'text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            
            {isActive && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="absolute w-48 h-48 rounded-full border border-indigo-500/30 animate-ping"></div>
                <div className="absolute w-64 h-64 rounded-full border border-indigo-500/10 animate-pulse"></div>
              </div>
            )}
          </div>
          
          <div className="mt-8 text-center">
            <h2 className="text-2xl font-bold mb-2">{status}</h2>
            <p className="text-slate-400 text-sm max-w-sm">
              {isActive ? 'The AI is listening and responding in real-time.' : 'Start a natural voice conversation with Gemini Elite.'}
            </p>
          </div>
        </div>

        <div className="w-full h-48 bg-slate-800/40 rounded-2xl border border-slate-700 p-6 overflow-y-auto custom-scrollbar flex flex-col-reverse gap-4">
          {transcription.length > 0 ? (
            transcription.slice().reverse().map((line, i) => (
              <p key={i} className="text-slate-300 leading-relaxed text-lg italic opacity-80 animate-in fade-in slide-in-from-bottom-2">
                &ldquo;{line}&rdquo;
              </p>
            ))
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 italic text-sm">
              Capturing conversation...
            </div>
          )}
        </div>

        <button
          onClick={isActive ? stopSession : startSession}
          className={`px-12 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl ${
            isActive 
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-900/20' 
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-900/30'
          }`}
        >
          {isActive ? 'End Conversation' : 'Start Talking'}
        </button>
      </div>
    </div>
  );
};

export default LiveView;
