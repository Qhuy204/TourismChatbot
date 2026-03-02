import { Server, Database } from 'lucide-react';
import AdminOverview from './AdminOverview';

export default function AdminSystem() {
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Server color="var(--primary)" /> System Diagnostics
                </h1>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Database size={20} color="var(--primary)" /> Live Telemetry
                </h2>
                <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <AdminOverview />
                </div>
            </div>

            <div style={{ background: '#f59e0b10', border: '1px solid #f59e0b50', borderRadius: 12, padding: 16, color: '#f59e0b' }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>Note: Additional internal system logs and Docker diagnostics will be available here in a future update.</p>
            </div>
        </div>
    );
}
