// src/pages/admin/AdminInviteCodesPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../../lib/axiosInstance';
import axios from 'axios';
import { useSnackbar } from '../../context/SnackbarContext';

// MUI Imports
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination'; // **NOVO:** Paginação
import Skeleton from '@mui/material/Skeleton'; // **NOVO:** Skeleton
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import Tooltip from '@mui/material/Tooltip';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
// import FilterListIcon from '@mui/icons-material/FilterList'; // Para filtro (exemplo)
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import FormControl from '@mui/material/FormControl'; // Para filtro de status
import InputLabel from '@mui/material/InputLabel'; // Para filtro de status
import Select, { SelectChangeEvent } from '@mui/material/Select'; // Para filtro de status
import MenuItem from '@mui/material/MenuItem'; // Para filtro de status


// Interface InviteCode
interface InviteCode {
    id: number | string;
    code: string;
    is_used: boolean;
    created_at: string;
    used_by_user_id?: number | string | null;
}

const ADMIN_API_URL = 'https://restfulfreeapi.onrender.com/api/admin';
const ROWS_PER_PAGE_OPTIONS = [10, 25, 50];

interface ListCodesResponse {
    codes: InviteCode[];
    // Adicionar totalItems, etc., se a API suportar paginação
    totalItems?: number;
}

