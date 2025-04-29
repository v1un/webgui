// src/App.tsx
import { Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import BotControlPage from './pages/BotControlPage';
import HistoryPage from './pages/HistoryPage';
import ConfigBuilderPage from './pages/ConfigBuilderPage'; // Importar nova página
import AnkiGeneratorPage from './pages/AnkiGeneratorPage'; // <-- Importar página Anki
import AdminInviteCodesPage from './pages/admin/AdminInviteCodesPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import StudyPage from './pages/StudyPage'; // Import the new Study Page
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import './App.css';

function App() {
    return (
        <Routes>
            {/* Rotas Públicas */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Rotas Protegidas com Layout */}
            <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                    {/* Rotas Core */}
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/bot-control" element={<BotControlPage />} />
                    {/* ROTA ADICIONADA para o Construtor */}
                    <Route path="/config-builder" element={<ConfigBuilderPage />} />
                    <Route path="/history" element={<HistoryPage />} />
                    {/* ROTA ADICIONADA para o Gerador Anki */}
                    <Route path="/anki-generator" element={<AnkiGeneratorPage />} />
                    {/* ROTA ADICIONADA para o Study Assistant */}
                    <Route path="/study" element={<StudyPage />} />
                    {/* Rotas Admin */}
                    <Route path="/admin/invite-codes" element={<AdminInviteCodesPage />} />
                    <Route path="/admin/users" element={<AdminUsersPage />} />
                    {/* Adicionar outras rotas protegidas aqui */}
                </Route>
            </Route>

            {/* Rota Catch-all (opcional) */}
            {/* <Route path="*" element={<div>Página não encontrada</div>} /> */}
        </Routes>
    );
}

export default App;
