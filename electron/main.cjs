// electron/main.cjs
const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const os = require('os'); // <-- NOVO: Para diretório temporário
const AdmZip = require('adm-zip'); // <-- NOVO: Para criar o .apkg (zip)
const sqlite3 = require('sqlite3').verbose(); // <-- NOVO: Para o banco de dados Anki
const crypto = require('crypto'); // <-- NOVO: Para checksum
// REMOVIDO: Importação síncrona do electron-store
// const Store = require('electron-store');

const VITE_DEV_SERVER_URL = 'http://localhost:5173';
const isDev = process.env.NODE_ENV !== 'production';

// Variáveis globais
let mainWindow = null;
let botProcess = null;
let store = null;
let initializingPromise = null; // NOVO: Promise para controlar a inicialização

// Caminho para o executável do Bot (AJUSTAR!)
const BOT_EXECUTABLE_PATH = 'C:/path/to/your/rust_bot_executable.exe'; // <<< AJUSTE ESTE CAMINHO >>>

// NOVO: CSS pré-definidos
const CARD_STYLES_CSS = {
    padrao: ".card { font-family: Arial; font-size: 20px; text-align: center; color: black; background-color: white; }",
    minimalista: ".card { font-family: sans-serif; font-size: 18px; text-align: left; color: #333; background-color: #f9f9f9; padding: 15px; border: 1px solid #eee; border-radius: 5px; } hr { border-top: 1px solid #ddd; }",
    alto_contraste: ".card { font-family: 'Courier New', monospace; font-size: 22px; text-align: center; color: #eee; background-color: #222; } hr { border-top: 1px solid #555; }",
};

// *** MOVIDO: Definição da função de criar janela AQUI ***
function createWindowFn() {
    mainWindow = new BrowserWindow({
        width: 1100, height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        title: "JJbot Control Panel",
        show: false,
    });
    mainWindow.maximize();
    mainWindow.show();
    mainWindow.setMenu(null);

    if (isDev) {
        mainWindow.loadURL(VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
        // Configura CSP para produção ...
        session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
             callback({ /* ... CSP headers ... */ });
        });
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// NOVO: Função para parsear learning steps
function parseLearningSteps(stepsString) {
    if (!stepsString || typeof stepsString !== 'string') {
        return [600, 86400]; // Padrão Anki: 10m 1d em segundos
    }
    const steps = stepsString.trim().split(/\s+/);
    const stepsInSeconds = steps.map(step => {
        const value = parseInt(step.slice(0, -1), 10);
        const unit = step.slice(-1).toLowerCase();
        if (isNaN(value)) return null;
        switch (unit) {
            case 'm': return value * 60;
            case 'h': return value * 3600;
            case 'd': return value * 86400;
            default: return null;
        }
    }).filter(step => step !== null && step > 0);

    // Retorna o padrão se o parse falhar ou resultar em array vazio
    return stepsInSeconds.length > 0 ? stepsInSeconds : [600, 86400];
}

// --- Função para enviar dados para o Renderer ---
function sendToRenderer(channel, data) {
    if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        console.log(`[Main->Renderer] Enviando no canal '${channel}':`, data ? JSON.stringify(data).substring(0, 100) + '...' : ' (sem dados)'); // Log truncado
        mainWindow.webContents.send(channel, data);
    } else {
        console.warn(`Janela principal não encontrada ou destruída. Não foi possível enviar no canal '${channel}'.`);
    }
}

// --- Funções de Controle do Bot ---
function startBotProcess() {
    if (botProcess) {
        console.warn('[Main] Tentativa de iniciar Bot, mas já existe um processo.');
        sendToRenderer('main:bot-error', { message: 'Um processo do Bot já está em execução.' });
        return;
    }
    console.log(`[Main] Iniciando Bot: ${BOT_EXECUTABLE_PATH}`);
    sendToRenderer('main:bot-status-update', { state: 'initializing' });

    if (!fs.existsSync(BOT_EXECUTABLE_PATH)) {
        const errorMsg = `Executável do Bot não encontrado em: ${BOT_EXECUTABLE_PATH}`;
        console.error(`[Main] ${errorMsg}`);
        sendToRenderer('main:bot-error', { message: errorMsg });
        sendToRenderer('main:bot-status-update', { state: 'Erro' });
        return;
    }

    try {
        botProcess = spawn(BOT_EXECUTABLE_PATH, [], { stdio: ['pipe', 'pipe', 'pipe'] });

        const rl = readline.createInterface({ input: botProcess.stdout });
        rl.on('line', (line) => {
            console.log(`[Bot stdout] Raw: ${line}`);
            try {
                const message = JSON.parse(line);
                console.log('[Bot stdout] Parsed JSON:', message);
                if (message.type && message.payload) {
                    switch (message.type) {
                        case 'status_update': sendToRenderer('main:bot-status-update', message.payload); break;
                        case 'log': sendToRenderer('main:bot-log', message.payload); break;
                        case 'result': sendToRenderer('main:bot-result', message.payload); break;
                        default:
                            console.warn(`[Bot stdout] Tipo de mensagem desconhecido: ${message.type}`);
                            sendToRenderer('main:bot-log', { level: 'warn', message: `Recebida mensagem desconhecida do bot: ${line}` });
                    }
                } else {
                    console.warn(`[Bot stdout] Formato de mensagem inválido (sem type/payload): ${line}`);
                    sendToRenderer('main:bot-log', { level: 'warn', message: `Recebida mensagem em formato inválido do bot: ${line}` });
                }
            } catch (parseError) {
                console.error(`[Bot stdout] Erro ao parsear JSON: \"${line}\"`, parseError);
                sendToRenderer('main:bot-parse-error', { line: line, error: parseError.message });
                sendToRenderer('main:bot-log', { level: 'error', message: `Erro ao processar mensagem do bot: ${line}` });
            }
        });

        botProcess.stderr.on('data', (data) => {
            const message = data.toString().trim();
            if(message){
                console.error(`[Bot stderr]: ${message}`);
                sendToRenderer('main:bot-log', { level: 'error', timestamp: new Date().toISOString(), message: message });
            }
        });

        botProcess.on('exit', (code, signal) => {
            console.log(`[Main] Processo Bot encerrado com código ${code}, sinal ${signal}`);
            const finalStatus = code === 0 ? 'Ocioso' : 'Erro';
            const details = { code, signal, message: `Processo encerrado ${code === 0 ? 'normalmente' : `com erro (código ${code})`}.` };
            sendToRenderer('main:bot-status-update', { state: finalStatus, details: details });
            botProcess = null;
        });

        botProcess.on('error', (err) => {
            console.error('[Main] Falha ao iniciar processo Bot:', err);
            sendToRenderer('main:bot-error', { message: `Falha ao iniciar Bot: ${err.message}` });
            sendToRenderer('main:bot-status-update', { state: 'Erro' });
            botProcess = null;
        });

        console.log('[Main] Processo Bot iniciado com sucesso (PID:', botProcess.pid, ')');
        sendToRenderer('main:bot-status-update', { state: 'Ocioso' });

    } catch (spawnError) {
        console.error('[Main] Erro EXCEPCIONAL ao tentar spawn:', spawnError);
        sendToRenderer('main:bot-error', { message: `Erro crítico no spawn: ${spawnError.message}` });
        sendToRenderer('main:bot-status-update', { state: 'Erro' });
        botProcess = null;
    }
}

