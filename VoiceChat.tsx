import React, { useState, useRef, useCallback, useEffect } from 'react';
// FIX: LiveSession is not an exported member of @google/genai.
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { decode, decodeAudioData, createBlob } from '../utils/audio';
import { TranscriptEntry } from '../types';
import MicIcon from './icons/MicIcon';
import StopIcon from './icons/StopIcon';
import BotIcon from './icons/BotIcon';
import UserIcon from './icons/UserIcon';

type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

const VoiceChat: React.FC = () => {
    const [status, setStatus] = useState<VoiceStatus>('idle');
    const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
    const [error, setError] = useState<string | null>(null);

    // FIX: The `LiveSession` type is not exported from the library. Using `any` for the resolved promise value.
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');
    
    const nextStartTimeRef = useRef(0);
    const audioSourcesRef = useRef(new Set<AudioBufferSourceNode>());

    const stopSession = useCallback(() => {
        console.log("Stopping session...");
        setStatus('idle');
        
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
            sessionPromiseRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }

        if(mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
        }

        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        
    }, []);

    const startSession = async () => {
        setError(null);
        setTranscripts([]);
        setStatus('connecting');

        try {
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

            // FIX: Cast window to `any` to access vendor-prefixed `webkitAudioContext` without a TypeScript error.
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            // FIX: Cast window to `any` to access vendor-prefixed `webkitAudioContext` without a TypeScript error.
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        console.log("Session opened.");
                        setStatus('listening');

                        if (!streamRef.current || !inputAudioContextRef.current) return;

                        mediaStreamSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
                        scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            
                            if (sessionPromiseRef.current) {
                                sessionPromiseRef.current.then((session) => {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                });
                            }
                        };
                        
                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                       if (message.serverContent?.outputTranscription) {
                            currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                        } else if (message.serverContent?.inputTranscription) {
                            currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                        }

                        if (message.serverContent?.turnComplete) {
                            const userInput = currentInputTranscriptionRef.current.trim();
                            const modelOutput = currentOutputTranscriptionRef.current.trim();

                            // FIX: Ensure the objects added to transcripts have the correct `speaker` literal type.
                            setTranscripts(prev => {
                                const newEntries: TranscriptEntry[] = [];
                                if (userInput) {
                                    newEntries.push({ speaker: 'You', text: userInput });
                                }
                                if (modelOutput) {
                                    newEntries.push({ speaker: 'Gemini', text: modelOutput });
                                }
                                return [...prev, ...newEntries];
                            });
                            
                            currentInputTranscriptionRef.current = '';
                            currentOutputTranscriptionRef.current = '';
                        }
                        
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            setStatus('speaking');
                            const audioContext = outputAudioContextRef.current;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContext.currentTime);

                            const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
                            const source = audioContext.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(audioContext.destination);

                            source.addEventListener('ended', () => {
                                audioSourcesRef.current.delete(source);
                                if (audioSourcesRef.current.size === 0) {
                                    setStatus('listening');
                                }
                            });
                            
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }

                        if (message.serverContent?.interrupted) {
                            audioSourcesRef.current.forEach(source => source.stop());
                            audioSourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                            setStatus('listening');
                        }
                    },
                    onerror: (e) => {
                        console.error('Session error:', e);
                        setError('An error occurred with the connection.');
                        setStatus('error');
                        stopSession();
                    },
                    onclose: () => {
                        console.log("Session closed.");
                        if(status !== 'idle') { // Avoid calling stopSession again if it was user-initiated
                            stopSession();
                        }
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: 'You are a friendly and helpful AI assistant.',
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
            });
        } catch (err) {
            console.error('Failed to start session:', err);
            setError('Could not access microphone. Please grant permission and try again.');
            setStatus('error');
            stopSession();
        }
    };
    
    useEffect(() => {
        // Cleanup on component unmount
        return () => {
            stopSession();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getStatusText = () => {
        switch (status) {
            case 'idle': return 'Click the microphone to start the conversation';
            case 'connecting': return 'Connecting...';
            case 'listening': return 'Listening...';
            case 'speaking': return 'Gemini is speaking...';
            case 'error': return `Error: ${error}`;
            default: return '';
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 items-center justify-between">
            <div className="flex-1 w-full max-w-4xl mx-auto overflow-y-auto p-6 space-y-4">
                {transcripts.map((entry, index) => (
                    <div key={index} className={`flex items-start gap-3 ${entry.speaker === 'You' ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${entry.speaker === 'Gemini' ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                            {entry.speaker === 'Gemini' ? <BotIcon className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                        </div>
                        <div className={`p-3 rounded-lg ${entry.speaker === 'Gemini' ? 'bg-gray-800' : 'bg-blue-600'}`}>
                            <p className="text-sm">{entry.text}</p>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="w-full p-6 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700 flex flex-col items-center">
                <button
                    onClick={status === 'idle' || status === 'error' ? startSession : stopSession}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300
                        ${(status === 'listening' || status === 'speaking') ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'}
                        ${status === 'listening' ? 'animate-pulse' : ''}`}
                >
                    {status === 'idle' || status === 'error' || status === 'connecting' ? 
                        <MicIcon className="w-10 h-10 text-white" /> : 
                        <StopIcon className="w-10 h-10 text-white" />
                    }
                </button>
                <p className="mt-4 text-gray-400 text-center min-h-[1.5rem]">{getStatusText()}</p>
            </div>
        </div>
    );
};

export default VoiceChat;