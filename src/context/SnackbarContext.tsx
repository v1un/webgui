// src/context/SnackbarContext.tsx
import React, { createContext, useState, useMemo, useContext, ReactNode, useCallback } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert, { AlertColor } from '@mui/material/Alert';

interface SnackbarContextType {
    showSnackbar: (message: string, severity?: AlertColor) => void;
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

export const SnackbarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [severity, setSeverity] = useState<AlertColor>('info'); // Padrão info

    const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setOpen(false);
    };

    const showSnackbar = useCallback((newMessage: string, newSeverity: AlertColor = 'success') => { // Padrão success agora
        setMessage(newMessage);
        setSeverity(newSeverity);
        setOpen(true);
    }, []);

    // --- CORREÇÃO AQUI: Adicionar vírgula ---
    const contextValue = useMemo(() => ({ showSnackbar }), [showSnackbar]);
    // O useMemo aqui estava simples demais, vamos corrigir para o padrão
    // const contextValue = useMemo(() => ({ mode, toggleTheme }), [mode, toggleTheme]); // <--- ESTA LINHA ESTAVA ERRADA NA ANALISE ANTERIOR, o valor correto é só showSnackbar
    // A linha correta para o valor do contexto é:
    // const value = useMemo(() => ({ showSnackbar }), [showSnackbar]); // Já estava assim no código que enviei, o erro TS1005 deve ser em outro lugar?
    // Revisando novamente a imagem e o código... o erro TS1005 não está visível na imagem para SnackbarContext.
    // Os erros visíveis são TS2322 e TS2741.
    // TS2741 pode ser porque handleClose não está sendo passado para o Snackbar?
    // TS2322 pode ser por causa do Alert dentro do Snackbar?
    // Vamos garantir que o handleClose está sendo passado para o Snackbar e que o Alert está correto.

    // Tentativa de correção focada nos erros TS2322 e TS2741:
    // A função showSnackbar é a única coisa exposta no contexto, o useMemo está correto.
    // O problema pode ser na renderização do Snackbar/Alert.

    return (
        <SnackbarContext.Provider value={contextValue}>
            {children}
            <Snackbar
                open={open}
                autoHideDuration={5000}
                onClose={handleClose} // Passar handleClose aqui é necessário
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                {/* Envolver Alert em um Box pode ajudar com tipos às vezes, mas não deveria ser necessário */}
                {/* Garantir que Alert tenha todas as props necessárias */}
                <Alert
                    onClose={handleClose} // Passar handleClose para o botão 'X' do Alert
                    severity={severity}
                    sx={{ width: '100%' }}
                    variant="filled" // Usar variant="filled" para melhor contraste
                    elevation={6} // Adicionar elevação padrão de Snackbar/Alert
                >
                    {message}
                </Alert>
            </Snackbar>
        </SnackbarContext.Provider>
    );
};

export const useSnackbar = () => {
    const context = useContext(SnackbarContext);
    if (context === undefined) {
        throw new Error('useSnackbar deve ser usado dentro de um SnackbarProvider');
    }
    return context;
};