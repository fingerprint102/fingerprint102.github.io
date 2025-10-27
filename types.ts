
export enum AppMode {
  Text = 'text',
  Voice = 'voice',
}

export enum MessageAuthor {
    User = 'user',
    Model = 'model',
}

export interface GroundingChunk {
    web: {
        uri: string;
        title: string;
    }
}

export interface ChatMessage {
    author: MessageAuthor;
    content: string;
    sources?: GroundingChunk[];
}

export interface TranscriptEntry {
    speaker: 'You' | 'Gemini';
    text: string;
}