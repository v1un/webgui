// src/pages/BotControlPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useConfigStore } from '../store/configStore'; // Store da Config Ativa
import { useSnackbar } from '../context/SnackbarContext'; // Usar Snackbar para feedback

// MUI Imports
import Box from '@mui/material/Box'; import Typography from '@mui/material/Typography'; import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip'; import Paper from '@mui/material/Paper';
// TS6133: 'Alert' removido pois não está sendo usado
// import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
// TS6133: 'TextField' removido pois não está sendo usado (TextareaAutosize é usado para JSON)
// import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider'; import TextareaAutosize from '@mui/material/TextareaAutosize';
import UploadFileIcon from '@mui/icons-material/UploadFile'; import BuildIcon from '@mui/icons-material/Build';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';

// Importar tipos do electron.d.ts
import type { BotConfig, BotState, BotStatusPayload, LogPayload, BotErrorPayload, ParseErrorPayload } from '../electron.d';

const BotControlPage: React.FC = () => {
    const api = window.electronAPI;
    const { showSnackbar } = useSnackbar();

    // Selecionar estado do Zustand
    const activeConfig = useConfigStore((state) => state.activeConfig);
    const setActiveConfig = useConfigStore((state) => state.setActiveConfig);

    // Estados da UI
    const [botState, setBotState] = useState<BotState>('Ocioso');
    // TS2345: Corrigido - Inicializar com undefined e permitir undefined no tipo
    const [lastStatusDetails, setLastStatusDetails] = useState<BotStatusPayload['details'] | undefined>(undefined);
    const [isProcessingAction, setIsProcessingAction] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [logs, setLogs] = useState<LogPayload[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Limpar listeners ao desmontar
    useEffect(() => {
        if (!api) {
            console.warn('Electron API não disponível.');
            showSnackbar('Erro: Comunicação com o processo principal não disponível.', 'error');
            return;
        }

        const listeners: (() => void)[] = [];

        listeners.push(api.on('main:bot-status-update', (payload: BotStatusPayload) => {
            console.log('Status Update Recebido:', payload);
            setBotState(payload.state);
            // TS2345: Corrigido - Passar undefined se payload.details não existir
            setLastStatusDetails(payload.details || undefined);
            if (payload.state === 'Ocioso' || payload.state === 'Erro') {
                setIsProcessingAction(false);
            }
            if (payload.state === 'Erro') {
                showSnackbar(`Erro no Bot: ${payload.details?.message || 'Erro desconhecido'}`, 'error');
            }
        }));

        listeners.push(api.on('main:bot-log', (payload: LogPayload) => {
            console.log('Log Recebido:', payload);
            setLogs(prevLogs => [payload, ...prevLogs].slice(0, 100));
        }));

        listeners.push(api.on('main:bot-error', (payload: BotErrorPayload) => {
            console.error('Erro Recebido do Main/Bot:', payload);
            showSnackbar(`Erro no Processo Principal: ${payload.message}`, 'error');
            setIsProcessingAction(false);
            setBotState('Erro');
        }));

        listeners.push(api.on('main:bot-parse-error', (payload: ParseErrorPayload) => {
            console.error('Erro de Parse Recebido:', payload);
            showSnackbar(`Erro ao processar mensagem do bot: ${payload.error}`, 'warning');
        }));

        return () => {
            console.log("Removendo listeners IPC da BotControlPage...");
            listeners.forEach(unsubscribe => unsubscribe());
        };
    }, [api, showSnackbar]);

    const handleLoadJsonText = () => {
        if (!jsonInput.trim()) { showSnackbar('Nenhum JSON para carregar.', 'warning'); return; }
        try {
            const parsedConfig: BotConfig = JSON.parse(jsonInput);
            if (typeof parsedConfig !== 'object' || parsedConfig === null) throw new Error('JSON inválido. Deve ser um objeto.');
            setActiveConfig(parsedConfig);
            showSnackbar('Configuração JSON carregada com sucesso!', 'success');
            setJsonInput('');
        } catch (error: any) {
            console.error("Erro ao parsear JSON:", error);
            showSnackbar(`Erro ao carregar JSON: ${error.message}`, 'error');
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.type !== 'application/json') {
            showSnackbar('Formato inválido. Selecione um arquivo .json', 'warning');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error('Falha ao ler o conteúdo do arquivo.');
                const parsedConfig: BotConfig = JSON.parse(text);
                if (typeof parsedConfig !== 'object' || parsedConfig === null) throw new Error('JSON inválido no arquivo. Deve ser um objeto.');
                setActiveConfig(parsedConfig);
                showSnackbar(`Configuração do arquivo "${file.name}" carregada com sucesso!`, 'success');
            } catch (error: any) {
                console.error("Erro ao processar JSON do arquivo:", error);
                showSnackbar(`Erro ao carregar arquivo: ${error.message}`, 'error');
            } finally {
                if(fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.onerror = () => {
            showSnackbar('Erro ao ler o arquivo.', 'error');
            if(fileInputRef.current) fileInputRef.current.value = "";
        };
        reader.readAsText(file);
    };

    const handleStart = async () => {
        if (!activeConfig) { showSnackbar('Nenhuma configuração ativa para iniciar.', 'warning'); return; }
        if (!api?.startAndConfigureBot) { showSnackbar('Erro: API indisponível.', 'error'); return; }

        setIsProcessingAction(true);
        setLogs([]);
        try {
            const result = await api.startAndConfigureBot(activeConfig);
            if (result.success) {
                showSnackbar(result.message || 'Comando de início enviado.', 'info');
            } else {
                showSnackbar(result.message || 'Falha ao iniciar o Bot.', 'error');
                setIsProcessingAction(false);
                setBotState('Erro');
            }
        } catch (error: any) {
            console.error("Erro IPC ao iniciar:", error);
            showSnackbar(`Erro de comunicação ao iniciar: ${error.message}`, 'error');
            setIsProcessingAction(false);
            setBotState('Erro');
        }
    };

    const handleStop = async () => {
        if (!api?.stopBot) { showSnackbar('Erro: API indisponível.', 'error'); return; }

        setIsProcessingAction(true);
        setBotState('Parando');
        try {
            const result = await api.stopBot();
            if (result.success) {
                showSnackbar(result.message || 'Comando de parada enviado.', 'info');
            } else {
                showSnackbar(result.message || 'Falha ao enviar comando de parada.', 'error');
                setIsProcessingAction(false);
            }
        } catch (error: any) {
            console.error("Erro IPC ao parar:", error);
            showSnackbar(`Erro de comunicação ao parar: ${error.message}`, 'error');
            setIsProcessingAction(false);
        }
    };

    const getStatusColor = useCallback((status: BotState): ('default' | 'success' | 'error' | 'warning' | 'info') => {
        switch(status) {
            case 'Rodando': return 'success';
            case 'Erro': return 'error';
            case 'Parando': return 'warning';
            case 'initializing': return 'info';
            case 'Ocioso':
            default: return 'default';
        }
    }, []);

    const formatLogMessage = useCallback((log: LogPayload): string => {
        const timestamp = new Date(log.timestamp).toLocaleTimeString();
        return `[${timestamp}] [${log.level.toUpperCase()}] ${log.message}`;
    }, []);

    return (
        <Box>
            <Typography variant="h4" gutterBottom> Controle do Jacks Bot </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -1.5 }}>
                {/* Coluna Carregar Config */}
                <Box sx={{ width: { xs: '100%', md: '40%' }, px: 1.5, mb: 3 }}>
                    <Paper elevation={2} sx={{ p: 2, display: 'flex', flexDirection:'column', gap: 2, height: '100%' }}>
                        <Typography variant="h6">Carregar Configuração</Typography>
                        <Button variant="outlined" component={RouterLink} to="/config-builder" startIcon={<BuildIcon />} disabled={isProcessingAction || botState === 'Rodando'}> Abrir Construtor </Button>
                        <Divider>OU</Divider>
                        <TextareaAutosize minRows={4} placeholder="Cole a configuração JSON aqui..." style={{ width: '100%', fontFamily: 'monospace', padding: '8px', resize: 'vertical', opacity: (isProcessingAction || botState === 'Rodando') ? 0.5 : 1 }} value={jsonInput} onChange={(e) => setJsonInput(e.target.value)} disabled={isProcessingAction || botState === 'Rodando'} />
                        <Button variant="contained" onClick={handleLoadJsonText} size="small" disabled={isProcessingAction || botState === 'Rodando'}> Carregar JSON Colado </Button>
                        <Divider>OU</Divider>
                        <Button variant="contained" component="label" startIcon={<UploadFileIcon />} disabled={isProcessingAction || botState === 'Rodando'}> Carregar Arquivo JSON <input type="file" accept=".json,application/json" hidden ref={fileInputRef} onChange={handleFileChange} disabled={isProcessingAction || botState === 'Rodando'} /> </Button>
                    </Paper>
                </Box>

                {/* Coluna Controle/Status */}
                <Box sx={{ width: { xs: '100%', md: '60%' }, px: 1.5, mb: 3 }}>
                    <Paper elevation={2} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
                        <Typography variant="h6">Controles e Status</Typography>
                        <Box sx={{ width: '100%', maxHeight: '150px', overflowY:'auto', background: (theme) => theme.palette.mode === 'dark' ? '#333' : '#f5f5f5' , p:1, borderRadius: 1, border: '1px solid #e0e0e0'}}>
                            <Typography variant="subtitle2" gutterBottom>Configuração Ativa:</Typography>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.8em' }}> {activeConfig ? JSON.stringify(activeConfig, null, 2) : 'Nenhuma configuração carregada.'} </pre>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', mt: 1, flexWrap: 'wrap', gap: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body1" component="span">Status:</Typography>
                                <Chip label={botState} color={getStatusColor(botState)} />
                                {isProcessingAction && <CircularProgress size={20} />}
                            </Box>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Button variant="contained" color="success" startIcon={<PlayArrowIcon/>} onClick={handleStart} disabled={isProcessingAction || botState === 'Rodando' || botState === 'initializing' || !activeConfig}> Iniciar </Button>
                                <Button variant="contained" color="error" startIcon={<StopIcon/>} onClick={handleStop} disabled={isProcessingAction || botState === 'Ocioso' || botState === 'Erro'}> Parar </Button>
                            </Box>
                        </Box>
                        {lastStatusDetails?.message && (
                            <Typography variant="caption" sx={{ mt: 1, fontStyle: 'italic' }}>
                                Detalhe: {lastStatusDetails.message} {lastStatusDetails.code !== undefined ? `(Code: ${lastStatusDetails.code})` : ''}
                            </Typography>
                        )}
                        <Typography variant="h6" sx={{ mt: 2 }}>Logs Recentes</Typography>
                        <Paper variant="outlined" sx={{ p: 1, height: '200px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: (theme) => theme.palette.mode === 'dark' ? '#222' : '#f9f9f9' }}>
                            {logs.length === 0 ? "Nenhum log recebido." : logs.map((log, index) => (
                                <div key={index} style={{ color: log.level === 'error' ? 'red' : log.level === 'warn' ? 'orange' : 'inherit', marginBottom: '4px' }}>
                                    {formatLogMessage(log)}
                                </div>
                            ))}
                        </Paper>
                    </Paper>
                </Box>
            </Box>
        </Box>
    );
};
export default BotControlPage;