function stopBotProcess() {
    if (botProcess && botProcess.pid) {
        console.log('[Main] Enviando comando STOP para o Bot via stdin...');
        try {
            const command = { command: 'stop', payload: {} };
            if (botProcess.stdin && !botProcess.stdin.destroyed) {
                botProcess.stdin.write(JSON.stringify(command) + '\n');
                console.log('[Main] Comando STOP enviado. Aguardando encerramento do processo...');
                sendToRenderer('main:bot-status-update', { state: 'Parando' });
            } else {
                console.warn('[Main] stdin do Bot não está disponível ou destruído, tentando kill...');
                killBotProcess();
            }
        } catch (writeError) {
            console.error("[Main] Erro ao escrever 'stop' no stdin do Bot:", writeError);
            sendToRenderer('main:bot-error', { message: `Erro ao enviar comando stop: ${writeError.message}` });
            killBotProcess();
        }
    } else {
        console.warn('[Main] Tentativa de parar Bot, mas nenhum processo está rodando ou é inválido.');
        if (!botProcess) { sendToRenderer('main:bot-status-update', { state: 'Ocioso' }); }
    }
}

function killBotProcess() {
    if (botProcess && botProcess.pid && !botProcess.killed) {
        console.warn('[Main] Tentando terminar o processo Bot (SIGTERM)...');
        const killed = botProcess.kill('SIGTERM');
        if (!killed) { console.error('[Main] Falha ao enviar SIGTERM.'); }
        setTimeout(() => {
            if (botProcess && botProcess.pid && !botProcess.killed) {
                console.warn('[Main] Processo não encerrou, forçando kill (SIGKILL)...');
                botProcess.kill('SIGKILL');
            }
        }, 2000);
    }
}

function sendCommandToBot(command) {
    if (botProcess && botProcess.stdin && !botProcess.stdin.destroyed) {
        try {
            const message = JSON.stringify(command) + '\n';
            console.log(`[Main->Bot stdin] Enviando: ${message.trim()}`);
            botProcess.stdin.write(message);
            return { success: true, message: 'Comando enviado com sucesso.' };
        } catch (writeError) {
            console.error("[Main] Erro ao escrever comando no stdin do Bot:", writeError);
            return { success: false, message: `Erro ao enviar comando: ${writeError.message}` };
        }
    } else {
        console.error('[Main] Bot não está rodando ou stdin não está disponível para enviar comando.');
        return { success: false, message: 'Bot não está pronto para receber comandos.' };
    }
}

// --- Lógica de IPC Recebendo do Renderer (Bot e Arquivos) ---

ipcMain.handle('bot:start-and-configure', async (event, configData) => {
    console.log('[IPC Main] Comando START-AND-CONFIGURE recebido com config:', configData);
    if (!botProcess) {
        startBotProcess();
        // Espera um pouco para o processo iniciar antes de enviar comandos
        await new Promise(resolve => setTimeout(resolve, 700));
        if (!botProcess) {
            console.error('[Main] Bot não iniciou corretamente, não enviando config/start.');
            return { success: false, message: 'Falha crítica ao iniciar o processo do Bot.' };
        }
    }
    const configCommand = { command: 'configure', payload: configData };
    const configResult = sendCommandToBot(configCommand);
    if (!configResult.success) { return configResult; }
    // Dá um tempo para a configuração ser processada antes de iniciar
    await new Promise(resolve => setTimeout(resolve, 300));
    const startCommand = { command: 'start', payload: { run_id: `run_${Date.now()}` } };
    const startResult = sendCommandToBot(startCommand);
    if(startResult.success) { sendToRenderer('main:bot-status-update', { state: 'Rodando' }); }
    return startResult;
});

ipcMain.handle('bot:send-command', async (event, command) => {
    console.log('[IPC Main] Comando genérico recebido:', command);
    if (!command || !command.command) { return { success: false, message: 'Comando inválido recebido.' }; }
    if (!botProcess) { return { success: false, message: 'Bot não está em execução para receber comandos.' }; }
    return sendCommandToBot(command);
});

