
import React, { useState } from 'react';
import { AppMode } from './types';
import TextChat from './components/TextChat';
import VoiceChat from './components/VoiceChat';

const App: React.FC = () => {
    const [mode, setMode] = useState<AppMode>(AppMode.Text);

    return (
        <div className="h-screen w-screen flex flex-col font-sans">
            <header className="bg-gray-800 shadow-md p-4 flex justify-center items-center border-b border-gray-700">
                <div className="flex items-center space-x-2 bg-gray-900 p-1 rounded-full">
                    <button
                        onClick={() => setMode(AppMode.Text)}
                        className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-300 ${
                            mode === AppMode.Text ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                        }`}
                    >
                        Text Chat
                    </button>
                    <button
                        onClick={() => setMode(AppMode.Voice)}
                        className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-300 ${
                            mode === AppMode.Voice ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                        }`}
                    >
                        Voice Conversation
                    </button>
                </div>
            </header>
            <main className="flex-1 overflow-hidden">
                {mode === AppMode.Text ? <TextChat /> : <VoiceChat />}
            </main>
        </div>
    );
};

export default App;
