// src/pages/HistoryPage.tsx
import React, { useState, useCallback, useEffect } from 'react'; // Adicionado useEffect
import { useSnackbar } from '../context/SnackbarContext'; // Adicionado Snackbar

// MUI Imports
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination'; // **NOVO:** Paginação
import Skeleton from '@mui/material/Skeleton'; // **NOVO:** Skeleton
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton'; // Para refresh
import RefreshIcon from '@mui/icons-material/Refresh'; // Ícone refresh
import Tooltip from '@mui/material/Tooltip'; // Tooltip

// Importar tipos
import type { ResultPayload } from '../electron.d'; // Usar ResultPayload

// Renomear interface local para evitar conflito se necessário, ou usar ResultPayload diretamente
interface HistoryDisplayEntry extends ResultPayload {
    // Adicionar campos específicos da UI se necessário
    duration?: string; // Calcular duração se não vier da API
}

const ROWS_PER_PAGE_OPTIONS = [5, 10, 25];

const HistoryPage: React.FC = () => {
    const api = window.electronAPI; // Obter API
    const { showSnackbar } = useSnackbar(); // Usar Snackbar

    // Estados para Listagem e UI/UX
    const [historyData, setHistoryData] = useState<HistoryDisplayEntry[]>([]); // Iniciar vazio
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedEntry, setSelectedEntry] = useState<HistoryDisplayEntry | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[1]);
    const [totalHistoryItems, setTotalHistoryItems] = useState(0);

    // Função para buscar histórico (com paginação - placeholder)
    const fetchHistory = useCallback(async () => {
        setIsLoading(true); setError(null);
        console.log(`Buscando histórico - Página: ${page + 1}, Rows: ${rowsPerPage}`);
        // TODO: Implementar chamada IPC real com paginação
        // Ex: const result = await api.getHistory({ page: page + 1, limit: rowsPerPage });
        try {
            await new Promise(resolve => setTimeout(resolve, 700)); // Simular delay
            // MOCK DATA (substituir por result.data ou similar)
            const mockResults: ResultPayload[] = [
                 { run_id: 'run-005', outcome: 'Concluído', startTime: new Date(Date.now() - 3600000).toISOString(), endTime: new Date(Date.now() - 3300000).toISOString(), summary: { detections: 0 }, details: { log: "Log run 5..."} },
                 { run_id: 'run-006', outcome: 'Erro', startTime: new Date(Date.now() - 7200000).toISOString(), endTime: new Date(Date.now() - 7000000).toISOString(), summary: { error: "Falha no script X" }, details: { log: "Log run 6..."} },
                 { run_id: 'run-007', outcome: 'Parado', startTime: new Date(Date.now() - 10800000).toISOString(), endTime: new Date(Date.now() - 10700000).toISOString(), summary: "Parado pelo utilizador", details: { log: "Log run 7..."} },
                 // Adicionar mais mocks para testar paginação
                 ...Array.from({ length: 15 }, (_, i) => ({
                     run_id: `run-mock-${i + 8}`,
                     outcome: (i % 3 === 0 ? 'Concluído' : i % 3 === 1 ? 'Erro' : 'Parado') as ResultPayload['outcome'],
                     startTime: new Date(Date.now() - (i + 3) * 3600000).toISOString(),
                     endTime: new Date(Date.now() - (i + 3) * 3600000 + 600000).toISOString(),
                     summary: `Mock summary ${i + 8}`,
                     details: { log: `Mock log ${i + 8}` }
                 }))
            ];
            // MOCK: Paginação no frontend
            setTotalHistoryItems(mockResults.length); // MOCK
            const paginatedResults = mockResults.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

            // Calcular duração (exemplo)
            const displayData = paginatedResults.map(item => ({
                ...item,
                duration: item.startTime && item.endTime ? `${Math.round((new Date(item.endTime).getTime() - new Date(item.startTime).getTime()) / 60000)} min` : 'N/A'
            }));
            setHistoryData(displayData);
            // setTotalHistoryItems(result.totalItems || 0); // <- Usar total real da API
        } catch (err: any) {
            console.error("Erro ao buscar histórico:", err);
            setError(err.message || 'Falha ao buscar histórico.');
            setHistoryData([]); setTotalHistoryItems(0);
        } finally { setIsLoading(false); }
    }, [page, rowsPerPage]); // Adicionar dependências

    // useEffect para buscar ao montar e quando paginação mudar
    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    // Listener para novos resultados (opcional, pode apenas rebuscar com refresh)
     useEffect(() => {
        if (!api) return;
        const unsubscribe = api.on('main:bot-result', (payload: ResultPayload) => {
             console.log("HistoryPage: Novo resultado recebido via listener", payload);
             // Simplesmente rebuscar a primeira página para mostrar o mais recente
             // Ou adicionar na lista se estiver na primeira página? Depende da UX desejada.
             if (page === 0) {
                 fetchHistory(); // Rebusca a página atual (que é a 0)
             } else {
                 showSnackbar("Nova execução finalizada. Atualize para ver.", "info");
             }
        });
        return () => unsubscribe();
     }, [api, fetchHistory, page, showSnackbar]); // Adicionar showSnackbar

    // Função para obter cor do Chip de status
    const getStatusColor = useCallback((status: ResultPayload['outcome']): ('success' | 'error' | 'warning' | 'default') => {
        switch(status) {
            case 'Concluído': return 'success';
            case 'Erro': return 'error';
            case 'Parado': return 'warning';
            default: return 'default';
        }
    }, []);

    // Handler para ver detalhes
    const handleViewDetails = useCallback(async (entry: HistoryDisplayEntry) => {
        setSelectedEntry(entry); setIsDetailsModalOpen(true); setIsLoadingDetails(true);
        console.log(`[React] Ver detalhes para: ${entry.run_id}`);
        // TODO: Implementar busca real dos detalhes via IPC
        // Ex: const detailsData = await api.getHistoryDetails(entry.run_id);
        try {
            await new Promise(resolve => setTimeout(resolve, 500)); // Simular delay
            // Usar detalhes já mockados ou buscar novamente
            setSelectedEntry(prev => prev ? { ...prev, details: entry.details || { info: "Detalhes não disponíveis."} } : null);
        } catch (err) {
            console.error("Erro ao buscar detalhes:", err);
            setSelectedEntry(prev => prev ? { ...prev, details: { error: "Falha ao carregar detalhes." } } : null);
        } finally { setIsLoadingDetails(false); }
    }, []);

    // Handler para fechar modal
    const handleCloseDetailsModal = useCallback(() => { setIsDetailsModalOpen(false); setTimeout(() => { setSelectedEntry(null); setIsLoadingDetails(false); }, 300); }, []);

    // Handlers para Paginação
    const handleChangePage = (event: unknown, newPage: number) => { setPage(newPage); };
    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); };

    return (
        <Box>
            {/* Cabeçalho com Refresh */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                 <Typography variant="h4" gutterBottom sx={{ mb: 0 }}> Histórico de Testes </Typography>
                 <Tooltip title="Atualizar Histórico"><span><IconButton onClick={fetchHistory} disabled={isLoading} color="primary"><RefreshIcon /></IconButton></span></Tooltip>
            </Box>

            {error && !isLoading && (<Alert severity="error" sx={{ mb: 2 }}>{error} <Button onClick={fetchHistory} size="small" color="inherit">Tentar Novamente</Button></Alert>)}

            <TableContainer component={Paper} elevation={2}>
                <Table sx={{ minWidth: 650 }} aria-label="Tabela de histórico" size="small">
                    <TableHead><TableRow><TableCell>ID Execução</TableCell><TableCell>Sumário/Config</TableCell><TableCell>Início</TableCell><TableCell>Fim</TableCell><TableCell>Duração</TableCell><TableCell align="center">Status Final</TableCell><TableCell align="center">Ações</TableCell></TableRow></TableHead>
                    <TableBody>
                        {isLoading ? (
                            // **NOVO:** Skeleton
                            Array.from(new Array(rowsPerPage)).map((_, index) => (
                                <TableRow key={`skel-${index}`}>
                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                    <TableCell align="center"><Skeleton animation="wave" width="60px" /></TableCell>
                                    <TableCell align="center"><Skeleton animation="wave" width={60} /></TableCell>
                                </TableRow>
                            ))
                        ) : historyData.length === 0 ? (
                             <TableRow><TableCell colSpan={7} align="center">{error ? "Erro ao carregar dados." : "Nenhum histórico encontrado."}</TableCell></TableRow>
                        ) : (
                            historyData.map((row) => (
                                <TableRow hover key={row.run_id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                    <TableCell component="th" scope="row" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.run_id.substring(0, 12)}...</TableCell>
                                    <TableCell>{typeof row.summary === 'string' ? row.summary : (row.summary as any)?.configName || JSON.stringify(row.summary)}</TableCell> {/* Exibir nome da config se disponível */}
                                    <TableCell>{new Date(row.startTime).toLocaleString()}</TableCell>
                                    <TableCell>{new Date(row.endTime).toLocaleString()}</TableCell>
                                    <TableCell>{row.duration || 'N/A'}</TableCell>
                                    <TableCell align="center"><Chip label={row.outcome} color={getStatusColor(row.outcome)} size="small"/></TableCell>
                                    <TableCell align="center"><Button variant="outlined" size="small" onClick={() => handleViewDetails(row)}> Detalhes </Button></TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                 {/* **NOVO:** Paginação */}
                 <TablePagination
                    rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
                    component="div"
                    count={totalHistoryItems}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    labelRowsPerPage="Linhas por página:"
                    labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count !== -1 ? count : `mais de ${to}`}`}
                 />
            </TableContainer>

            {/* Modal de Detalhes */}
            <Dialog open={isDetailsModalOpen} onClose={handleCloseDetailsModal} maxWidth="md" fullWidth>
                <DialogTitle>Detalhes da Execução: {selectedEntry?.run_id}</DialogTitle>
                <DialogContent>
                    {isLoadingDetails ? (<Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>)
                    : selectedEntry?.details?.error ? (<Alert severity="error">{selectedEntry.details.error}</Alert>)
                    : selectedEntry?.details ? (
                        <DialogContentText component="div">
                            <Typography variant="h6" gutterBottom>Sumário</Typography>
                            <pre style={{ background: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>{JSON.stringify(selectedEntry.summary || { info: "Nenhum sumário disponível." }, null, 2)}</pre>
                            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>Log</Typography>
                            <pre style={{ maxHeight: '400px', overflowY: 'auto', background: '#f5f5f5', padding: '8px', border: '1px solid #ddd', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {JSON.stringify(selectedEntry.details.log || "Nenhum log disponível.", null, 2)} {/* Exemplo: formatar log se for objeto */}
                            </pre>
                        </DialogContentText>
                    ) : (<DialogContentText>Nenhum detalhe disponível.</DialogContentText>)}
                </DialogContent>
                <DialogActions><Button onClick={handleCloseDetailsModal}>Fechar</Button></DialogActions>
            </Dialog>
        </Box>
    );
};

export default HistoryPage;
