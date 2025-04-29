// src/components/AppLayout.tsx
import React, { useState } from 'react';
import { Link as RouterLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import axiosInstance from '../lib/axiosInstance';
import { useThemeContext } from '../context/ThemeContext';

// MUI Imports
import Box from '@mui/material/Box'; import Drawer from '@mui/material/Drawer'; import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar'; import List from '@mui/material/List'; import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider'; import ListItem from '@mui/material/ListItem'; import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon'; import ListItemText from '@mui/material/ListItemText'; import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

// Icon Imports
import AdbIcon from '@mui/icons-material/Adb'; import DashboardIcon from '@mui/icons-material/Dashboard'; import SmartToyIcon from '@mui/icons-material/SmartToy';
import HistoryIcon from '@mui/icons-material/History'; import BuildIcon from '@mui/icons-material/Build'; import VpnKeyIcon from '@mui/icons-material/VpnKey';
import PeopleIcon from '@mui/icons-material/People'; import LogoutIcon from '@mui/icons-material/Logout'; import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import Brightness4Icon from '@mui/icons-material/Brightness4'; import Brightness7Icon from '@mui/icons-material/Brightness7';
import MenuIcon from '@mui/icons-material/Menu';
import StyleIcon from '@mui/icons-material/Style';

const AUTH_API_URL = 'https://restfulfreeapi.onrender.com/api/auth';
const drawerWidth = 240;

const AppLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const logoutAction = useAuthStore((state) => state.logout);
    // TS6133: 'refreshToken' removido pois não estava sendo lido diretamente aqui
    // const refreshToken = useAuthStore((state) => state.refreshToken);
    const user = useAuthStore((state) => state.user);
    const { mode, toggleTheme } = useThemeContext();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [mobileOpen, setMobileOpen] = useState(false);

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleLogout = async () => {
        // Obter o refreshToken mais recente diretamente do store ao fazer logout
        const currentRefreshToken = useAuthStore.getState().refreshToken;
        if (currentRefreshToken) {
            try {
                await axiosInstance.post(
                    `${AUTH_API_URL}/logout`,
                    { refreshToken: currentRefreshToken },
                    { headers: { 'Content-Type': 'application/json' } }
                );
                console.log('Refresh token invalidado no backend.');
            } catch (error) {
                console.error('Erro ao tentar invalidar token no backend (ignorado):', error);
            }
        }
        logoutAction();
        navigate('/login');
    };

    const menuItems = [
        { text: 'Dashboard', path: '/', icon: <DashboardIcon /> },
        { text: 'Controle do Bot', path: '/bot-control', icon: <SmartToyIcon /> },
        { text: 'Construtor Config', path: '/config-builder', icon: <BuildIcon /> },
        { text: 'Histórico', path: '/history', icon: <HistoryIcon /> },
        { text: 'Gerador Anki', path: '/anki-generator', icon: <StyleIcon /> },
    ];

    const adminMenuItems = user?.role === 'admin' ? [
        { text: 'Gerar Convites', path: '/admin/invite-codes', icon: <VpnKeyIcon /> },
        { text: 'Gerenciar Usuários', path: '/admin/users', icon: <PeopleIcon /> },
    ] : [];

    const drawerContent = (
        <>
            <Toolbar />
            <Divider />
            <List>
                {menuItems.map((item) => (
                    <ListItem key={item.text} disablePadding>
                        <ListItemButton
                            component={RouterLink}
                            to={item.path}
                            selected={location.pathname === item.path}
                            onClick={isMobile ? handleDrawerToggle : undefined}
                        >
                            <ListItemIcon>{item.icon}</ListItemIcon>
                            <ListItemText primary={item.text} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
            {adminMenuItems.length > 0 && (
                <>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="overline" sx={{ pl: 2, pt: 1 }}>Admin</Typography>
                    <List>
                        {adminMenuItems.map((item) => (
                            <ListItem key={item.text} disablePadding>
                                <ListItemButton
                                    component={RouterLink}
                                    to={item.path}
                                    selected={location.pathname === item.path}
                                    onClick={isMobile ? handleDrawerToggle : undefined}
                                >
                                    <ListItemIcon>{item.icon}</ListItemIcon>
                                    <ListItemText primary={item.text} />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                </>
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Divider />
            <List>
                {user && (
                    <ListItem>
                        <ListItemIcon><AccountCircleIcon /></ListItemIcon>
                        <ListItemText primary={user.username} secondary={user.role} />
                    </ListItem>
                )}
                <ListItem disablePadding>
                    <ListItemButton onClick={handleLogout}>
                        <ListItemIcon><LogoutIcon color="error"/></ListItemIcon>
                        <ListItemText primary="Logout" />
                    </ListItemButton>
                </ListItem>
            </List>
        </>
    );


    return (
        <Box sx={{ display: 'flex' }}>
            <AppBar
                position="fixed"
                sx={{
                    width: { md: `calc(100% - ${drawerWidth}px)` },
                    ml: { md: `${drawerWidth}px` },
                }}
            >
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        edge="start"
                        onClick={handleDrawerToggle}
                        sx={{ mr: 2, display: { md: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <AdbIcon sx={{ mr: 1 }} />
                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                        JJbot Control Panel
                    </Typography>
                    <IconButton sx={{ ml: 1 }} onClick={toggleTheme} color="inherit" title={mode === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}>
                        {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                    </IconButton>
                </Toolbar>
            </AppBar>

            <Box
                component="nav"
                sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
                aria-label="mailbox folders"
            >
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{
                        keepMounted: true,
                    }}
                    sx={{
                        display: { xs: 'block', md: 'none' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                    }}
                >
                    {drawerContent}
                </Drawer>
                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: 'none', md: 'block' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                    }}
                    open
                >
                    {drawerContent}
                </Drawer>
            </Box>

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
                    mt: '64px'
                }}
            >
                <Outlet />
            </Box>
        </Box>
    );
};
export default AppLayout;
