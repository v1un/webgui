// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Lista de canais válidos para comunicação Main -> Renderer
const validReceiveChannels = [
    'main:bot-status-update',
    'main:bot-log',
    'main:bot-result',
    'main:bot-error',
    'main:bot-parse-error'
];

contextBridge.exposeInMainWorld('electronAPI', {
    // --- Controle do Bot ---
    startAndConfigureBot: (configData) => ipcRenderer.invoke('bot:start-and-configure', configData),
    sendCommand: (command) => ipcRenderer.invoke('bot:send-command', command),
    stopBot: () => ipcRenderer.invoke('bot:stop'),

    // --- Listeners ---
    on: (channel, listener) => {
        if (validReceiveChannels.includes(channel)) {
            const safeListener = (event, ...args) => listener(...args);
            ipcRenderer.on(channel, safeListener);
            return () => ipcRenderer.removeListener(channel, safeListener);
        } else {
            console.warn(`Tentativa de registrar listener para canal inválido: ${channel}`);
            return () => {};
        }
    },
    removeAllListeners: (channel) => {
        if (validReceiveChannels.includes(channel)) {
            ipcRenderer.removeAllListeners(channel);
        } else {
            console.warn(`Tentativa de remover listeners de canal inválido: ${channel}`);
        }
    },

    // --- **NOVO:** Funções para Diálogos de Ficheiro ---
    saveFileDialog: (content, defaultFilename) => ipcRenderer.invoke('dialog:saveFile', content, defaultFilename),
    openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),

    // --- **NOVO:** Função para Gerador Anki ---
    generateAnkiDeck: (data) => ipcRenderer.invoke('generate-anki-deck', data),
    // --- **NOVO:** Função para Salvar API Key e Tentar Novamente ---
    saveApiKeyAndRetry: (apiKey, originalData) => ipcRenderer.invoke('save-api-key-and-retry', { apiKeyToSave: apiKey, originalData: originalData })
});

console.log('Preload script loaded and electronAPI exposed.');
