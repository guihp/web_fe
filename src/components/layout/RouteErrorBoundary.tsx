import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Route render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24 }}>
          <h2 style={{ marginBottom: 8 }}>Não foi possível carregar esta página</h2>
          <p style={{ color: '#6b7280', marginBottom: 16 }}>
            {this.state.error.message || 'Erro inesperado ao renderizar o conteúdo.'}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#ea6624',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Recarregar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
