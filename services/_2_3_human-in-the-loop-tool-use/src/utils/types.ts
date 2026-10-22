import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'groq-sdk/resources/chat/completions';

// Define the Message type based on the ChatCompletionMessageParam from the groq-sdk
export type Message = ChatCompletionMessageParam;

// Tool Definition we send to the API (name + description + parameters)
export type ToolDefinition = ChatCompletionTool;

// POST /api/chat/generate request body
export interface GenerateChatRequest {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

// POST /api/chat/generate response body (run envelope — can later represent pending work)
export interface GenerateChatResponse {
  messages: Message[];
  tokenCount: number;
  retries: number;
}

// The valid states a Run can be in
export type RunStatus =
  | 'running'
  | 'pending_approval'
  | 'completed'
  | 'rejected'
  | 'failed'
  | 'cancelled'
  | 'expired';

// The valid states a single Approval can be in
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

// One approval record per tool call
export interface Approval {
  approvalId: string;      // opaque UUID
  runId: string;           // which run this belongs to
  toolCallId: string;      // the model's tool_call_id
  toolName: string;        // for display in the preview
  toolArguments: string;   // raw JSON string from the model
  status: ApprovalStatus;
  createdAt: number;       // Date.now() timestamp
  expiresAt: number;       // createdAt + TTL
  decidedAt?: number;      // when the decision was made
}

// A Run represents one full chat-generate lifecycle
export interface Run {
  runId: string;
  status: RunStatus;
  conversationHistory: Message[];
  approvals: Approval[];
  createdAt: number;
  completedAt?: number;
  finalAnswer?: string;
  error?: string;
  tokenCount: number;
  retries: number;
  // LLM params stored for when we resume the run
  temperature: number;
  maxTokens: number;
  topP: number;
}
