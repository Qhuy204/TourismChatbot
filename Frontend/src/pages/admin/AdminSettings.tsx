import { Settings, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSettings() {
    const handleSave = () => {
        toast.info("Settings functionality will be available in a future update.");
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Settings color="var(--primary)" /> Global Settings
                </h1>

                <button
                    onClick={handleSave}
                    style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--primary)', color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                    <Save size={16} /> Save Changes
                </button>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px 0' }}>General Configuration</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Maintenance Mode</label>
                        <select disabled style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', opacity: 0.6 }}>
                            <option>System Default (Active Users Only)</option>
                            <option>Lock All Access</option>
                        </select>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Temporarily halts all non-admin connections. Triggered automatically during Model Reloads.</p>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Global Message Retention</label>
                        <input type="number" disabled value={90} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', opacity: 0.6 }} />
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Days to keep old messages before moving to cold storage.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
