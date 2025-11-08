import { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  showErrorDetails?: boolean;
  className?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorId: crypto.randomUUID()
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
      errorId: crypto.randomUUID()
    });

    // Log error to our error tracking system
    this.logError(error, errorInfo);
  }

  private async logError(error: Error, errorInfo: ErrorInfo) {
    try {
      const errorData = {
        error_message: error.message,
        stack_trace: error.stack,
        component_stack: errorInfo.componentStack,
        page_url: window.location.href,
        user_agent: navigator.userAgent,
        error_type: 'react_error',
        severity: 'high',
        component_name: this.extractComponentName(errorInfo.componentStack || ''),
        browser_info: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform,
          cookieEnabled: navigator.cookieEnabled,
          onLine: navigator.onLine
        },
        error_context: {
          props: Object.keys(this.props),
          state: Object.keys(this.state),
          timestamp: new Date().toISOString(),
          url: window.location.href,
          referrer: document.referrer
        }
      };

      // Send to error logging API (don't throw if this fails)
      const response = await fetch('/api/errors/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken') ?? ''}`
        },
        body: JSON.stringify(errorData)
      });

      if (response.ok) {
        console.log('Error logged successfully');
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
      // Don't throw here - we don't want error logging to cause more errors
    }
  }

  private extractComponentName(componentStack: string): string {
    try {
      const match = componentStack.match(/in (\w+)/);
      return match ? match[1] : 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleReportError = async () => {
    try {
      const errorDetails = {
        message: this.state.error?.message,
        stack: this.state.error?.stack,
        componentStack: this.state.errorInfo?.componentStack,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      };

      await navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2));
      alert('Error details copied to clipboard. Please share this with support.');
    } catch {
      alert('Unable to copy error details. Please take a screenshot and report to support.');
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className={cn("flex items-center justify-center min-h-[400px] p-4", this.props.className)}>
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                Something went wrong
              </CardTitle>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                We encountered an unexpected error. Your session is still active.
              </p>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {this.props.showErrorDetails && this.state.error && (
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Error Details:
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                    {this.state.error.message}
                  </p>
                  {this.state.errorId && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Error ID: {this.state.errorId}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={this.handleRetry}
                  className="flex-1"
                  data-testid="button-retry-error"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={this.handleGoHome}
                  className="flex-1"
                  data-testid="button-go-home"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
              </div>

              <Button 
                variant="ghost" 
                size="sm"
                onClick={this.handleReportError}
                className="w-full text-gray-600 dark:text-gray-400"
                data-testid="button-report-error"
              >
                <Bug className="w-4 h-4 mr-2" />
                Report Error
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Functional component wrapper for convenience
interface ErrorBoundaryWrapperProps {
  children: ReactNode;
  className?: string;
  showErrorDetails?: boolean;
}

export function ErrorBoundaryWrapper({ children, className, showErrorDetails = false }: ErrorBoundaryWrapperProps) {
  return (
    <ErrorBoundary className={className} showErrorDetails={showErrorDetails}>
      {children}
    </ErrorBoundary>
  );
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