const AdminInviteCodesPage: React.FC = () => {
    const { showSnackbar } = useSnackbar();

    // Estados para Geração
    const [quantity, setQuantity] = useState<number | string>(1);
    const [loadingGenerate, setLoadingGenerate] = useState(false);

    // Estados para Listagem e UI/UX
    const [codes, setCodes] = useState<InviteCode[]>([]);
    const [isLoadingList, setIsLoadingList] = useState(false);
    const [listError, setListError] = useState<string | null>(null);
    const [codeToRevoke, setCodeToRevoke] = useState<InviteCode | null>(null);
    const [isRevoking, setIsRevoking] = useState(false);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[0]);
    const [totalCodes, setTotalCodes] = useState(0);
    const [filterText, setFilterText] = useState(''); // Filtro por código (placeholder)
    const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'used'>('all'); // Filtro por status

    // Função para buscar códigos (adaptada para paginação/filtro - placeholder)
    const fetchCodes = useCallback(async () => {
        setIsLoadingList(true); setListError(null);
        console.log(`Buscando códigos - Página: ${page + 1}, Rows: ${rowsPerPage}, Filtro: ${filterText}, Status: ${filterStatus}`);
        // TODO: Modificar chamada API para incluir parâmetros
        // Ex: /api/admin/invite-codes?page=${page + 1}&limit=${rowsPerPage}&search=${filterText}&status=${filterStatus}
        try {
            const response = await axiosInstance.get<ListCodesResponse>(`${ADMIN_API_URL}/invite-codes`);
            // MOCK: Simular filtro e paginação no frontend
            const filteredCodes = (response.data?.codes || []).filter(c => {
                const matchesText = c.code.toLowerCase().includes(filterText.toLowerCase());
                const matchesStatus = filterStatus === 'all' || (filterStatus === 'available' && !c.is_used) || (filterStatus === 'used' && c.is_used);
                return matchesText && matchesStatus;
            });
            setTotalCodes(filteredCodes.length); // MOCK
            const paginatedCodes = filteredCodes.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
            setCodes(paginatedCodes);
            // setTotalCodes(response.data.totalItems || 0); // <- Usar total real da API
        } catch (error: any) {
            console.error("Erro ao buscar códigos:", error);
            let errorMsg = "Erro ao buscar códigos.";
            if (axios.isAxiosError(error) && error.response) {
                 if (error.response.status !== 401) { errorMsg = `Erro ${error.response.status}: ${error.response.data?.message || 'Falha.'}`; }
                 else { errorMsg = "Sessão expirada ou permissão negada."; }
            }
            setListError(errorMsg); showSnackbar(errorMsg, 'error'); setCodes([]); setTotalCodes(0);
        } finally { setIsLoadingList(false); }
    }, [showSnackbar, page, rowsPerPage, filterText, filterStatus]); // Adicionar dependências

    // useEffect para buscar códigos
    useEffect(() => { fetchCodes(); }, [fetchCodes]);

    // Handler para gerar códigos
    const handleGenerateCodes = async () => { /* ... (sem alterações) ... */ setLoadingGenerate(true); const numQuantity = Number(quantity); if (isNaN(numQuantity) || numQuantity <= 0 || !Number.isInteger(numQuantity)) { showSnackbar("Quantidade inválida.", 'warning'); setLoadingGenerate(false); return; } try { const response = await axiosInstance.post<{ codes: InviteCode[], message?: string }>(`${ADMIN_API_URL}/invite-codes`, { quantity: numQuantity }); const createdCodes = response.data.codes || []; const count = createdCodes.length; showSnackbar(response.data.message || `${count} código(s) gerado(s)!`, 'success'); setQuantity(1); fetchCodes(); } catch (error: any) { console.error("Erro ao gerar códigos:", error); let errorMsg = "Erro ao gerar códigos."; if (axios.isAxiosError(error) && error.response) { if (error.response.status !== 401) { errorMsg = `Erro ${error.response.status}: ${error.response.data?.message || 'Falha.'}`; } else { errorMsg = "Sessão expirada ou permissão negada."; } } showSnackbar(errorMsg, 'error'); } finally { setLoadingGenerate(false); } };
    const handleQuantityChange = (event: React.ChangeEvent<HTMLInputElement>) => { const value = event.target.value; setQuantity(value === '' ? '' : Number(value)); };
    const handleCopyCode = (code: string) => { navigator.clipboard.writeText(code).then(() => showSnackbar(`Código "${code}" copiado!`, 'success')).catch(err => { console.error('Falha ao copiar:', err); showSnackbar('Falha ao copiar.', 'error'); }); };

    // Handlers para Revogar Código (Placeholders)
    const handleOpenRevokeConfirm = (code: InviteCode) => { setCodeToRevoke(code); };
    const handleCloseRevokeConfirm = () => { setCodeToRevoke(null); };
    const handleConfirmRevokeCode = async () => { /* Placeholder */ setIsRevoking(true); showSnackbar(`Revogar ${codeToRevoke?.code} (Não implementado)`, 'warning'); setIsRevoking(false); handleCloseRevokeConfirm(); };

    // Handlers para Paginação e Filtros
    const handleChangePage = (event: unknown, newPage: number) => { setPage(newPage); };
    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); };
    const handleFilterTextChange = (event: React.ChangeEvent<HTMLInputElement>) => { setFilterText(event.target.value); setPage(0); };
    const handleFilterStatusChange = (event: SelectChangeEvent) => { setFilterStatus(event.target.value as 'all' | 'available' | 'used'); setPage(0); };


    return (
        <Box>
            <Typography variant="h4" gutterBottom>Gerenciar Códigos de Convite</Typography>

            {/* Seção de Geração */}
            <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Gerar Novos Códigos</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <TextField label="Quantidade" type="number" value={quantity} onChange={handleQuantityChange} InputProps={{ inputProps: { min: 1, step: 1 } }} sx={{ maxWidth: 150 }} size="small" disabled={loadingGenerate} variant="outlined" error={Number(quantity) <= 0 && quantity !== ''} helperText={Number(quantity) <= 0 && quantity !== '' ? "Inválido" : ""} />
                    <Button variant="contained" onClick={handleGenerateCodes} disabled={loadingGenerate || Number(quantity) <= 0 || quantity === ''} startIcon={loadingGenerate ? <CircularProgress size={20}/> : null} > Gerar Códigos </Button>
                </Box>
            </Paper>

            {/* Seção de Listagem e Filtros */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>Códigos Existentes</Typography>
                 <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                     {/* **NOVO:** Filtros */}
                     <TextField size="small" label="Filtrar código" variant="outlined" value={filterText} onChange={handleFilterTextChange} InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>), }}/>
                     <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel id="status-filter-label">Status</InputLabel>
                        <Select labelId="status-filter-label" value={filterStatus} label="Status" onChange={handleFilterStatusChange} >
                            <MenuItem value="all">Todos</MenuItem>
                            <MenuItem value="available">Disponível</MenuItem>
                            <MenuItem value="used">Usado</MenuItem>
                        </Select>
                     </FormControl>
                     <Tooltip title="Atualizar Lista"><span><IconButton onClick={fetchCodes} disabled={isLoadingList} color="primary"><RefreshIcon /></IconButton></span></Tooltip>
                 </Box>
            </Box>

            {/* Exibição de Erro da Lista */}
            {listError && !isLoadingList && (<Alert severity="error" sx={{ mb: 2 }} onClose={() => setListError(null)}>{listError} <Button onClick={fetchCodes} size="small" color="inherit">Tentar Novamente</Button></Alert>)}

            <TableContainer component={Paper} elevation={2}>
                <Table sx={{ minWidth: 650 }} size="small">
                    <TableHead><TableRow><TableCell sx={{ width: '35%' }}>Código</TableCell><TableCell align="center" sx={{ width: '15%' }}>Status</TableCell><TableCell sx={{ width: '25%' }}>Data Criação</TableCell><TableCell sx={{ width: '10%' }}>Usado Por (ID)</TableCell><TableCell align="center" sx={{ width: '15%' }}>Ações</TableCell></TableRow></TableHead>
                    <TableBody>
                        {isLoadingList ? (
                            // **NOVO:** Skeleton
                             Array.from(new Array(rowsPerPage)).map((_, index) => (
                                <TableRow key={`skel-${index}`}>
                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                    <TableCell align="center"><Skeleton animation="wave" width="60px" /></TableCell>
                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                    <TableCell align="center"><Skeleton animation="wave" width={60} /></TableCell>
                                </TableRow>
                            ))
                        ) : codes.length === 0 ? (
                             <TableRow><TableCell colSpan={5} align="center">{listError ? "Erro ao carregar dados." : "Nenhum código encontrado." + (filterText || filterStatus !== 'all' ? " para este filtro." : "")}</TableCell></TableRow>
                        ) : (
                            codes.map((row) => (
                                <TableRow hover key={row.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                    <TableCell sx={{ fontFamily: 'monospace' }}>{row.code}</TableCell>
                                    <TableCell align="center"><Chip label={row.is_used ? 'Usado' : 'Disponível'} color={row.is_used ? 'default' : 'success'} size="small"/></TableCell>
                                    <TableCell>{row.created_at ? new Date(row.created_at).toLocaleString() : '---'}</TableCell>
                                    <TableCell>{row.used_by_user_id || '---'}</TableCell>
                                    <TableCell align="center">
                                        <Tooltip title="Copiar Código"><span><IconButton size="small" onClick={() => handleCopyCode(row.code)} color="primary" disabled={row.is_used}><ContentCopyIcon fontSize="small" /></IconButton></span></Tooltip>
                                        <Tooltip title="Revogar (Não implementado)"><span><IconButton size="small" onClick={() => handleOpenRevokeConfirm(row)} color="error" disabled={row.is_used}><DeleteIcon fontSize="small" /></IconButton></span></Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                 {/* **NOVO:** Paginação */}
                 <TablePagination
                    rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
                    component="div"
                    count={totalCodes}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    labelRowsPerPage="Linhas por página:"
                    labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count !== -1 ? count : `mais de ${to}`}`}
                 />
            </TableContainer>

             {/* Diálogo de Confirmação de Revogar Código */}
             <Dialog open={!!codeToRevoke} onClose={handleCloseRevokeConfirm} >
                <DialogTitle>Confirmar Revogação</DialogTitle>
                <DialogContent><DialogContentText>Revogar <strong>{codeToRevoke?.code}</strong>? <Typography variant="caption" color="error">(Não implementado)</Typography></DialogContentText></DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseRevokeConfirm} color="inherit" disabled={isRevoking}>Cancelar</Button>
                    <Button onClick={handleConfirmRevokeCode} color="error" variant="contained" disabled={isRevoking}>{isRevoking ? <CircularProgress size={20}/> : "Revogar"}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
export default AdminInviteCodesPage;
