import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in application:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-surface-primary flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-red-950 flex items-center justify-center mx-auto mb-6 border border-red-900">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2">System Failure</h1>
          <p className="text-slate-400 max-w-md mx-auto mb-8">
            The application encountered an unexpected error. This might be due to a memory limit or an unsupported browser API.
          </p>
          <div className="bg-surface-secondary border border-white/5 p-4 rounded-xl max-w-lg w-full mb-8 text-left overflow-auto max-h-48">
            <p className="text-red-400 font-mono text-sm">
              {this.state.error?.message || "Unknown Error"}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="ctrl-btn bg-brand-600 border-brand-500 hover:bg-brand-500 text-white font-bold py-3 px-8 shadow-lg text-lg"
          >
            Reboot Engine
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
