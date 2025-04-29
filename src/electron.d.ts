// src/electron.d.ts

// Tipos para Status do Bot (Main -> Renderer)
export type BotState = 'Ocioso' | 'initializing' | 'Rodando' | 'Parando' | 'Erro';
export interface BotStatusPayload {
    state: BotState;
    details?: { code?: number | null; signal?: string | null; message?: string; progress?: number; currentAction?: string; };
}
// Tipos para Logs do Bot (Main -> Renderer)
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export interface LogPayload { level: LogLevel; timestamp: string; message: string; }
// Tipos para Resultados do Bot (Main -> Renderer)
export interface ResultPayload { run_id: string; outcome: 'Concluído' | 'Parado' | 'Erro'; summary: string | object; details?: any; startTime: string; endTime: string; }
// Tipos para Erros (Main -> Renderer)
export interface BotErrorPayload { message: string; details?: any; }
// Tipos para Erros de Parse (Main -> Renderer)
export interface ParseErrorPayload { line: string; error: string; }

// --- Tipos específicos para BotConfig ---
export type InteractionMode = 'input_simulation' | 'memory_read' | 'network_intercept';
export type DetectionMethod = 'log_scan' | 'visual_change' | 'process_exit';
// --- Fim Tipos específicos ---

// Tipos para Comandos (Renderer -> Main)
export interface BotConfig {
    configName?: string; game?: string; script?: string; duration?: string | null; params?: any | null;
    startupDelay?: string; interactionMode?: InteractionMode; detectionMethod?: DetectionMethod;
    [key: string]: any;
}
export interface CommandPayload { command: string; payload?: any; }

// --- **NOVO:** Tipos para Retornos dos Diálogos de Ficheiro ---
export interface FileDialogSaveResult {
    success: boolean;
    filePath?: string; // Caminho onde foi salvo (se sucesso)
    error?: string;    // Mensagem de erro (se falha)
    canceled: boolean; // Se o utilizador cancelou
}
export interface FileDialogOpenResult {
    success: boolean;
    filePath?: string; // Caminho do ficheiro aberto (se sucesso)
    content?: string;  // Conteúdo do ficheiro (se sucesso)
    error?: string;    // Mensagem de erro (se falha)
    canceled: boolean; // Se o utilizador cancelou
}
// --- Fim Tipos Diálogos ---

// --- **NOVO:** Tipos para Gerador Anki (Renderer -> Main e Main -> Renderer) ---
export interface AnkiGeneratorInput {
    topic: string;
    selectedTypes: Record<string, boolean>;
    modelId: string;
}
export interface AnkiGeneratorResult {
    success: boolean;
    apkgData?: string; // <-- Mudar de generatedText para apkgData (Base64 string)
    error?: string;
    errorType?: 'apiKeyMissing' | 'apiKeyInvalid' | 'apiError' | 'other';
}

// Tipos para QuestionType (se não definido antes)
export type QuestionType = 'definition' | 'cause_effect' | 'example' | 'comparison' | 'date_fact' | 'true_false';

export interface GenerateAnkiDeckData {
    topic: string; 
    deckName: string; 
    tags?: string; 
    cardStyle?: string; // ID do estilo CSS (ex: 'padrao', 'minimalista')
    learningSteps?: string; // Passos como string (ex: "1m 10m 1d")
    selectedTypes: Record<QuestionType, boolean>; 
    modelId: string; 
    difficultyLevel?: string; 
    additionalInstructions?: string; 
    approximateCards?: number; 
}
// --- Fim Tipos Anki ---

// Interface para a API exposta pelo Preload
export interface ElectronAPI {
    // Controle do Bot
    startAndConfigureBot: (configData: BotConfig) => Promise<{ success: boolean; message: string }>;
    sendCommand: (command: CommandPayload) => Promise<{ success: boolean; message: string }>;
    stopBot: () => Promise<{ success: boolean; message: string }>;
    // Listeners
    on: (channel: 'main:bot-status-update' | 'main:bot-log' | 'main:bot-result' | 'main:bot-error' | 'main:bot-parse-error', listener: (payload: any) => void) => () => void;
    removeAllListeners: (channel: 'main:bot-status-update' | 'main:bot-log' | 'main:bot-result' | 'main:bot-error' | 'main:bot-parse-error') => void;
    // **NOVO:** Funções de Diálogo
    saveFileDialog: (content: string, defaultFilename?: string) => Promise<FileDialogSaveResult>;
    openFileDialog: () => Promise<FileDialogOpenResult>;
    // **NOVO:** Função Gerador Anki
    generateAnkiDeck: (data: AnkiGeneratorInput) => Promise<AnkiGeneratorResult>;
    // **NOVO:** Função Salvar API Key
    saveApiKeyAndRetry: (apiKey: string, originalData: AnkiGeneratorInput) => Promise<AnkiGeneratorResult>;
}

// Estender a interface Window global
declare global { interface Window { electronAPI: ElectronAPI; } }

export {}; // Necessário para tratar como módulo
