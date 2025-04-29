// src/store/authStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import axiosInstance from '../lib/axiosInstance'; // Usar a instância configurada

// URL para o endpoint de profile (auth)
const AUTH_API_URL = 'https://restfulfreeapi.onrender.com/api/auth';

// Interface UserProfile
interface UserProfile {
    id?: number;
    username: string;
    role: string;
}

// Interface AuthState Completa
interface AuthState {
    isAuthenticated: boolean;
    accessToken: string | null;
    refreshToken: string | null;
    user: UserProfile | null;
    isLoadingProfile: boolean;
    profileError: string | null;
    setTokens: (access: string, refresh: string) => void;
    logout: () => void;
    fetchProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            // Estado Inicial Completo
            isAuthenticated: false,
            accessToken: null,
            refreshToken: null,
            user: null,
            isLoadingProfile: false,
            profileError: null,

            // Ação setTokens Completa
            setTokens: (access, refresh) => set({
                isAuthenticated: true,
                accessToken: access,
                refreshToken: refresh,
                user: null, // Força refetch do perfil com novo token
                profileError: null,
                isLoadingProfile: false, // Reseta loading caso estivesse ativo
            }),

            // Ação logout Completa
            logout: () => {
                console.log("Executando logout no store...");
                // Limpar tokens e usuário
                set({
                    isAuthenticated: false,
                    accessToken: null,
                    refreshToken: null,
                    user: null,
                    isLoadingProfile: false,
                    profileError: null,
                });
                // Opcional: Limpar o token da instância axios (embora o interceptor não vá usar se não tiver token no store)
                // delete axiosInstance.defaults.headers.common['Authorization'];
            },


            // Ação fetchProfile Completa usando axiosInstance
            fetchProfile: async () => {
                // **SUGESTÃO IMPLEMENTADA:** Verificar autenticação antes de prosseguir
                if (!get().isAuthenticated) {
                    console.log("fetchProfile: Usuário não autenticado. Abortando busca.");
                    set({ isLoadingProfile: false }); // Garante que loading seja false se abortar
                    return;
                }

                // Previne fetchs múltiplos se já estiver carregando
                if (get().isLoadingProfile) {
                    console.log("fetchProfile: Busca de perfil já em andamento.");
                    return;
                }

                set({ isLoadingProfile: true, profileError: null });
                console.log("fetchProfile: Iniciando busca...");

                try {
                    // Usa axiosInstance. O token será adicionado pelo interceptor de requisição.
                    const response = await axiosInstance.get<{ message: string; user: UserProfile }>(
                        `${AUTH_API_URL}/profile`
                    );

                    const userData = response.data.user;
                    console.log("fetchProfile: Dados recebidos:", userData);

                    if (userData && typeof userData.username === 'string' && typeof userData.role === 'string') {
                        set({ user: userData, isLoadingProfile: false });
                        console.log("fetchProfile: Perfil atualizado no store.");
                    } else {
                        console.error("fetchProfile: Formato de dados inválido recebido.");
                        throw new Error('Formato de dados de perfil inválido recebido da API.');
                    }

                } catch (error: any) {
                    console.error('Erro detalhado ao buscar perfil (authStore):', error);
                    // O interceptor trata 401 e chama logout. Só precisamos tratar outros erros aqui.
                    if (error.response?.status !== 401) {
                        const message = error.message || 'Falha ao buscar dados do usuário.';
                        set({ profileError: message, isLoadingProfile: false, user: null });
                        console.log("fetchProfile: Erro (não 401) definido no store:", message);
                    } else {
                        // Se foi 401, o interceptor já chamou logout e limpou o estado.
                        // Podemos apenas resetar o loading local e talvez definir um erro genérico.
                        set({ isLoadingProfile: false, profileError: 'Sessão expirada ou inválida.' });
                        console.log("fetchProfile: Erro 401 tratado pelo interceptor, limpando loading.");
                    }
                }
            },
        }),
        {
            name: 'auth-storage', // Nome da chave no localStorage
            storage: createJSONStorage(() => localStorage), // Define localStorage
            // Persistir apenas tokens e estado de autenticação
            partialize: (state) => ({
                isAuthenticated: state.isAuthenticated,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
            }),
        }
    )
);
