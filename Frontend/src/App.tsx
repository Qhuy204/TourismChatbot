import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { Toaster } from 'sonner';
import { ConfigProvider, theme as antdTheme } from 'antd';
import LandingPage from '@/pages/LandingPage';
import FeaturesPage from '@/pages/FeaturesPage';
import PricingPage from '@/pages/PricingPage';
import AboutPage from '@/pages/AboutPage';
import ContactPage from '@/pages/ContactPage';
import AuthPage from '@/pages/AuthPage';
import ChatApp from '@/pages/ChatApp';
import ProfilePage from '@/pages/ProfilePage';
import AdminLayout from '@/layouts/AdminLayout';
import AdminOverview from '@/pages/admin/AdminOverview';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminLimits from '@/pages/admin/AdminLimits';
import AdminConversations from '@/pages/admin/AdminConversations';
import AdminLogs from '@/pages/admin/AdminLogs';
import AdminSystem from '@/pages/admin/AdminSystem';
import AdminSettings from '@/pages/admin/AdminSettings';
import AdminAnalytics from '@/pages/admin/AdminAnalytics';
import AdminLocations from '@/pages/admin/AdminLocations';

const queryClient = new QueryClient();

const isDark = () => document.documentElement.getAttribute('data-theme') !== 'light';

function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: 16 }}>
      <h1 style={{ fontSize: 72, fontWeight: 900, color: 'var(--primary)' }}>404</h1>
      <p style={{ fontSize: 18, color: 'var(--text-muted)' }}>Page not found</p>
      <a href="/" style={{ padding: '10px 24px', background: 'var(--primary)', color: 'white', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
        Go Home
      </a>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Toaster position="top-right" richColors />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/chat" element={<ChatApp />} />
            <Route path="/chat/:id" element={<ChatApp />} />
            <Route path="/app" element={<ChatApp />} />
            <Route path="/profile" element={<ProfilePage />} />

            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminOverview />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="limits" element={<AdminLimits />} />
              <Route path="conversations" element={<AdminConversations />} />
              <Route path="logs" element={<AdminLogs />} />
              <Route path="system" element={<AdminSystem />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="locations" element={<AdminLocations />} />
              <Route path="*" element={<NotFound />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
