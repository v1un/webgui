// src/components/admin/NewUserDialog.tsx
import React, { useState, useEffect } from 'react';
import axiosInstance from '../../lib/axiosInstance';
import axios from 'axios';
import { useSnackbar } from '../../context/SnackbarContext';

// MUI Imports
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import FormHelperText from '@mui/material/FormHelperText'; // **NOVO:** Para hints

// Sugestão: Usar react-hook-form + zod/yup

const ADMIN_API_URL = 'https://restfulfreeapi.onrender.com/api/admin';

interface NewUserDialogProps {
    open: boolean;
    onClose: () => void;
    onUserCreated: () => void;
}

const NewUserDialog: React.FC<NewUserDialogProps> = ({ open, onClose, onUserCreated }) => {
    const { showSnackbar } = useSnackbar();

    // Estados do formulário
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('user');
    const [loading, setLoading] = useState(false);

    // Resetar form ao FECHAR
    useEffect(() => {
        if (!open) {
            const timer = setTimeout(() => { setUsername(''); setPassword(''); setRole('user'); setLoading(false); }, 150);
            return () => clearTimeout(timer);
        }
    }, [open]);

    // Fechar manualmente
    const handleClose = () => { if (!loading) { onClose(); } };

    // Lidar com a submissão
    const handleSubmit = async () => {
        setLoading(true);

        // Validação básica (substituir)
        if (!username.trim() || !password.trim()) {
            showSnackbar("Usuário e senha são obrigatórios.", 'warning'); setLoading(false); return;
        }
         // **NOVO:** Validação de senha (exemplo simples)
        if (password.length < 6) {
             showSnackbar('A senha deve ter pelo menos 6 caracteres.', 'warning'); setLoading(false); return;
        }

        try {
            const response = await axiosInstance.post(`${ADMIN_API_URL}/users`, { username, password, role });
            if (response.status === 201) { onUserCreated(); onClose(); }
            else { showSnackbar(response.data?.message || "Resposta inesperada.", 'error'); }
        } catch (err: any) {
            console.error("Erro ao criar usuário:", err);
            let errorMsg = "Erro ao criar usuário.";
            if (axios.isAxiosError(err) && err.response) {
                 if (err.response.status !== 401) { errorMsg = `Erro ${err.response.status}: ${err.response.data?.message || 'Falha.'}`; }
                 else { errorMsg = "Sessão expirada ou permissão negada."; }
            }
            showSnackbar(errorMsg, 'error');
        } finally { setLoading(false); }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ mb: 2 }}> Insira os detalhes do novo usuário. </DialogContentText>
                <Box component="form" noValidate autoComplete="off">
                    <TextField
                        autoFocus required margin="dense" id="new-username" label="Nome de Usuário" type="text"
                        fullWidth variant="outlined" value={username} onChange={(e) => setUsername(e.target.value)}
                        disabled={loading}
                        // helperText="Pelo menos 3 caracteres" // Exemplo validação
                    />
                    <TextField
                        required margin="dense" id="new-password" label="Senha" type="password"
                        fullWidth variant="outlined" value={password} onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        helperText="Pelo menos 6 caracteres" // **NOVO:** Hint de validação
                    />
                    <FormControl fullWidth margin="dense" variant="outlined" disabled={loading}>
                        <InputLabel id="role-select-label">Papel (Role)</InputLabel>
                        <Select labelId="role-select-label" id="role-select" value={role} label="Papel (Role)" onChange={(e: SelectChangeEvent) => setRole(e.target.value as string)} >
                            <MenuItem value={'user'}>User</MenuItem>
                            <MenuItem value={'admin'}>Admin</MenuItem>
                            <MenuItem value={'moderator'}>Moderator</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: '16px 24px' }}>
                <Button onClick={handleClose} disabled={loading} color="inherit">Cancelar</Button>
                <Button onClick={handleSubmit} disabled={loading} variant="contained"> {loading ? <CircularProgress size={24} color="inherit" /> : 'Criar Usuário'} </Button>
            </DialogActions>
        </Dialog>
    );
};

export default NewUserDialog;
