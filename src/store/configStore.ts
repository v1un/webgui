// src/store/configStore.ts
import { create } from 'zustand';

// Define uma interface básica para a configuração (pode expandir)
interface BotConfig {
    configName?: string;
    game?: string;
    script?: string;
    duration?: string | null;
    params?: any | null; // Pode ser string JSON ou objeto parseado
    // Adicionar outros campos conforme necessário
}

interface ConfigState {
    activeConfig: BotConfig | null;
    setActiveConfig: (config: BotConfig | null) => void;
}

export const useConfigStore = create<ConfigState>()(
    (set) => ({
        activeConfig: null, // Nenhuma configuração ativa inicialmente
        setActiveConfig: (config) => set({ activeConfig: config }),
    }),
    // Não vamos persistir a config ativa por padrão, mas poderíamos se necessário
);