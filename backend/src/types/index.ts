export interface Requirement {
  id: string;
  componentType: ComponentType;
  description: string;
  priority: 'high' | 'medium' | 'low';
  context: string;
  status: 'pending' | 'generating' | 'completed';
  createdAt: Date;
}

export type ComponentType =
  | 'button'
  | 'form'
  | 'list'
  | 'card'
  | 'modal'
  | 'navigation'
  | 'dashboard'
  | 'table'
  | 'chart'
  | 'header'
  | 'footer'
  | 'sidebar'
  | 'other';

export interface TranscriptMessage {
  id: string;
  text: string;
  isFinal: boolean;
  timestamp: Date;
  speaker?: string;
}

export interface Session {
  id: string;
  meetingId: string;
  requirements: Requirement[];
  transcripts: TranscriptMessage[];
  artifacts: Artifact[];
  startedAt: Date;
  endedAt?: Date;
}

export interface Artifact {
  id: string;
  code: string;
  framework: 'react' | 'html';
  requirements: string[];
  createdAt: Date;
  isComplete: boolean;
}

// WebSocket event types
export interface ClientEvents {
  'audio:stream': { data: ArrayBuffer; timestamp: number };
  'chat:message': { text: string };
  'session:start': { meetingId?: string };
  'session:end': Record<string, never>;
  'generate:request': { requirementIds?: string[] };
}

export interface ServerEvents {
  'transcript:update': { text: string; isFinal: boolean };
  'requirement:detected': { requirement: Requirement };
  'artifact:update': { code: string; isComplete: boolean; artifactId: string };
  'artifact:stream': { chunk: string; artifactId: string };
  'error': { message: string; code: string };
  'session:connected': { sessionId: string };
}

// Gemini Function Calling types
export interface ExtractUIRequirementParams {
  component_type: ComponentType;
  description: string;
  priority?: 'high' | 'medium' | 'low';
  context?: string;
}

export interface GenerateUICodeParams {
  requirements: string[];
  framework: 'react' | 'html';
}
