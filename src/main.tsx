// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeContextProvider, useThemeContext } from './context/ThemeContext';
import { SnackbarProvider } from './context/SnackbarContext'; // Importar SnackbarProvider
import App from './App.tsx';
import './index.css';

const ThemedApp: React.FC = () => {
    const { mode } = useThemeContext();
    const theme = React.useMemo(() => createTheme({ palette: { mode } }), [mode]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <App />
        </ThemeProvider>
    );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ThemeContextProvider> {/* Tema por fora */}
            <SnackbarProvider> {/* Snackbar por dentro */}
                <BrowserRouter>
                    <ThemedApp /> {/* Aplicação com tema */}
                </BrowserRouter>
            </SnackbarProvider>
        </ThemeContextProvider>
    </React.StrictMode>,
)