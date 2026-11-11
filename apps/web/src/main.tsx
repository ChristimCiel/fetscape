import { createRoot } from 'react-dom/client';
import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import App from './App';
import './styles.css';
class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Workspace rendering failed', error, info.componentStack);
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>The workspace could not render.</h1>
        <p>Reload to recover the last saved analysis. Local records remain in SQLite.</p>
        <button onClick={() => location.reload()}>Reload workspace</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
