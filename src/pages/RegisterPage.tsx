// src/pages/RegisterPage.tsx
import React, { useState } from 'react';
import axiosInstance from '../lib/axiosInstance';
import axios from 'axios';
import { Link as RouterLink } from 'react-router-dom';
import { useSnackbar } from '../context/SnackbarContext';

// MUI Imports
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import CircularProgress from '@mui/material/CircularProgress';
import Avatar from '@mui/material/Avatar';
import AdbIcon from '@mui/icons-material/Adb';
// **NOVO:** Ícones
import AccountCircle from '@mui/icons-material/AccountCircle';
import LockIcon from '@mui/icons-material/Lock';
import KeyIcon from '@mui/icons-material/Key'; // Ícone para código de convite
import InputAdornment from '@mui/material/InputAdornment';

// Sugestão: Usar react-hook-form + zod/yup

const API_URL = 'https://restfulfreeapi.onrender.com/api/auth';

const RegisterPage: React.FC = () => {
    const { showSnackbar } = useSnackbar();

    // Estados locais
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [loading, setLoading] = useState(false);

    // Handler para submissão
    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setLoading(true);

        // Validação básica (substituir)
        if (!username.trim() || !password.trim() || !inviteCode.trim()) {
            showSnackbar('Todos os campos são obrigatórios.', 'warning'); setLoading(false); return;
        }
        // **NOVO:** Validação de senha (exemplo simples)
        if (password.length < 6) {
             showSnackbar('A senha deve ter pelo menos 6 caracteres.', 'warning'); setLoading(false); return;
        }

        try {
            const response = await axiosInstance.post(`${API_URL}/register`, { username, password, inviteCode });
            if (response.status === 201) {
                showSnackbar('Registro bem-sucedido! Você já pode fazer login.', 'success');
                setUsername(''); setPassword(''); setInviteCode('');
            } else { showSnackbar(response.data?.message || 'Resposta inesperada.', 'warning'); }
        } catch (err: any) {
            console.error('Erro no Registro:', err);
            let errorMsg = "Erro de rede ou desconhecido.";
            if (axios.isAxiosError(err) && err.response) {
                 if (err.response.status === 400) { errorMsg = err.response.data?.message || 'Código inválido ou dados incorretos.'; }
                 else if (err.response.status === 409) { errorMsg = err.response.data?.message || 'Nome de usuário já em uso.'; }
                 else { errorMsg = `Erro ${err.response.status}: ${err.response.data?.message || 'Falha.'}`; }
            }
            showSnackbar(errorMsg, 'error');
        } finally { setLoading(false); }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}> <AdbIcon /> </Avatar>
                <Typography component="h1" variant="h5"> JJbot Registro </Typography>
                <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
                    <TextField
                        margin="normal" required fullWidth id="username" label="Usuário" name="username"
                        autoComplete="username" autoFocus value={username}
                        onChange={(e) => setUsername(e.target.value)} disabled={loading}
                        InputProps={{ startAdornment: ( <InputAdornment position="start"> <AccountCircle /> </InputAdornment> ), }}
                        // helperText="Pelo menos 3 caracteres" // Exemplo validação
                    />
                    <TextField
                        margin="normal" required fullWidth name="password" label="Senha" type="password"
                        id="password" autoComplete="new-password" value={password}
                        onChange={(e) => setPassword(e.target.value)} disabled={loading}
                        InputProps={{ startAdornment: ( <InputAdornment position="start"> <LockIcon /> </InputAdornment> ), }}
                        helperText="Pelo menos 6 caracteres" // **NOVO:** Hint de validação
                    />
                    <TextField
                        margin="normal" required fullWidth name="inviteCode" label="Código de Convite"
                        type="text" id="inviteCode" value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)} disabled={loading}
                        InputProps={{ startAdornment: ( <InputAdornment position="start"> <KeyIcon /> </InputAdornment> ), }}
                    />
                    <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={loading}>
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Registrar'}
                    </Button>
                    <Typography variant="body2" align="center">
                        Já tem uma conta?{' '} <Link component={RouterLink} to="/login" variant="body2"> Faça login </Link>
                    </Typography>
                </Box>
            </Box>
        </Container>
    );
};

export default RegisterPage;
