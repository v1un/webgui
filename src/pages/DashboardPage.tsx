// src/pages/DashboardPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useConfigStore } from '../store/configStore'; // Para obter config ativa
import { useSnackbar } from '../context/SnackbarContext'; // Adicionado Snackbar

// MUI Imports
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid'; // Usaremos Grid aqui para layout do dashboard
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link'; // Para links rápidos
import SmartToyIcon from '@mui/icons-material/SmartToy'; // Ícones relevantes
import HistoryIcon from '@mui/icons-material/History';
import BuildIcon from '@mui/icons-material/Build';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew'; // Ou StopCircleIcon

// Importar tipos do electron.d.ts
import type { BotState, BotStatusPayload, ResultPayload, LogPayload } from '../electron.d'; // Adicionar LogPayload

const DashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const api = window.electronAPI; // Obter API do preload
    const { showSnackbar } = useSnackbar(); // Usar Snackbar

    // Estados Globais
    const user = useAuthStore((state) => state.user);
    const fetchProfile = useAuthStore((state) => state.fetchProfile);
    const isLoadingProfile = useAuthStore((state) => state.isLoadingProfile);
    const profileError = useAuthStore((state) => state.profileError);
    const activeConfig = useConfigStore((state) => state.activeConfig);

    // Estados Locais do Dashboard
    const [botState, setBotState] = useState<BotState>('Ocioso'); // Estado atual do bot
    const [lastStatusDetails, setLastStatusDetails] = useState<BotStatusPayload['details'] | undefined>(undefined);
    const [recentHistory, setRecentHistory] = useState<ResultPayload[]>([]); // Últimas execuções
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [isProcessingAction, setIsProcessingAction] = useState(false); // Para botões Start/Stop rápidos

    // Buscar perfil ao montar (se necessário)
    useEffect(() => {
        if (!user && !isLoadingProfile && !profileError) {
            fetchProfile();
        }
    }, [user, fetchProfile, isLoadingProfile, profileError]);

    // Buscar histórico recente e status atual ao montar e ouvir atualizações
    useEffect(() => {
        if (!api) return; // Sair se API não estiver disponível

        let statusUnsubscribe: (() => void) | undefined;
        let resultUnsubscribe: (() => void) | undefined; // Listener para novos resultados

        // Função para buscar histórico inicial
        const fetchInitialData = async () => {
            setIsLoadingHistory(true);
            setHistoryError(null);
            // TODO: Implementar IPC real para buscar histórico e status inicial
            console.log("Dashboard: Buscando histórico recente e status inicial (simulado)...");
            try {
                // const initialStatus = await api.getCurrentStatus(); // Exemplo
                // const historyData = await api.getRecentHistory(3); // Exemplo: buscar 3 últimos
                await new Promise(resolve => setTimeout(resolve, 500)); // Simular delay
                // setBotState(initialStatus.state || 'Ocioso');
                // setLastStatusDetails(initialStatus.details);
                // setRecentHistory(historyData || []);
                setBotState('Ocioso'); // Mock
                setRecentHistory([]); // Mock
            } catch (err: any) {
                console.error("Erro ao buscar dados iniciais do dashboard:", err);
                setHistoryError("Falha ao carregar dados recentes.");
                setBotState('Erro'); // Indicar erro no status
            } finally {
                setIsLoadingHistory(false);
            }
        };

        fetchInitialData();

        // Ouvir atualizações de status
        statusUnsubscribe = api.on('main:bot-status-update', (payload: BotStatusPayload) => {
            setBotState(payload.state);
            setLastStatusDetails(payload.details || undefined);
            if (payload.state === 'Ocioso' || payload.state === 'Erro') {
                setIsProcessingAction(false); // Resetar flag de ação
            }
        });

        // Ouvir novos resultados para atualizar histórico recente (exemplo)
        resultUnsubscribe = api.on('main:bot-result', (payload: ResultPayload) => {
             console.log("Dashboard: Novo resultado recebido", payload);
             setRecentHistory(prev => [payload, ...prev].slice(0, 3)); // Adiciona no início, mantém 3
        });


        // Limpeza ao desmontar
        return () => {
            console.log("Removendo listeners IPC do Dashboard...");
            if (statusUnsubscribe) statusUnsubscribe();
            if (resultUnsubscribe) resultUnsubscribe();
        };

    }, [api]); // Dependência da API do preload

    // Função para obter cor do Chip de status
     const getStatusColor = useCallback((status: BotState): ('default' | 'success' | 'error' | 'warning' | 'info') => {
        switch(status) {
            case 'Rodando': return 'success';
            case 'Erro': return 'error';
            case 'Parando': return 'warning';
            case 'initializing': return 'info';
            case 'Ocioso': default: return 'default';
        }
    }, []);

     // --- Placeholders para Ações Rápidas ---
     const handleQuickStart = async () => {
        if (!activeConfig) { showSnackbar("Nenhuma configuração ativa para iniciar.", "warning"); return; }
        if (!api?.startAndConfigureBot) { showSnackbar("Erro: API indisponível.", "error"); return; }
        setIsProcessingAction(true);
        try {
            const result = await api.startAndConfigureBot(activeConfig);
            if (!result.success) {
                 showSnackbar(result.message || 'Falha ao iniciar o Bot.', 'error');
                 setIsProcessingAction(false); setBotState('Erro');
            } else {
                 showSnackbar('Comando de início enviado.', 'info');
                 // Status será atualizado pelo listener
            }
        } catch (error: any) {
            showSnackbar(`Erro de comunicação ao iniciar: ${error.message}`, 'error');
            setIsProcessingAction(false); setBotState('Erro');
        }
    };
     const handleQuickStop = async () => {
        if (!api?.stopBot) { showSnackbar("Erro: API indisponível.", "error"); return; }
        setIsProcessingAction(true); setBotState('Parando');
        try {
            const result = await api.stopBot();
            if (!result.success) {
                 showSnackbar(result.message || 'Falha ao parar o Bot.', 'error');
                 setIsProcessingAction(false);
            } else {
                 showSnackbar('Comando de parada enviado.', 'info');
                  // Status será atualizado pelo listener
            }
        } catch (error: any) {
            showSnackbar(`Erro de comunicação ao parar: ${error.message}`, 'error');
            setIsProcessingAction(false);
        }
    };
     // --- Fim Placeholders Ações Rápidas ---

    // Renderização do perfil do usuário
    let userContent;
    if (isLoadingProfile) { userContent = <CircularProgress size={20} />; }
    else if (profileError) { userContent = <Typography color="error" variant="caption">Erro: {profileError}</Typography>; }
    else if (user) { userContent = <Typography variant="body1">Bem-vindo, <strong>{user.username}</strong> ({user.role})!</Typography>; }
    else { userContent = <Typography variant="body1">Bem-vindo!</Typography>; }

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Dashboard Principal
            </Typography>

            {/* Saudação e Status do Perfil */}
            <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                {userContent}
            </Paper>

            {/* Substituir Grid por Box com Flexbox */}
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' }, // Colunas em telas médias, empilhadas em pequenas
                    gap: 3,
                    mb: 3
                }}
            >
                {/* Coluna 1: Status do Bot e Ações Rápidas */}
                <Box sx={{ flexBasis: { xs: '100%', md: '50%' }, display: 'flex' }}>
                    <Paper elevation={2} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>
                        <Typography variant="h6">Status do Bot</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip label={botState} color={getStatusColor(botState)} />
                            {(isProcessingAction || botState === 'initializing' || botState === 'Parando') && <CircularProgress size={20} />}
                        </Box>
                        {lastStatusDetails?.message && (
                            <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
                                Detalhe: {lastStatusDetails.message}
                            </Typography>
                        )}
                         <Divider sx={{ my: 1 }} />
                         <Typography variant="subtitle1">Ações Rápidas</Typography>
                         <Box sx={{ display: 'flex', gap: 2 }}>
                             <Button
                                variant="contained"
                                color="success"
                                size="small"
                                startIcon={<PlayCircleOutlineIcon />}
                                onClick={handleQuickStart}
                                disabled={!activeConfig || botState === 'Rodando' || botState === 'initializing' || botState === 'Parando' || isProcessingAction}
                             >
                                Iniciar Config Ativa
                             </Button>
                             <Button
                                variant="contained"
                                color="error"
                                size="small"
                                startIcon={<PowerSettingsNewIcon />}
                                onClick={handleQuickStop}
                                disabled={botState !== 'Rodando' || isProcessingAction}
                             >
                                Parar Bot
                             </Button>
                         </Box>
                         <Typography variant="caption" sx={{ mt: 1 }}>
                            Configuração Ativa: {activeConfig ? (activeConfig.configName || 'Sem Nome') : 'Nenhuma'}
                         </Typography>
                    </Paper>
                </Box>

                {/* Coluna 2: Histórico Recente e Links Úteis */}
                <Box sx={{ flexBasis: { xs: '100%', md: '50%' }, display: 'flex' }}>
                    <Paper elevation={2} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>
                        <Typography variant="h6">Histórico Recente</Typography>
                        {isLoadingHistory ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}><CircularProgress /></Box>
                        ) : historyError ? (
                            <Alert severity="warning" sx={{ width: '100%' }}>{historyError}</Alert>
                        ) : recentHistory.length === 0 ? (
                            <Typography variant="body2" sx={{ fontStyle: 'italic' }}>Nenhuma execução recente.</Typography>
                        ) : (
                            <List dense disablePadding>
                                {recentHistory.map((item) => (
                                    <ListItem key={item.run_id} disableGutters divider>
                                        <ListItemText
                                            primary={`${item.summary || 'Execução'} (${item.outcome})`}
                                            secondary={`Início: ${new Date(item.startTime).toLocaleString()} - Fim: ${new Date(item.endTime).toLocaleString()}`}
                                        />
                                        <Chip label={item.outcome} size="small" color={item.outcome === 'Concluído' ? 'success' : item.outcome === 'Erro' ? 'error' : 'warning'}/>
                                    </ListItem>
                                ))}
                            </List>
                        )}
                        <Button variant="outlined" size="small" startIcon={<HistoryIcon />} onClick={() => navigate('/history')} sx={{ mt: 'auto' }}>
                            Ver Histórico Completo
                        </Button>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle1">Acesso Rápido</Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                             <Link component="button" variant="body2" onClick={() => navigate('/bot-control')} sx={{ textAlign: 'left' }}> <SmartToyIcon fontSize="inherit" sx={{ verticalAlign: 'bottom', mr: 0.5 }}/> Ir para Controle do Bot </Link>
                             <Link component="button" variant="body2" onClick={() => navigate('/config-builder')} sx={{ textAlign: 'left' }}> <BuildIcon fontSize="inherit" sx={{ verticalAlign: 'bottom', mr: 0.5 }}/> Abrir Construtor de Configuração </Link>
                        </Box>
                    </Paper>
                </Box>
            </Box>

        </Box>
    );
};

export default DashboardPage;
