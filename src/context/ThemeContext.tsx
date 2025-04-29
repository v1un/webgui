// src/context/ThemeContext.tsx
import React, { createContext, useState, useMemo, useContext, ReactNode, useCallback } from 'react';
import { PaletteMode } from '@mui/material'; // Importar tipo do MUI

// Define a forma do contexto
interface ThemeContextType {
    mode: PaletteMode;
    toggleTheme: () => void;
}

// Cria o contexto com um valor padrão inicial (pode ser undefined se preferir tratar no consumidor)
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Cria o provedor do contexto
export const ThemeContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Tenta ler a preferência do localStorage ou usa 'light' como padrão
    const getInitialMode = (): PaletteMode => {
        try {
            const storedMode = localStorage.getItem('appThemeMode') as PaletteMode | null;
            return storedMode || 'light';
        } catch (error) {
            console.error("Erro ao ler tema do localStorage", error);
            return 'light';
        }
    };

    const [mode, setMode] = useState<PaletteMode>(getInitialMode());

    // Função para alternar o tema (memorizada com useCallback)
    const toggleTheme = useCallback(() => {
        setMode((prevMode) => {
            const newMode = prevMode === 'light' ? 'dark' : 'light';
            try {
                localStorage.setItem('appThemeMode', newMode); // Salva no localStorage
            } catch (error) {
                console.error("Erro ao salvar tema no localStorage", error);
            }
            return newMode;
        });
    }, []);

    // Memoriza o valor do contexto para evitar recriações desnecessárias
    const value = useMemo(() => ({ mode, toggleTheme }), [mode, toggleTheme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

// Hook customizado para usar o contexto do tema mais facilmente
export const useThemeContext = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useThemeContext deve ser usado dentro de um ThemeContextProvider');
    }
    return context;
};