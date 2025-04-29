// src/pages/admin/AdminUsersPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../../lib/axiosInstance';
import axios from 'axios';
import NewUserDialog from '../../components/admin/NewUserDialog';
import { useSnackbar } from '../../context/SnackbarContext'; // Usar Snackbar para feedback

// MUI Imports
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination'; // **NOVO:** Paginação
import Skeleton from '@mui/material/Skeleton'; // **NOVO:** Skeleton para loading
import AddIcon from '@mui/icons-material/Add';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField'; // Para filtro/busca (placeholder)


// Interface UserData
interface UserData {
    id: number | string;
    username: string;
    role: string;
    createdAt?: string;
}

const ADMIN_API_URL = 'https://restfulfreeapi.onrender.com/api/admin';
const ROWS_PER_PAGE_OPTIONS = [5, 10, 25];

const AdminUsersPage: React.FC = () => {
    const { showSnackbar } = useSnackbar();

    // Estados para diálogos
    const [openNewUserDialog, setOpenNewUserDialog] = useState(false);
    const [userToDelete, setUserToDelete] = useState<UserData | null>(null); // Para confirmação de exclusão
    // const [userToEdit, setUserToEdit] = useState<UserData | null>(null); // Para futuro modal de edição
    const [isDeleting, setIsDeleting] = useState(false); // Loading para exclusão

    // Estados para Listagem e UI/UX
    const [users, setUsers] = useState<UserData[]>([]);
    const [isLoadingList, setIsLoadingList] = useState(false);
    const [listError, setListError] = useState<string | null>(null);
    const [page, setPage] = useState(0); // Para paginação
    const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[1]); // Padrão 10
    const [totalUsers, setTotalUsers] = useState(0); // Total para paginação (viria da API)
    const [filterText, setFilterText] = useState(''); // Para filtro (placeholder)

    // Função para buscar usuários (adaptada para paginação/filtro - placeholder)
    const fetchUsers = useCallback(async () => {
        setIsLoadingList(true);
        setListError(null);
        console.log(`Buscando usuários - Página: ${page + 1}, Rows: ${rowsPerPage}, Filtro: ${filterText}`);
        // TODO: Modificar chamada API para incluir parâmetros de paginação e filtro
        // Ex: /api/admin/users?page=${page + 1}&limit=${rowsPerPage}&search=${filterText}
        try {
            const response = await axiosInstance.get<UserData[]>(`${ADMIN_API_URL}/users`); // MOCK: ainda busca todos
            // MOCK: Simular paginação e filtro no frontend por enquanto
            const filteredUsers = response.data.filter(u =>
                u.username.toLowerCase().includes(filterText.toLowerCase())
            );
            setTotalUsers(filteredUsers.length); // MOCK: Total baseado no filtro
            const paginatedUsers = filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
            setUsers(paginatedUsers || []);
            // setTotalUsers(response.data.totalItems); // <- Usar total real da API
        } catch (error: any) {
            console.error("Erro ao buscar usuários:", error);
            let errorMsg = "Erro de rede ou desconhecido.";
            if (axios.isAxiosError(error) && error.response) {
                 if (error.response.status !== 401) { errorMsg = `Erro ${error.response.status}: ${error.response.data?.message || 'Falha.'}`; }
                 else { errorMsg = "Sessão expirada ou permissão negada."; }
            }
            setListError(errorMsg); showSnackbar(errorMsg, 'error'); setUsers([]); setTotalUsers(0);
        } finally { setIsLoadingList(false); }
    }, [showSnackbar, page, rowsPerPage, filterText]); // Adicionar dependências

    // useEffect para buscar usuários ao montar e quando paginação/filtro mudar
    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    // Handlers para diálogo de Novo Usuário
    const handleOpenNewUserDialog = () => setOpenNewUserDialog(true);
    const handleCloseNewUserDialog = () => setOpenNewUserDialog(false);
    const handleUserCreated = () => { showSnackbar('Usuário criado!', 'success'); fetchUsers(); }; // Rebusca após criar

    // Handlers para Ações de Admin (Placeholders)
    const handleEditUser = (user: UserData) => { showSnackbar(`Editar ${user.username} (Não implementado)`, 'info'); };
    const handleOpenDeleteConfirm = (user: UserData) => { setUserToDelete(user); };
    const handleCloseDeleteConfirm = () => { setUserToDelete(null); };
    const handleConfirmDeleteUser = async () => { /* Placeholder - Lógica API não implementada */ setIsDeleting(true); showSnackbar(`Excluir ${userToDelete?.username} (Não implementado)`, 'warning'); setIsDeleting(false); handleCloseDeleteConfirm(); };

    // Handlers para Paginação
    const handleChangePage = (event: unknown, newPage: number) => { setPage(newPage); };
    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); }; // Volta para primeira página

    // Handler para Filtro (Placeholder)
    const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => { setFilterText(event.target.value); setPage(0); }; // Reseta página ao filtrar

    return (
        <Box sx={{ width: '100%' }}>
            {/* Cabeçalho */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="h4" gutterBottom sx={{ mb: 0 }}> Gerenciar Usuários </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {/* **NOVO:** Campo de Filtro (Placeholder) */}
                    <TextField size="small" label="Filtrar por nome" variant="outlined" value={filterText} onChange={handleFilterChange} />
                    <Tooltip title="Atualizar Lista"><span><IconButton onClick={fetchUsers} disabled={isLoadingList} color="primary"><RefreshIcon /></IconButton></span></Tooltip>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenNewUserDialog}> Novo Usuário </Button>
                </Box>
            </Box>

            {/* Exibição de Erro da Lista */}
            {listError && !isLoadingList && (<Alert severity="error" sx={{ mb: 2 }} onClose={() => setListError(null)}>{listError} <Button onClick={fetchUsers} size="small" color="inherit">Tentar Novamente</Button></Alert>)}

            {/* Tabela de Usuários */}
            <TableContainer component={Paper} elevation={2} sx={{ width: '100%' }}>
                <Table sx={{ minWidth: 650 }} size="small">
                    <TableHead><TableRow><TableCell>ID</TableCell><TableCell>Username</TableCell><TableCell>Role</TableCell><TableCell>Criado Em</TableCell><TableCell align="center">Ações</TableCell></TableRow></TableHead>
                    <TableBody>
                        {isLoadingList ? (
                            // **NOVO:** Usar Skeleton para Loading
                            Array.from(new Array(rowsPerPage)).map((_, index) => (
                                <TableRow key={`skel-${index}`}>
                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                    <TableCell><Skeleton animation="wave" /></TableCell>
                                    <TableCell align="center"><Skeleton animation="wave" width={60} /></TableCell>
                                </TableRow>
                            ))
                        ) : users.length === 0 ? (
                            // **NOVO:** Mensagem mais clara para vazio/erro
                            <TableRow><TableCell colSpan={5} align="center">{listError ? "Erro ao carregar dados." : "Nenhum usuário encontrado." + (filterText ? " para este filtro." : "")}</TableCell></TableRow>
                        ) : (
                            users.map((user) => (
                                <TableRow hover key={user.id}>
                                    <TableCell sx={{ width: '10%' }}>{user.id}</TableCell>
                                    <TableCell sx={{ width: '30%' }}>{user.username}</TableCell>
                                    <TableCell sx={{ width: '15%' }}>{user.role}</TableCell>
                                    <TableCell sx={{ width: '25%' }}>{user.createdAt ? new Date(user.createdAt).toLocaleString() : '---'}</TableCell>
                                    <TableCell align="center" sx={{ width: '20%' }}>
                                         <Tooltip title="Editar (Não implementado)"><span><IconButton size="small" onClick={() => handleEditUser(user)} color="primary" disabled={true}><EditIcon fontSize="small" /></IconButton></span></Tooltip>
                                         <Tooltip title="Excluir (Não implementado)"><span><IconButton size="small" onClick={() => handleOpenDeleteConfirm(user)} color="error" disabled={user.role === 'admin'} ><DeleteIcon fontSize="small" /></IconButton></span></Tooltip>
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
                    count={totalUsers} // Usar total real da API quando disponível
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    labelRowsPerPage="Linhas por página:" // Tradução
                    labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count !== -1 ? count : `mais de ${to}`}`} // Tradução
                 />
            </TableContainer>

            {/* Diálogos */}
            <NewUserDialog open={openNewUserDialog} onClose={handleCloseNewUserDialog} onUserCreated={handleUserCreated}/>
            <Dialog open={!!userToDelete} onClose={handleCloseDeleteConfirm} >
                <DialogTitle>Confirmar Exclusão</DialogTitle>
                <DialogContent><DialogContentText>Excluir <strong>{userToDelete?.username}</strong>? <Typography variant="caption" color="error">(Não implementado)</Typography></DialogContentText></DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDeleteConfirm} color="inherit" disabled={isDeleting}>Cancelar</Button>
                    <Button onClick={handleConfirmDeleteUser} color="error" variant="contained" disabled={isDeleting}>{isDeleting ? <CircularProgress size={20}/> : "Excluir"}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AdminUsersPage;
