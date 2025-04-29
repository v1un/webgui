// src/lib/axiosInstance.ts
import axios, {
    AxiosError,
    InternalAxiosRequestConfig,
    AxiosResponse,
    AxiosHeaders,
    AxiosRequestHeaders
} from 'axios';
import { useAuthStore } from '../store/authStore';

interface RefreshResponse {
    accessToken: string;
    // A API pode retornar mais dados, se necessário
}

const REFRESH_URL = 'https://restfulfreeapi.onrender.com/api/auth/refresh';

const axiosInstance = axios.create({
    headers: {
        'Content-Type': 'application/json',
    },
});

// --- Interceptor de Requisição ---
axiosInstance.interceptors.request.use(
    (config): InternalAxiosRequestConfig => {
        const { accessToken } = useAuthStore.getState();
        // Rotas que NÃO precisam de autenticação (ou usam credenciais diferentes)
        const noAuthRoutes = ['/auth/login', '/auth/register', '/auth/refresh'];
        // Verifica se a URL existe e não termina com uma das rotas públicas
        const requiresAuth = config.url && !noAuthRoutes.some(route => config.url?.endsWith(route));

        if (accessToken && requiresAuth) {
            if (!config.headers) {
                config.headers = new AxiosHeaders();
            }
            (config.headers as AxiosRequestHeaders)['Authorization'] = `Bearer ${accessToken}`;
            console.log(`[Request Interceptor] Added Auth token for ${config.url}`);
        }
        return config;
    },
    (error: AxiosError) => {
        console.error('[Request Interceptor Error]', error);
        return Promise.reject(error);
    }
);


// --- Interceptor de Resposta ---
let isRefreshing = false;
let failedQueue: { resolve: (value: unknown) => void; reject: (reason?: any) => void }[] = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => {
        return response; // Retorna resposta em caso de sucesso
    },
    async (error: AxiosError) => {
        const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean });

        // Se não for erro 401, ou se for a própria chamada de refresh, ou se já tentou retry, rejeita
        if (error.response?.status !== 401 || originalRequest.url?.endsWith('/auth/refresh') || originalRequest._retry) {
            // Se for 401 na rota de refresh OU se já tentou retry, deslogar
            if ((originalRequest.url?.endsWith('/auth/refresh') && error.response?.status === 401) || originalRequest._retry) {
                console.log('Interceptor: Refresh falhou ou retry já tentado. Deslogando.');
                useAuthStore.getState().logout();
            }
            return Promise.reject(error);
        }

        // Evita múltiplas chamadas de refresh concorrentes
        if (isRefreshing) {
            // Adiciona a requisição original à fila para ser retentada depois
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            }).then(token => {
                // Tenta novamente a requisição original com o novo token
                if (!originalRequest.headers) originalRequest.headers = new AxiosHeaders();
                (originalRequest.headers as AxiosRequestHeaders)['Authorization'] = 'Bearer ' + token;
                return axiosInstance(originalRequest);
            }).catch(err => {
                return Promise.reject(err); // Propaga o erro se o refresh falhar
            });
        }

        // Marca que está fazendo refresh e que esta requisição já tentará um retry
        originalRequest._retry = true;
        isRefreshing = true;

        const { refreshToken, setTokens, logout } = useAuthStore.getState();

        if (!refreshToken) {
            console.log('Interceptor: Refresh token não encontrado no store, logout.');
            logout();
            isRefreshing = false;
            processQueue(error, null); // Rejeita a fila
            return Promise.reject(error);
        }

        console.log('Interceptor: Tentando refresh do token...');
        try {
            const refreshResponse = await axios.post<RefreshResponse>(
                REFRESH_URL,
                // **CORREÇÃO AQUI:** Enviar como { refreshToken: ... }
                { refreshToken: refreshToken },
                { headers: { 'Content-Type': 'application/json' } }
            );

            if (refreshResponse.status === 200 && refreshResponse.data.accessToken) {
                const newAccessToken = refreshResponse.data.accessToken;
                console.log('Interceptor: Refresh bem-sucedido!');
                // Atualiza os tokens no store (o refreshToken pode ou não ser atualizado pela API, aqui assumimos que não)
                setTokens(newAccessToken, refreshToken);

                // Processa a fila com sucesso, passando o novo token
                processQueue(null, newAccessToken);

                // Modifica header da requisição original com o novo token
                if (!originalRequest.headers) originalRequest.headers = new AxiosHeaders();
                (originalRequest.headers as AxiosRequestHeaders)['Authorization'] = `Bearer ${newAccessToken}`;

                console.log('Interceptor: Retentando requisição original...');
                // Reenviar a requisição original e retornar sua Promise
                // Liberar flag ANTES de reenviar
                isRefreshing = false;
                return await axiosInstance(originalRequest);
            } else {
                // Resposta 200 mas sem token ou formato inesperado
                throw new Error('Resposta inválida da API de refresh.');
            }
        } catch (refreshError: any) {
            console.error('Interceptor: Falha no refresh token:', refreshError?.response?.data || refreshError.message);
            logout(); // Força logout
            isRefreshing = false; // Libera flag
            processQueue(refreshError, null); // Rejeita a fila com o erro do refresh
            // Rejeita a Promise com o erro que causou a falha no refresh
            return Promise.reject(refreshError);
        }
    }
);

export default axiosInstance;
