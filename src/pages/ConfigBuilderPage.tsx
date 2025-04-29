// src/pages/ConfigBuilderPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfigStore } from '../store/configStore';
import { useSnackbar } from '../context/SnackbarContext';

// MUI Imports
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import SaveIcon from '@mui/icons-material/Save';
import SendToMobileIcon from '@mui/icons-material/SendToMobile';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress'; // Para indicar loading

// Importar tipos
import type { BotConfig, InteractionMode, DetectionMethod } from '../electron.d';

// Valores de exemplo para selects
const gameOptions: string[] = ['GameXYZ', 'GameABC', 'Outro'];
const scriptOptions: string[] = ['path/to/script_a.lua', 'path/to/script_b.py', 'teste_interno_1'];
const interactionModes: InteractionMode[] = ['input_simulation', 'memory_read', 'network_intercept'];
const detectionMethods: DetectionMethod[] = ['log_scan', 'visual_change', 'process_exit'];

const ConfigBuilderPage: React.FC = () => {
    const navigate = useNavigate();
    const { showSnackbar } = useSnackbar();
    const setActiveConfig = useConfigStore((state) => state.setActiveConfig);
    const currentActiveConfig = useConfigStore((state) => state.activeConfig);
    const api = window.electronAPI; // Obter API do preload

    // Estado do formulário
    const [configName, setConfigName] = useState('');
    const [game, setGame] = useState('');
    const [script, setScript] = useState('');
    const [duration, setDuration] = useState('');
    const [startupDelay, setStartupDelay] = useState('');
    const [interactionMode, setInteractionMode] = useState<InteractionMode | ''>('');
    const [detectionMethod, setDetectionMethod] = useState<DetectionMethod | ''>('');
    const [paramsJson, setParamsJson] = useState('{\n  "key": "value"\n}');
    const [paramsError, setParamsError] = useState<string | null>(null);
    // Estado de loading para operações de ficheiro
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingFile, setIsLoadingFile] = useState(false);

    // Função para carregar dados no formulário (usada ao carregar config ativa e de ficheiro)
    const loadConfigIntoForm = useCallback((config: BotConfig | null) => {
        if (config) {
            setConfigName(config.configName || `Config_${Date.now()}`);
            setGame(config.game || '');
            setScript(config.script || '');
            setDuration(config.duration || '');
            setStartupDelay(config.startupDelay || '');
            setInteractionMode(config.interactionMode || '');
            setDetectionMethod(config.detectionMethod || '');
            try {
                setParamsJson(JSON.stringify(config.params || {}, null, 2));
                setParamsError(null);
            } catch {
                setParamsJson('{}');
                setParamsError('Parâmetros da configuração carregada não são JSON válido.');
                showSnackbar('Atenção: Parâmetros da configuração carregada não são JSON válido.', 'warning');
            }
        } else {
            // Resetar se config for null
            setConfigName(''); setGame(''); setScript(''); setDuration('');
            setStartupDelay(''); setInteractionMode(''); setDetectionMethod('');
            setParamsJson('{\n  "key": "value"\n}'); setParamsError(null);
        }
    }, [showSnackbar]); // Adicionar showSnackbar como dependência

    // Carregar configuração ativa ao montar
    useEffect(() => {
        loadConfigIntoForm(currentActiveConfig);
    }, [currentActiveConfig, loadConfigIntoForm]); // Usar a função de carregar

    // Validar JSON
    const handleParamsChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const jsonString = event.target.value;
        setParamsJson(jsonString);
        try { JSON.parse(jsonString); setParamsError(null); }
        catch (error) { setParamsError("JSON inválido."); }
    };

    // Handlers específicos para Selects
    const handleInteractionModeChange = (event: SelectChangeEvent) => { setInteractionMode(event.target.value as InteractionMode | ''); };
    const handleDetectionMethodChange = (event: SelectChangeEvent) => { setDetectionMethod(event.target.value as DetectionMethod | ''); };

    // Construir objeto de configuração
    const buildConfigObject = useCallback((): BotConfig | null => {
        let parsedParams: any = null;
        try {
            parsedParams = JSON.parse(paramsJson); setParamsError(null);
        } catch (error) {
            setParamsError("JSON inválido. Corrija antes de salvar/enviar.");
            showSnackbar("Erro nos Parâmetros: O formato JSON é inválido.", "error");
            return null;
        }
        if (!game) {
            showSnackbar("Erro: O campo 'Jogo Alvo' é obrigatório.", "warning"); return null;
        }
        return {
            configName: configName.trim() || `Config_${Date.now()}`, game: game,
            script: script || undefined, duration: duration.trim() || null,
            startupDelay: startupDelay.trim() || undefined,
            interactionMode: interactionMode || undefined,
            detectionMethod: detectionMethod || undefined, params: parsedParams,
        };
    }, [configName, game, script, duration, startupDelay, interactionMode, detectionMethod, paramsJson, showSnackbar]);

    // Handler para "Enviar para Controle"
    const handleSendToControlPanel = () => {
        const config = buildConfigObject();
        if (config) {
            setActiveConfig(config);
            showSnackbar(`Configuração "${config.configName}" enviada para o Painel de Controle!`, 'success');
            navigate('/bot-control');
        }
    };

    // --- **Handlers Atualizados para Salvar/Carregar Ficheiro** ---
    const handleSaveToFile = async () => {
        const config = buildConfigObject();
        if (!config) return; // Abortar se config for inválida
        if (!api?.saveFileDialog) { showSnackbar("Erro: API para salvar ficheiro não disponível.", "error"); return; }

        setIsSaving(true);
        try {
            // Sugerir nome do ficheiro baseado no nome da config
            const defaultFilename = config.configName ? `${config.configName.replace(/[^a-z0-9]/gi, '_')}.json` : 'bot_config.json';
            const result = await api.saveFileDialog(JSON.stringify(config, null, 2), defaultFilename);

            if (result.success && result.filePath) {
                showSnackbar(`Configuração salva em: ${result.filePath}`, 'success');
            } else if (!result.canceled) {
                // Não mostrar snackbar se apenas cancelou
                showSnackbar(`Erro ao salvar ficheiro: ${result.error || 'Erro desconhecido'}`, 'error');
            }
        } catch (error: any) {
            console.error("Erro ao chamar saveFileDialog:", error);
            showSnackbar(`Erro inesperado ao salvar: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLoadFromFile = async () => {
        if (!api?.openFileDialog) { showSnackbar("Erro: API para abrir ficheiro não disponível.", "error"); return; }

        setIsLoadingFile(true);
        try {
            const result = await api.openFileDialog();

            if (result.success && result.content && result.filePath) {
                try {
                    const parsedConfig: BotConfig = JSON.parse(result.content);
                    // TODO: Adicionar validação mais robusta do schema do parsedConfig se necessário
                    loadConfigIntoForm(parsedConfig); // Carrega os dados no formulário
                    showSnackbar(`Configuração carregada de: ${result.filePath}`, 'success');
                } catch (parseError: any) {
                    console.error("Erro ao parsear JSON do ficheiro:", parseError);
                    showSnackbar(`Erro ao processar ficheiro: JSON inválido (${parseError.message})`, 'error');
                    setParamsError("Erro ao carregar JSON do ficheiro."); // Indicar erro no campo JSON
                }
            } else if (!result.canceled) {
                showSnackbar(`Erro ao carregar ficheiro: ${result.error || 'Erro desconhecido'}`, 'error');
            }
            // Não fazer nada se cancelado
        } catch (error: any) {
            console.error("Erro ao chamar openFileDialog:", error);
            showSnackbar(`Erro inesperado ao carregar: ${error.message}`, 'error');
        } finally {
            setIsLoadingFile(false);
        }
    };
    // --- Fim Handlers Atualizados ---

    return (
        <Box>
            <Typography variant="h4" gutterBottom> Construtor de Configuração do Bot </Typography>
            <Paper elevation={2} sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {/* Seção 1: Nome e Jogo */}
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3 }}>
                        <Box sx={{ width: { xs: '100%', sm: '50%' } }}><TextField fullWidth label="Nome da Configuração (Opcional)" variant="outlined" value={configName} onChange={(e) => setConfigName(e.target.value)} size="small" /></Box>
                        <Box sx={{ width: { xs: '100%', sm: '50%' } }}>
                            <FormControl fullWidth size="small" required><InputLabel id="game-select-label">Jogo Alvo</InputLabel><Select labelId="game-select-label" value={game} label="Jogo Alvo *" onChange={(e: SelectChangeEvent) => setGame(e.target.value)} >{gameOptions.map(option => (<MenuItem key={option} value={option}>{option}</MenuItem>))}</Select></FormControl>
                        </Box>
                    </Box>
                    {/* Seção 2: Script e Duração */}
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3 }}>
                        <Box sx={{ width: { xs: '100%', sm: '50%' } }}><FormControl fullWidth size="small"><InputLabel id="script-select-label">Script de Teste (Opcional)</InputLabel><Select labelId="script-select-label" value={script} label="Script de Teste (Opcional)" onChange={(e: SelectChangeEvent) => setScript(e.target.value)} ><MenuItem value=""><em>Nenhum</em></MenuItem>{scriptOptions.map(option => (<MenuItem key={option} value={option}>{option}</MenuItem>))}</Select></FormControl></Box>
                        <Box sx={{ width: { xs: '100%', sm: '50%' } }}><TextField fullWidth label="Duração Máxima (Opcional)" placeholder="Ex: 10m, 1h, 30s" variant="outlined" value={duration} onChange={(e) => setDuration(e.target.value)} size="small" /></Box>
                    </Box>
                    {/* Seção 3: Atraso Inicial e Modo Interação */}
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3 }}>
                        <Box sx={{ width: { xs: '100%', sm: '50%' } }}><TextField fullWidth label="Atraso Inicial (Opcional)" placeholder="Ex: 5s, 1m" variant="outlined" value={startupDelay} onChange={(e) => setStartupDelay(e.target.value)} size="small" /></Box>
                        <Box sx={{ width: { xs: '100%', sm: '50%' } }}><FormControl fullWidth size="small"><InputLabel id="interaction-select-label">Modo de Interação (Opcional)</InputLabel><Select labelId="interaction-select-label" value={interactionMode} label="Modo de Interação (Opcional)" onChange={handleInteractionModeChange} ><MenuItem value=""><em>Padrão</em></MenuItem>{interactionModes.map(option => (<MenuItem key={option} value={option}>{option}</MenuItem>))}</Select></FormControl></Box>
                    </Box>
                    {/* Seção 4: Método Detecção */}
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3 }}>
                        <Box sx={{ width: { xs: '100%', sm: '50%' } }}><FormControl fullWidth size="small"><InputLabel id="detection-select-label">Método de Detecção (Opcional)</InputLabel><Select labelId="detection-select-label" value={detectionMethod} label="Método de Detecção (Opcional)" onChange={handleDetectionMethodChange} ><MenuItem value=""><em>Padrão</em></MenuItem>{detectionMethods.map(option => (<MenuItem key={option} value={option}>{option}</MenuItem>))}</Select></FormControl></Box>
                        <Box sx={{ width: { xs: '100%', sm: '50%' } }}></Box> {/* Espaço vazio */}
                    </Box>
                    {/* Seção 5: Parâmetros JSON */}
                    <Box><TextField fullWidth label="Parâmetros Específicos (JSON)" multiline rows={6} variant="outlined" value={paramsJson} onChange={handleParamsChange} error={!!paramsError} helperText={paramsError || "Insira um objeto JSON válido."} InputProps={{ sx: { fontFamily: 'monospace' } }} /></Box>
                    {/* Seção 6: Ações */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                        <Tooltip title="Carregar configuração de um ficheiro .json"><span> {/* Span para tooltip em botão desabilitado */}
                            <Button variant="outlined" startIcon={isLoadingFile ? <CircularProgress size={20}/> : <FileOpenIcon />} onClick={handleLoadFromFile} disabled={isLoadingFile || isSaving}> Carregar de Ficheiro </Button>
                         </span></Tooltip>
                        <Tooltip title="Salvar esta configuração num ficheiro .json"><span> {/* Span para tooltip em botão desabilitado */}
                            <Button variant="outlined" startIcon={isSaving ? <CircularProgress size={20}/> : <SaveIcon />} onClick={handleSaveToFile} disabled={isLoadingFile || isSaving || !!paramsError}> Salvar em Ficheiro </Button>
                         </span></Tooltip>
                        <Tooltip title="Usar esta configuração na página de Controle do Bot"><span> {/* Span para tooltip em botão desabilitado */}
                            <Button variant="contained" color="primary" startIcon={<SendToMobileIcon />} onClick={handleSendToControlPanel} disabled={isLoadingFile || isSaving || !!paramsError || !game} > Enviar para Controle </Button>
                         </span></Tooltip>
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
};

export default ConfigBuilderPage;
