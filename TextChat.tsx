import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { ChatMessage, MessageAuthor, GroundingChunk } from '../types';
import BotIcon from './icons/BotIcon';
import UserIcon from './icons/UserIcon';
import SendIcon from './icons/SendIcon';
import LinkIcon from './icons/LinkIcon';

// This component renders a single chat message.
const Message: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const isModel = message.author === MessageAuthor.Model;
    return (
        <div className={`flex items-start gap-4 my-4 ${isModel ? 'flex-row' : 'flex-row-reverse'}`}>
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isModel ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                {isModel ? <BotIcon className="w-6 h-6" /> : <UserIcon className="w-6 h-6" />}
            </div>
            <div className={`p-4 rounded-lg max-w-2xl ${isModel ? 'bg-gray-800' : 'bg-blue-600'}`}>
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                        <h4 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2">
                            <LinkIcon className="w-4 h-4" /> Sources:
                        </h4>
                        <div className="flex flex-col space-y-2">
                            {message.sources.map((source, index) => (
                                <a
                                    key={index}
                                    href={source.web.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-400 hover:text-indigo-300 text-sm truncate"
                                    title={source.web.title}
                                >
                                    {source.web.title}
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


const TextChat: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const chatRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

    // Auto-scroll to the latest message
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);
    
    // Auto-resize the textarea based on content
    useEffect(() => {
        if (textAreaRef.current) {
            textAreaRef.current.style.height = 'auto';
            const scrollHeight = textAreaRef.current.scrollHeight;
            textAreaRef.current.style.height = `${scrollHeight}px`;
        }
    }, [input]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
    };
    
    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { author: MessageAuthor.User, content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);
        
        try {
            // Initialize chat on the first message
            if (!chatRef.current) {
                // FIX: The GoogleGenAI constructor expects an object with an `apiKey` property.
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                chatRef.current = ai.chats.create({
                    model: 'gemini-2.5-flash',
                    config: {
                         tools: [{googleSearch: {}}],
                    }
                });
            }
            
            // Add a placeholder for the model's response to attach streamed chunks to
            const modelMessagePlaceholder: ChatMessage = { author: MessageAuthor.Model, content: '', sources: [] };
            setMessages(prev => [...prev, modelMessagePlaceholder]);

            const stream = await chatRef.current.sendMessageStream({ message: input });
            
            let firstChunk = true;
            for await (const chunk of stream) {
                const text = chunk.text;
                const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
                
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessageIndex = newMessages.length - 1;
                    
                    if (firstChunk) {
                        newMessages[lastMessageIndex].content = text;
                        firstChunk = false;
                    } else {
                        newMessages[lastMessageIndex].content += text;
                    }

                    if (groundingChunks) {
                         newMessages[lastMessageIndex].sources = groundingChunks;
                    }

                    return newMessages;
                });
            }
        } catch (e) {
            console.error(e);
            const errorMessage = "Sorry, I couldn't process that. Please try again.";
            setError(errorMessage);
            setMessages(prev => {
                const newMessages = [...prev];
                // remove the placeholder if an error occurs
                if (newMessages[newMessages.length - 1].content === '') {
                    newMessages.pop();
                }
                return [...newMessages, { author: MessageAuthor.Model, content: errorMessage }];
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    // Send message on Enter key, allow new lines with Shift+Enter
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900">
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto">
                    {messages.length === 0 && !isLoading && (
                        <div className="text-center text-gray-400 mt-20">
                            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-indigo-400 to-purple-500 text-transparent bg-clip-text">Gemini AI Assistant</h1>
                            <p className="text-lg">Ask me anything! I can provide up-to-date information with sources.</p>
                        </div>
                    )}
                    {messages.map((msg, index) => (
                        <Message key={index} message={msg} />
                    ))}
                    {isLoading && messages[messages.length - 1]?.content === '' && (
                         <div className="flex items-start gap-4 my-4 flex-row">
                             <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-indigo-600">
                                 <BotIcon className="w-6 h-6" />
                             </div>
                             <div className="p-4 rounded-lg max-w-2xl bg-gray-800">
                                <div className="h-2.5 bg-gray-700 rounded-full w-32 animate-pulse"></div>
                             </div>
                         </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>
            <div className="p-6 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700">
                <div className="max-w-4xl mx-auto">
                    {error && <p className="text-red-500 text-sm mb-2 text-center">{error}</p>}
                    <div className="flex items-end bg-gray-800 rounded-lg p-2 gap-2">
                        <textarea
                            ref={textAreaRef}
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Type your message..."
                            className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none resize-none max-h-40"
                            rows={1}
                            disabled={isLoading}
                            aria-label="Chat input"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={isLoading || !input.trim()}
                            className="p-2 rounded-full bg-indigo-600 text-white disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-indigo-500 transition-colors flex-shrink-0"
                            aria-label="Send message"
                        >
                            <SendIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TextChat;