ipcMain.handle('bot:stop', async (event) => {
    console.log('[IPC Main] Comando STOP recebido.');
    stopBotProcess();
    return { success: true, message: 'Comando STOP enviado/processo de parada iniciado.' };
});

ipcMain.handle('dialog:saveFile', async (event, content, defaultFilename) => {
    if (!mainWindow) {
        return { success: false, error: 'Janela principal não encontrada.', canceled: false };
    }
    try {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Salvar Configuração do Bot',
            defaultPath: defaultFilename || 'bot_config.json',
            filters: [{ name: 'JSON Files', extensions: ['json'] }]
        });

        if (canceled || !filePath) {
            console.log('[IPC Main] Diálogo de salvar cancelado.');
            return { success: false, canceled: true };
        }

        console.log(`[IPC Main] Salvando ficheiro em: ${filePath}`);
        await fs.promises.writeFile(filePath, content, 'utf8');
        return { success: true, filePath: filePath, canceled: false };

    } catch (error) {
        console.error('[IPC Main] Erro ao salvar ficheiro:', error);
        return { success: false, error: error.message, canceled: false };
    }
});

ipcMain.handle('dialog:openFile', async (event) => {
    if (!mainWindow) {
        return { success: false, error: 'Janela principal não encontrada.', canceled: false };
    }
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Abrir Configuração do Bot',
            filters: [{ name: 'JSON Files', extensions: ['json'] }],
            properties: ['openFile'] // Apenas um ficheiro
        });

        if (canceled || !filePaths || filePaths.length === 0) {
            console.log('[IPC Main] Diálogo de abrir cancelado.');
            return { success: false, canceled: true };
        }

        const filePath = filePaths[0];
        console.log(`[IPC Main] Lendo ficheiro de: ${filePath}`);
        const content = await fs.promises.readFile(filePath, 'utf8');
        return { success: true, filePath: filePath, content: content, canceled: false };

    } catch (error) {
        console.error('[IPC Main] Erro ao abrir ficheiro:', error);
        return { success: false, error: error.message, canceled: false };
    }
});

