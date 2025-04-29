// src/components/ProtectedRoute.tsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const ProtectedRoute: React.FC = () => {
    // Verifica o estado de autenticação do nosso store Zustand
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    // Se o usuário está autenticado, renderiza o conteúdo da rota solicitada (usando <Outlet />)
    // Se não está autenticado, redireciona para a página de login
    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
    // 'replace' evita que a rota protegida entre no histórico do navegador se o usuário não estiver logado
};

export default ProtectedRoute;