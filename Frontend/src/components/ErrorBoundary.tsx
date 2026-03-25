import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    padding: '2rem',
                    textAlign: 'center'
                }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#ef4444' }}>
                        Đã xảy ra lỗi giao diện
                    </h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '24px', maxWidth: '500px' }}>
                        Hệ thống hiển thị tạm thời gặp sự cố. Bạn vui lòng tải lại trang hoặc bấm nút bên dưới để khôi phục.
                    </p>
                    <button
                        onClick={() => window.location.href = '/'}
                        style={{
                            padding: '10px 24px',
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 500
                        }}
                    >
                        Về trang chủ
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
