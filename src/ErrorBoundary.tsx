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
 <div style={{ padding: 20, color: 'red', fontFamily: 'monospace', wordBreak: 'break-all' }}>
 <h2>Oops, there is an error!</h2>
 <p>{this.state.error?.toString()}</p>
 <pre style={{ fontSize: '10px' }}>{this.state.error?.stack}</pre>
 </div>
 );
 }

 return (this as any).props.children;
 }
}
