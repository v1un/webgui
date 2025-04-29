// src/pages/LoginPage.tsx
import React, { useState } from 'react';
import axios from 'axios';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

// MUI Imports
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Avatar from '@mui/material/Avatar';
import AdbIcon from '@mui/icons-material/Adb';
// **NOVO:** Ícones para campos
import AccountCircle from '@mui/icons-material/AccountCircle';
import LockIcon from '@mui/icons-material/Lock';
import InputAdornment from '@mui/material/InputAdornment';

// Sugestão: Usar react-hook-form + zod/yup para validação robusta
// import { useForm } from 'react-hook-form';
// import { zodResolver } from '@hookform/resolvers/zod';
// import * as z from 'zod';

const API_URL = 'https://restfulfreeapi.onrender.com/api/auth';

// Sugestão: Schema de validação
// const loginSchema = z.object({
//     username: z.string().min(1, "Usuário é obrigatório"),
//     password: z.string().min(1, "Senha é obrigatória"),
// });
// type LoginFormData = z.infer<typeof loginSchema>;

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const setTokens = useAuthStore((state) => state.setTokens);

    // TODO: Integrar com react-hook-form

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setLoading(true); setError(null);

        // Validação básica (substituir por react-hook-form)
        if (!username || !password) {
             setError("Usuário e senha são obrigatórios.");
             setLoading(false);
             return;
        }

        try {
            const response = await axios.post(`${API_URL}/login`, { username, password }, { headers: { 'Content-Type': 'application/json' } });
            if (response.status === 200 && response.data.accessToken && response.data.refreshToken) {
                setTokens(response.data.accessToken, response.data.refreshToken); navigate('/');
            } else { setError('Resposta inválida do servidor.'); }
        } catch (err) {
            console.error('Erro no Login:', err);
            if (axios.isAxiosError(err) && err.response) {
                if (err.response.status === 401) { setError('Usuário ou senha inválidos.'); }
                else { setError(`Erro ${err.response.status}: ${err.response.data?.message || 'Erro ao autenticar.'}`); }
            } else { setError('Não foi possível conectar ao servidor.'); }
        } finally { setLoading(false); }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}><AdbIcon /></Avatar>
                <Typography component="h1" variant="h5"> JJbot Login </Typography>
                <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
                    <TextField
                        margin="normal" required fullWidth id="username" label="Usuário" name="username"
                        autoComplete="username" autoFocus value={username}
                        onChange={(e) => setUsername(e.target.value)} disabled={loading}
                        // **NOVO:** Adicionar ícone
                        InputProps={{
                            startAdornment: ( <InputAdornment position="start"> <AccountCircle /> </InputAdornment> ),
                        }}
                        // error={!!errors.username} // Exemplo react-hook-form
                        // helperText={errors.username?.message || "Seu nome de usuário"} // Exemplo
                    />
                    <TextField
                        margin="normal" required fullWidth name="password" label="Senha" type="password"
                        id="password" autoComplete="current-password" value={password}
                        onChange={(e) => setPassword(e.target.value)} disabled={loading}
                        // **NOVO:** Adicionar ícone
                         InputProps={{
                            startAdornment: ( <InputAdornment position="start"> <LockIcon /> </InputAdornment> ),
                        }}
                         // error={!!errors.password} // Exemplo react-hook-form
                         // helperText={errors.password?.message} // Exemplo
                    />
                    {error && ( <Alert severity="error" sx={{ mt: 2, width: '100%' }}> {error} </Alert> )}
                    <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={loading}> {loading ? <CircularProgress size={24} color="inherit" /> : 'Entrar'} </Button>
                    <Typography variant="body2" align="center">
                        Não tem uma conta?{' '} <Link component={RouterLink} to="/register" variant="body2"> Registre-se </Link>
                    </Typography>
                </Box>
            </Box>
        </Container>
    );
};

export default LoginPage;