// --- **NOVO/REATORADO:** Função Reutilizável para Lógica de Geração Anki .apkg ---
async function generateDeckLogic({ 
    topic, 
    deckName,
    tags,
    cardStyle,
    learningSteps,
    selectedTypes, 
    modelId, 
    difficultyLevel, 
    additionalInstructions, 
    approximateCards 
}) {
    console.log('[Main Logic] Iniciando geração de .apkg para:', { topic, deckName, tags, cardStyle, learningSteps, selectedTypes, modelId, difficultyLevel, additionalInstructions, approximateCards });

    // *** MODIFICADO: Verificar API Key em process.env E no store ***
    let apiKey = process.env.GEMINI_API_KEY || store.get('geminiApiKey'); 

    if (!apiKey || apiKey === 'SUA_CHAVE_API_AQUI' || apiKey.length < 10) {
        console.error('[Main Logic] Chave API faltando ou inválida.');
         const detailedError = `Chave da API Gemini não configurada ou parece inválida!

Para usar esta funcionalidade, cole a chave no campo apropriado na interface e tente gerar novamente. A chave será salva automaticamente para usos futuros.`;
         return { success: false, errorType: 'apiKeyMissing', error: detailedError };
    }
    // Garante que process.env tenha a chave para esta execução, caso tenha vindo do store
    if (!process.env.GEMINI_API_KEY && apiKey) { 
        process.env.GEMINI_API_KEY = apiKey; 
        console.log('[Main Logic] Usando API Key do store para esta geração.');
    }

    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'anki-deck-'));
    const dbPath = path.join(tempDir, 'collection.anki2');
    const mediaPath = path.join(tempDir, 'media');
    const finalDeckName = deckName || topic || 'deck_gerado';
    const apkgPath = path.join(tempDir, `${finalDeckName.replace(/[^a-z0-9]/gi, '_')}.apkg`);

    let db = null; // Variável para a conexão do banco de dados

    try {
        // 1. Definir estruturas JSON padrão para modelo e deck
        const timestamp = Date.now();
        const modelIdAnki = timestamp; // Usar timestamp como ID único para o modelo
        const deckIdAnki = timestamp + 1; // Usar timestamp+1 como ID único para o deck
        const deckConfigId = timestamp + 2; // NOVO: ID para a configuração específica do deck

        // *** MODIFICADO: Selecionar CSS baseado no cardStyle ***
        const selectedCss = CARD_STYLES_CSS[cardStyle] || CARD_STYLES_CSS.padrao;

        // Modelo Básico (Frente/Verso)
        const basicModel = {
            id: modelIdAnki,
            name: "Básico (Gerado por IA)",
            type: 0, // Padrão
            mod: Math.floor(timestamp / 1000), // Tempo de modificação (segundos)
            usn: -1, // Update Sequence Number (padrão -1)
            sortf: 0, // Índice do campo de ordenação (Frente)
            did: deckIdAnki, // Deck ID associado (opcional, mas pode ser útil)
            tmpls: [
                {
                    name: "Card 1",
                    ord: 0, // Ordem do template
                    qfmt: "{{Frente}}", // Template da frente
                    afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Verso}}", // Template do verso
                    bqfmt: "",
                    bafmt: "",
                    did: null // Template não pertence a um deck específico
                }
            ],
            flds: [
                { name: "Frente", ord: 0, font: "Arial", size: 20, media: [], sticky: false, rtl: false }, // Adicionado campos padrão
                { name: "Verso", ord: 1, font: "Arial", size: 20, media: [], sticky: false, rtl: false }   // Adicionado campos padrão
            ],
            css: selectedCss,
            latexPre: "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}",
            latexPost: "\\end{document}",
            latexsvg: false, // Adicionado campo padrão
            req: [[0, "all", [0]]], // Adicionado campo padrão (requer campo 0 - Frente)
            tags: [], // Adicionado campo padrão
            vers: [] // Versões (geralmente vazio)
        };

        // Definição do Deck Default (ID 1)
        const defaultDeck = {
            id: 1,
            name: "Default",
            mod: Math.floor(timestamp / 1000),
            usn: -1,
            desc: "",
            conf: 1,
            extendNew: 10,
            extendRev: 50,
            collapsed: false,
            dyn: 0,
            newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0]
        };

        // Definição do Deck Gerado
        const deckDefinition = {
            id: deckIdAnki,
            name: finalDeckName,
            mod: Math.floor(timestamp / 1000),
            usn: -1,
            desc: `Deck sobre '${topic}' gerado via Gemini.`,
            conf: deckConfigId,
            extendNew: 10, // Limites padrão
            extendRev: 50,
            collapsed: false,
            dyn: 0, // Não é um deck dinâmico
            newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0]
        };

        // Definição da Configuração Default (ID 1)
        const defaultConfig = {
          id: 1,
          name: "Default",
          mod: 0,
          usn: -1,
          maxTaken: 60, // Exemplo de campos comuns
          timer: 0,
          autoplay: true,
          replayq: true,
          new: { bury: true, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 7], order: 1, perDay: 20, separate: true },
          rev: { bury: true, ease4: 1.3, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, perDay: 200, hardFactor: 1.2 },
          lapse: { delays: [10], leechAction: 1, leechFails: 8, minInt: 1, mult: 0 },
          dyn: false, // Não é dinâmica
          // ... outros campos podem ser necessários dependendo da versão do Anki
        };

        // *** NOVO: Criar a configuração específica para o deck gerado ***
        const parsedSteps = parseLearningSteps(learningSteps);
        const generatedDeckConfig = {
            id: deckConfigId,
            name: `Conf ${finalDeckName}`, // Nome da configuração
            mod: Math.floor(timestamp / 1000),
            usn: -1,
            maxTaken: 60,
            timer: 0,
            autoplay: true,
            replayq: true,
            new: { bury: true, delays: parsedSteps, initialFactor: 2500, ints: [1, 4, 7], order: 1, perDay: 20, separate: true },
            rev: { bury: true, ease4: 1.3, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, perDay: 200, hardFactor: 1.2 },
            lapse: { delays: [600], leechAction: 1, leechFails: 8, minInt: 1, mult: 0 }, // Padrão para lapse: 10m
            dyn: false,
        };

        // Definição da Coleção (tabela 'col') - inclui modelos e decks
        const colData = {
            id: 1, // ID fixo da coleção
            crt: Math.floor(timestamp / 1000), // Tempo de criação
            mod: Math.floor(timestamp / 1000), // Tempo de modificação global
            scm: Math.floor(timestamp / 1000), // Schema modification time (usar mod)
            ver: 11, // Versão do schema Anki (11 é comum para v2)
            dty: 0, // Dirty flag (0 = não modificado desde último sync/save)
            usn: -1, // Update Sequence Number global (-1 para novo)
            ls: 0, // Last sync time (0 para novo)
            conf: JSON.stringify(defaultConfig), // Configuração geral (JSON da defaultConfig)
            models: JSON.stringify({ [modelIdAnki]: basicModel }), // Modelos JSON
            decks: JSON.stringify({ "1": defaultDeck, [deckIdAnki]: deckDefinition }), // Decks JSON (inclui Default)
            dconf: JSON.stringify({ "1": defaultConfig, [deckConfigId]: generatedDeckConfig }), // Configurações de deck JSON (associa conf ID 1 ao deck ID 1 e outros que usam conf 1)
            tags: JSON.stringify({}) // Tags JSON (geralmente vazio inicialmente)
        };


        // 2. Criar e conectar ao banco de dados SQLite
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('[Main Logic] Erro ao criar/conectar DB:', err.message);
                throw new Error(`Erro SQLite ao conectar: ${err.message}`); // Propaga o erro
            }
            console.log('[Main Logic] Conectado ao banco de dados SQLite temporário.');
        });

        // 3. Executar comandos SQL para criar tabelas e inserir dados iniciais
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run(`DROP TABLE IF EXISTS col;`); // Limpa caso exista (improvável em temp)
                db.run(`CREATE TABLE col (
                    id              integer primary key,
                    crt             integer not null,
                    mod             integer not null,
                    scm             integer not null,
                    ver             integer not null,
                    dty             integer not null,
                    usn             integer not null,
                    ls              integer not null,
                    conf            text not null,
                    models          text not null,
                    decks           text not null,
                    dconf           text not null,
                    tags            text not null
                );`, (err) => { if (err) return reject(new Error(`Erro criando tabela col: ${err.message}`)) });

                db.run(`DROP TABLE IF EXISTS notes;`);
                db.run(`CREATE TABLE notes (
                    id              integer primary key,     /* epoch seconds */
                    guid            text not null,
                    mid             integer not null,
                    mod             integer not null,        /* epoch seconds */
                    usn             integer not null,
                    tags            text not null,
                    flds            text not null,
                    sfld            text not null,        /* text of first field for sort */
                    csum            integer not null,        /* sha1 checksum of first field */
                    flags           integer not null,        /* unused */
                    data            text not null            /* unused */
                );`, (err) => { if (err) return reject(new Error(`Erro criando tabela notes: ${err.message}`)) });

                db.run(`DROP TABLE IF EXISTS cards;`);
                db.run(`CREATE TABLE cards (
                    id              integer primary key,    /* epoch milliseconds */
                    nid             integer not null,       /* notes.id */
                    did             integer not null,       /* decks.id */
                    ord             integer not null,       /* template index */
                    mod             integer not null,       /* epoch seconds */
                    usn             integer not null,
                    type            integer not null,       /* 0=new, 1=lrn, 2=due, 3=rev */
                    queue           integer not null,       /* 0=new, 1=lrn, 2=due, 3=rev */
                    due             integer not null,       /* varies based on queue */
                    ivl             integer not null,       /* interval (days) */
                    factor          integer not null,       /* factor (e.g. 2500 for 250%) */
                    reps            integer not null,       /* reviews */
                    lapses          integer not null,       /* lapses */
                    left            integer not null,       /* remaining steps */
                    odue            integer not null,       /* original due */
                    odid            integer not null,       /* original did */
                    flags           integer not null,       /* unused */
                    data            text not null           /* unused */
                );`, (err) => { if (err) return reject(new Error(`Erro criando tabela cards: ${err.message}`)) });

                db.run(`DROP TABLE IF EXISTS graves;`);
                db.run(`CREATE TABLE graves (
                    usn             integer not null,    /* update sequence number */
                    oid             integer not null,    /* original id */
                    type            integer not null     /* 0=note, 1=card, 2=deck */
                );`, (err) => { if (err) return reject(new Error(`Erro criando tabela graves: ${err.message}`)) });

                db.run(`DROP TABLE IF EXISTS revlog;`);
                db.run(`CREATE TABLE revlog (
                    id              integer primary key, /* epoch milliseconds */
                    cid             integer not null,    /* cards.id */
                    usn             integer not null,    /* update sequence number */
                    ease            integer not null,    /* 1(wrong), 2(hard), 3(ok), 4(easy) */
                    ivl             integer not null,    /* interval */
                    lastIvl         integer not null,    /* last interval */
                    factor          integer not null,    /* factor */
                    time            integer not null,    /* how many milliseconds your review took */
                    type            integer not null     /* 0=lrn, 1=rev, 2=relrn, 3=cram */
                );`, (err) => { if (err) return reject(new Error(`Erro criando tabela revlog: ${err.message}`)) });

                // Inserir dados da coleção (col)
                db.run(`INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [colData.id, colData.crt, colData.mod, colData.scm, colData.ver, colData.dty, colData.usn, colData.ls, colData.conf, colData.models, colData.decks, colData.dconf, colData.tags],
                    (err) => { if (err) return reject(new Error(`Erro inserindo na tabela col: ${err.message}`)) });

                // Índices (melhora performance)
                db.run("CREATE INDEX ix_notes_usn on notes (usn);", (err) => { if (err) console.warn("Erro criando índice ix_notes_usn:", err.message); });
                db.run("CREATE INDEX ix_cards_usn on cards (usn);", (err) => { if (err) console.warn("Erro criando índice ix_cards_usn:", err.message); });
                db.run("CREATE INDEX ix_cards_nid on cards (nid);", (err) => { if (err) console.warn("Erro criando índice ix_cards_nid:", err.message); });
                db.run("CREATE INDEX ix_cards_sched on cards (did, queue, due);", (err) => { if (err) console.warn("Erro criando índice ix_cards_sched:", err.message); });
                db.run("CREATE INDEX ix_graves_usn on graves (usn);", (err) => { if (err) console.warn("Erro criando índice ix_graves_usn:", err.message); });
                db.run("CREATE INDEX ix_revlog_usn on revlog (usn);", (err) => { if (err) console.warn("Erro criando índice ix_revlog_usn:", err.message); });
                db.run("CREATE INDEX ix_revlog_cid on revlog (cid);", (err) => { if (err) console.warn("Erro criando índice ix_revlog_cid:", err.message); });

                // Resolve a promessa após todas as operações de serialização
                db.wait((err) => {
                  if (err) reject(new Error(`Erro durante db.wait: ${err.message}`));
                  else resolve();
                });
            });
        });
        console.log('[Main Logic] Tabelas e dados iniciais do SQLite criados.');

        // 4. Chamar a API Gemini para gerar os cartões
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelId });

        const requestedTypesString = Object.entries(selectedTypes).filter(([_, i]) => i).map(([k]) => ({definition: 'Definição',cause_effect: 'Causa/Efeito',example: 'Exemplo',comparison: 'Comparação',date_fact: 'Data/Fato',true_false: 'V/F'}[k] || k)).join(', ');
        if (!requestedTypesString) {
            throw new Error('Nenhum tipo de pergunta selecionado.');
        }

        // --- CONSTRUÇÃO DO PROMPT DINÂMICO ---
        let prompt = `
          Você é um assistente especialista em criar flashcards para o Anki no formato Frente/Verso.
          Gere flashcards sobre o tema "${topic}".
          Inclua os seguintes tipos de questões, se aplicável ao tema: ${requestedTypesString}.
        `;

        // Adicionar Nível de Dificuldade (se fornecido e diferente de 'qualquer')
        if (difficultyLevel && difficultyLevel !== 'qualquer') {
            const difficultyMap = {
                'iniciante': 'para um iniciante no assunto',
                'intermediario': 'para alguém com conhecimento intermediário no assunto',
                'avancado': 'para um especialista no assunto'
            };
            const difficultyText = difficultyMap[difficultyLevel] || `com nível de dificuldade ${difficultyLevel}`;
            prompt += `\nAdapte o conteúdo e a linguagem ${difficultyText}.`;
            console.log(`[Main Logic] Adicionando nível ao prompt: ${difficultyText}`);
        }

        // Adicionar Instruções Adicionais (se fornecidas)
        if (additionalInstructions && additionalInstructions.trim()) {
            prompt += `\nInstruções adicionais: ${additionalInstructions.trim()}`;
            console.log(`[Main Logic] Adicionando instruções extras ao prompt: ${additionalInstructions.trim()}`);
        }

        // Adicionar Número Aproximado de Cards (se fornecido e > 0)
        if (approximateCards && approximateCards > 0) {
            prompt += `\nGere aproximadamente ${approximateCards} pares de flashcards.`;
            console.log(`[Main Logic] Adicionando número de cards ao prompt: ${approximateCards}`);
        }

        // Instrução final de formato (essencial)
        prompt += `
          Formate a saída **estritamente** como pares de Frente e Verso separados por um ponto e vírgula (;), com cada par em uma nova linha.
          **Não inclua cabeçalhos, numeração, marcadores, explicações ou qualquer outro texto além dos pares Frente;Verso.**
          **Cada linha DEVE conter exatamente um par Frente;Verso.**

          Exemplo de formato **obrigatório**:
          Frente do Card 1;Verso do Card 1
          Qual a capital da França?;Paris
          2 + 2 = ?;4
        `;
        // --- FIM DA CONSTRUÇÃO DO PROMPT ---

        console.log(`[Main Logic] Enviando prompt final (Modelo: ${modelId}).`);
        // console.log(prompt); // Descomentar para debug detalhado do prompt

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        console.log("[Main Logic] Resposta Gemini (bruta recebida):", text);

        if (!text || text.trim() === '') {
            throw new Error('A IA não retornou conteúdo para este tema/tipos de pergunta.');
        }

        const lines = text.trim().split('\n').filter(line => line.includes(';')); // Filtra linhas válidas
        if (lines.length === 0) {
            console.error("[Main Logic] Formato inesperado recebido:", text);
            throw new Error('A IA retornou conteúdo em formato inesperado (nenhum par Frente;Verso encontrado após filtro). Verifique o log.');
        }
        console.log(`[Main Logic] ${lines.length} pares de Frente;Verso parseados.`);

        // 5. Inserir notas e cartões no banco de dados
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                // Prepare statements fora do loop para performance
                const stmtNote = db.prepare(`INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                const stmtCard = db.prepare(`INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

                const fieldSeparator = String.fromCharCode(0x1f); // Separador de campos Anki ASCII 31

                // *** NOVO: Preparar a string de tags (usar string vazia se não fornecida) ***
                const tagsString = tags ? tags.trim().replace(/\s+/g, ' ') : ""; 

                lines.forEach((line, index) => {
                    const parts = line.split(';', 2); // Divide apenas no primeiro ';'
                    if (parts.length !== 2 || !parts[0] || !parts[1]) {
                         console.warn(`[Main Logic] Ignorando linha inválida (formato incorreto): ${line}`);
                         return; // Pula linha mal formatada
                    }
                    const front = parts[0].trim();
                    const back = parts[1].trim();

                    // Gera IDs únicos baseados em timestamp (melhor usar milissegundos)
                    const noteTimestamp = Date.now() + index * 2; // Garante IDs únicos para notas
                    const cardTimestamp = Date.now() + index * 2 + 1; // Garante IDs únicos para cards
                    const modTimeSec = Math.floor(noteTimestamp / 1000); // Tempo de modificação em segundos

                    const noteId = noteTimestamp; // ID da nota (geralmente timestamp em segundos ou ms)
                    const cardId = cardTimestamp; // ID do cartão (geralmente timestamp em ms)
                    const guid = crypto.randomBytes(5).toString('hex'); // GUID aleatório mais robusto
                    const fields = `${front}${fieldSeparator}${back}`;
                    const sortField = front; // Usar o campo "Frente" para ordenação (sfld)
                    const checksum = parseInt(crypto.createHash('sha1').update(sortField).digest('hex').substring(0, 8), 16); // Checksum do sfld

                    // Inserir Nota
                    stmtNote.run(noteId, guid, modelIdAnki, modTimeSec, -1, tagsString, fields, sortField, checksum, 0, "", (err) => {
                        if (err) console.error(`Erro ao inserir nota ${noteId}:`, err.message);
                    });

                    // Inserir Cartão (associado à nota e ao deck gerado)
                    // type=0 (new), queue=0 (new), due=noteId (ordem de criação), ivl=0, factor=2500 (default), reps=0, lapses=0, left=0, odue=0
                    stmtCard.run(cardId, noteId, deckIdAnki, 0, modTimeSec, -1, 0, 0, noteId, 0, 2500, 0, 0, 0, 0, 0, 0, "", (err) => {
                         if (err) console.error(`Erro ao inserir cartão ${cardId}:`, err.message);
                    });
                });

                // Finaliza statements após o loop
                stmtNote.finalize((err) => { if (err) console.error("Erro finalizando stmtNote:", err.message); });
                stmtCard.finalize((err) => { if (err) console.error("Erro finalizando stmtCard:", err.message); });

                // Espera a conclusão antes de resolver
                db.wait((err) => {
                  if (err) reject(new Error(`Erro durante db.wait após inserção: ${err.message}`));
                  else resolve();
                });
            });
        });
        console.log('[Main Logic] Notas e cartões (com tags) inseridos no SQLite.');

        // 6. Fechar o banco de dados
        await new Promise((resolve, reject) => {
            if (db) { // Verifica se db ainda existe
                db.close((err) => {
                    if (err) {
                        console.error('[Main Logic] Erro ao fechar DB:', err.message);
                        // Não rejeita aqui, apenas loga, pois o essencial pode ter funcionado
                    } else {
                         console.log('[Main Logic] Conexão SQLite fechada.');
                    }
                    db = null; // Limpa a variável
                    resolve();
                });
            } else {
                 console.warn('[Main Logic] Tentativa de fechar DB, mas já estava fechado ou nulo.');
                 resolve();
            }
        });

        // 7. Criar arquivo 'media' JSON vazio
        await fs.promises.writeFile(mediaPath, '{}', 'utf8');
        console.log('[Main Logic] Arquivo media JSON criado.');

        // 8. Criar o arquivo .apkg (zip)
        const zip = new AdmZip();
        zip.addLocalFile(dbPath, '', 'collection.anki2'); // Adiciona na raiz do zip
        zip.addLocalFile(mediaPath, '', 'media');       // Adiciona na raiz do zip
        await zip.writeZipPromise(apkgPath); // Usa writeZipPromise para async/await
        console.log(`[Main Logic] Arquivo .apkg criado em: ${apkgPath}`);

        // 9. Ler o .apkg como buffer e converter para Base64
        const apkgBuffer = await fs.promises.readFile(apkgPath);
        const apkgData = apkgBuffer.toString('base64');
        console.log('[Main Logic] .apkg lido e convertido para Base64.');

        return { success: true, apkgData: apkgData };

    } catch (error) {
        console.error('[Main Logic] Erro durante a geração do .apkg:', error);

        // Fecha o DB se ainda estiver aberto em caso de erro
        if (db) {
            db.close((closeErr) => {
                if (closeErr) console.error('[Main Logic] Erro ao fechar DB após erro principal:', closeErr.message);
                db = null;
            });
        }

        const errorMessage = error.response?.data?.error?.message || error.message || 'Erro desconhecido.';
        if (errorMessage.toLowerCase().includes('api key not valid')) {
             const detailedError = `Chave da API Gemini inválida!

Verifique a chave fornecida e tente novamente.
A chave salva anteriormente pode estar incorreta.`;
             // Limpa a chave inválida do store para forçar o usuário a inserir novamente
             store.delete('geminiApiKey'); 
             delete process.env.GEMINI_API_KEY;
             console.warn('[Main Logic] Chave API inválida detectada. Removida do store e process.env.');
             return { success: false, errorType: 'apiKeyInvalid', error: detailedError };
        }
        // Se o erro já tem errorType (como apiKeyMissing), mantém
        if (error.errorType) {
            return { success: false, errorType: error.errorType, error: error.message || errorMessage };
        }
        // Erro genérico da API ou da lógica de geração
        return { success: false, errorType: 'generationError', error: `Erro ao gerar deck: ${errorMessage}` };

    } finally {
        // 10. Limpar diretório temporário
        try {
            if (fs.existsSync(tempDir)) { // Verifica se o diretório ainda existe
                 await fs.promises.rm(tempDir, { recursive: true, force: true });
                 console.log(`[Main Logic] Diretório temporário ${tempDir} removido.`);
            }
        } catch (cleanupError) {
            console.error(`[Main Logic] Falha ao limpar diretório temporário ${tempDir}:`, cleanupError);
        }
    }
}

// --- NOVO: Função de Inicialização Única ---
async function initializeApp() {
    if (initializingPromise) {
        console.log('[Init] Aguardando inicialização existente...');
        await initializingPromise;
        console.log('[Init] Inicialização existente concluída.');
        return;
    }
    if (store) {
        console.log('[Init] Store já existe (inesperado), pulando.');
        return;
    }

    console.log('[Init] Iniciando processo de inicialização...');

    initializingPromise = (async () => {
        try {
            console.log('[Init] Importando electron-store...');
            const { default: Store } = await import('electron-store');
            store = new Store();
            console.log('[Init] electron-store inicializado.');

            // Carregar chave API inicial
            const storedApiKey = store.get('geminiApiKey');
            if (storedApiKey && storedApiKey !== 'SUA_CHAVE_API_AQUI') {
                process.env.GEMINI_API_KEY = storedApiKey;
                console.log('[Init] Chave API carregada do store.');
            } else {
                console.log('[Init] Nenhuma chave API válida no store.');
            }

            // *** NOVO: Remover handlers existentes antes de registrar ***
            console.log('[Init] Removendo handlers IPC existentes (se houver)...');
            ipcMain.removeHandler('bot:start-and-configure');
            ipcMain.removeHandler('bot:send-command');
            ipcMain.removeHandler('bot:stop');
            ipcMain.removeHandler('dialog:saveFile');
            ipcMain.removeHandler('dialog:openFile');
            ipcMain.removeHandler('generate-anki-deck');
            ipcMain.removeHandler('save-api-key-and-retry');

            // Registrar Handlers IPC *depois* que o store estiver pronto
            console.log('[Init] Registrando Handlers IPC...');
            ipcMain.handle('bot:start-and-configure', async (event, configData) => { /* ... */ });
            ipcMain.handle('bot:send-command', async (event, command) => { /* ... */ });
            ipcMain.handle('bot:stop', async (event) => { /* ... */ });
            ipcMain.handle('dialog:saveFile', async (event, content, defaultFilename) => { /* ... */ });
            ipcMain.handle('dialog:openFile', async (event) => { /* ... */ });

            ipcMain.handle('generate-anki-deck', async (event, data) => {
                 console.log('[IPC] generate-anki-deck chamado com dados:', data); // Log dos dados recebidos
                 if (!store) {
                     console.error('[IPC generate-anki-deck] ERRO CRÍTICO: STORE É NULO!');
                     return { success: false, error: 'Erro interno: Armazenamento não inicializado.', errorType: 'internalError' };
                 }
                 
                 // *** NOVO: Bloco try...catch em volta da lógica do handler ***
                 try {
                     let apiKey = process.env.GEMINI_API_KEY || store.get('geminiApiKey');
                     if (!apiKey || apiKey === 'SUA_CHAVE_API_AQUI' || apiKey.length < 10) {
                         console.warn('[IPC] Chave API faltando ou inválida ao gerar deck.');
                         const detailedError = `Chave da API Gemini não configurada ou parece inválida!\n\nSe você já salvou a chave, verifique se ela está correta. Caso contrário, insira-a novamente.`;
                         return { success: false, errorType: 'apiKeyMissing', error: detailedError };
                     }

                     console.log('[IPC] Chamando generateDeckLogic...');
                     const result = await generateDeckLogic(data);
                     console.log('[IPC] Resultado de generateDeckLogic:', result ? { success: result.success, errorType: result.errorType } : 'undefined'); // Log do resultado
                     return result; // Retorna o resultado de generateDeckLogic

                 } catch (handlerError) {
                     console.error('[IPC generate-anki-deck] Erro não capturado no handler:', handlerError);
                     // Retorna um erro genérico, mas específico deste handler
                     return { 
                         success: false, 
                         error: `Erro inesperado no processo principal ao gerar o deck: ${handlerError.message}`,
                         errorType: 'ipcHandlerError' 
                     };
                 }
             });

            ipcMain.handle('save-api-key-and-retry', async (event, { apiKeyToSave, originalData }) => {
                 console.log('[IPC] save-api-key-and-retry chamado');
                 if (!store) {
                      console.error('[IPC save-api-key-and-retry] ERRO CRÍTICO: STORE É NULO!');
                      return { success: false, error: 'Erro interno: Armazenamento não inicializado.', errorType: 'internalError' };
                 }
                 
                 // *** NOVO: Bloco try...catch em volta da lógica do handler ***
                 try {
                    if (!apiKeyToSave || apiKeyToSave.length < 10) {
                         console.warn('[IPC] Tentativa de salvar chave inválida.');
                         return { success: false, error: 'Nenhuma chave válida fornecida para salvar.', errorType: 'validationError' };
                     }
                     
                     console.log('[IPC] Salvando chave no store...');
                     store.set('geminiApiKey', apiKeyToSave);
                     process.env.GEMINI_API_KEY = apiKeyToSave;
                     console.log('[IPC] Chave salva no store e process.env. Chamando generateDeckLogic...');

                     const result = await generateDeckLogic(originalData);
                     console.log('[IPC] Resultado de generateDeckLogic (após salvar chave):', result ? { success: result.success, errorType: result.errorType } : 'undefined');
                     return result;

                 } catch (handlerError) {
                     console.error('[IPC save-api-key-and-retry] Erro não capturado no handler:', handlerError);
                     return { 
                         success: false, 
                         error: `Erro inesperado no processo principal ao salvar chave e tentar novamente: ${handlerError.message}`,
                         errorType: 'ipcHandlerError' 
                     };
                 }
            });
            console.log('[Init] Handlers IPC registrados.');

        } catch (err) {
            console.error('[Init] Falha na inicialização:', err);
            // Mostra erro antes de sair
            if (!app.isReady()) {
                 await app.whenReady(); // Espera app estar pronto para mostrar dialog
             }
            dialog.showErrorBox('Erro Crítico de Inicialização', 'Falha ao carregar componentes essenciais. A aplicação será encerrada.\nErro: ' + err.message);
            app.quit();
            throw err; // Rejeita a promise
        }
    })();

    try {
        await initializingPromise; 
        console.log('[Init] Processo de inicialização concluído com sucesso.');
    } catch (err) {
         console.error('[Init] A inicialização falhou (capturado após await).');
         // O erro já foi tratado e o app.quit() chamado dentro da promise
    }
}

// --- Ciclo de Vida da Aplicação ---
app.whenReady().then(async () => {
    console.log('[App Ready] Iniciando...');
    await initializeApp(); 
    if (store) {
        console.log('[App Ready] Inicialização OK, criando janela...');
        createWindowFn();
    } else {
        console.error('[App Ready] Inicialização falhou, não criando janela.');
    }
});

app.on('activate', async () => {
    console.log('[Activate] Evento recebido.');
    if (BrowserWindow.getAllWindows().length === 0) {
        console.log('[Activate] Nenhuma janela aberta. Garantindo inicialização...');
        await initializeApp(); 
        if (store) {
            console.log('[Activate] Inicialização OK, criando janela...');
            createWindowFn();
        } else {
            console.error('[Activate] Inicialização falhou, não criando janela.');
        }
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        console.log('[Main] Todas as janelas fechadas. Parando o Bot se estiver rodando...');
        stopBotProcess();
        app.quit();
    }
});

app.on('before-quit', (event) => {
    console.log('[Main] Evento before-quit. Tentando parar o Bot...');
    if (botProcess && botProcess.pid && !botProcess.killed) {
        event.preventDefault();
        console.log('[Main] Atrasando quit para parada do Bot...');
        stopBotProcess();
        const quitTimeout = setTimeout(() => {
            console.warn('[Main] Timeout ao esperar parada do Bot. Forçando quit.');
            killBotProcess();
            app.quit();
        }, 3000);
        botProcess.once('exit', () => {
            console.log('[Main] Bot encerrado. Prosseguindo com quit.');
            clearTimeout(quitTimeout);
            app.quit();
        });
    } else {
        console.log('[Main] Nenhum Bot rodando ou já encerrado, quit imediato.');
    }
});

// --- Fim do arquivo main.cjs ---