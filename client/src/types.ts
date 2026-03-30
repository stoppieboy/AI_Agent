export type Role = 'user' | 'assistant';
export type Mode = 'agent' | 'chat';

export interface ToolPill {
  name: string;
  resolved: boolean;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  streaming?: boolean;
  toolPills?: ToolPill[];
}

export interface StoredMessage {
  role: Role;
  content: string;
}

export interface Conversation {
  id: string;
  preview: string;
  messages: StoredMessage[];
  updatedAt: number;
}

export type AgentEvent =
  | { type: 'tool'; name: string }
  | { type: 'token'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string };
