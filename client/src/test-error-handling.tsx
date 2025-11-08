import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLocation } from 'wouter';
import { AlertTriangle, Bug, RefreshCw } from 'lucide-react';

// Component that throws an error for testing
function ErrorThrowingComponent() {
  const [shouldThrow, setShouldThrow] = useState(false);
  
  if (shouldThrow) {
    throw new Error('Test error for error boundary testing - this is intentional!');
  }
  
  return (
    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
      <h3 className="font-semibold mb-2">Error Boundary Test Component</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        This component will throw an error when you click the button below.
        The error boundary should catch it and show a fallback UI.
      </p>
      <Button
        onClick={() => setShouldThrow(true)}
        variant="destructive"
        data-testid="button-throw-error"
      >
        <Bug className="w-4 h-4 mr-2" />
        Throw Test Error
      </Button>
    </div>
  );
}

// Test component to verify error logging
function ErrorLoggingTest() {
  const [, setLocation] = useLocation();
  
  const testApiError = async () => {
    try {
      // This should fail and be logged
      await fetch('/api/nonexistent-endpoint', { method: 'POST' });
    } catch (error) {
      console.error('Expected API error for testing:', error);
    }
  };
  
  const testErrorLogging = async () => {
    try {
      const response = await fetch('/api/errors/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken') || ''}`
        },
        body: JSON.stringify({
          error_message: 'Test error message for logging system verification',
          stack_trace: 'Test stack trace\n  at testErrorLogging (/test-error-handling.tsx:45:12)',
          page_url: window.location.href,
          user_agent: navigator.userAgent,
          error_type: 'validation_error',
          severity: 'medium',
          component_name: 'ErrorHandlingTest',
          browser_info: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform
          },
          error_context: {
            test: true,
            timestamp: new Date().toISOString(),
            description: 'This is a test error to verify the logging system works'
          }
        })
      });
      
      if (response.ok) {
        alert('✅ Error logging test successful! Check /admin/error-logs to see the logged error.');
      } else {
        alert('❌ Error logging test failed');
      }
    } catch (error) {
      alert('❌ Error logging test failed: ' + error);
    }
  };
  
  const goToErrorPage = () => {
    const errorDetails = {
      message: 'Test error for error handling page',
      stack: 'Test stack trace',
      componentStack: 'ErrorHandlingTest',
      errorId: 'test-' + Date.now(),
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      errorType: 'test_error',
      severity: 'medium'
    };
    
    // Navigate to error page with test error details
    const errorParam = encodeURIComponent(JSON.stringify(errorDetails));
    setLocation(`/error?error=${errorParam}`);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Error Logging Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Test the error logging system by clicking the buttons below:
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button onClick={testApiError} variant="outline" data-testid="button-test-api-error">
            <RefreshCw className="w-4 h-4 mr-2" />
            Test API Error
          </Button>
          
          <Button onClick={testErrorLogging} data-testid="button-test-error-logging">
            <Bug className="w-4 h-4 mr-2" />
            Test Error Logging
          </Button>
          
          <Button onClick={goToErrorPage} variant="secondary" data-testid="button-test-error-page">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Test Error Page
          </Button>
        </div>
        
        <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded">
          <strong>Note:</strong> These tests verify that:
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Error logging API works correctly</li>
            <li>Error page displays properly</li>
            <li>Admin can view logged errors</li>
            <li>Users remain logged in during errors</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TestErrorHandling() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Error Handling System Test
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Test the comprehensive error handling system to ensure it works correctly
          </p>
        </div>

        {/* Error Boundary Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="w-5 h-5" />
              Error Boundary Test
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This tests React error boundaries. The error should be caught gracefully without 
              crashing the entire application or logging the user out.
            </p>
            
            <ErrorBoundary showErrorDetails={true}>
              <ErrorThrowingComponent />
            </ErrorBoundary>
          </CardContent>
        </Card>

        {/* Error Logging Test */}
        <ErrorLoggingTest />

        {/* Session Verification */}
        <Card>
          <CardHeader>
            <CardTitle>Session Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm">
                Session Token: {localStorage.getItem('sessionToken') ? '✅ Present' : '❌ Missing'}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              This should remain green even after errors occur, proving users stay logged in.
            </p>
          </CardContent>
        </Card>

        {/* Admin Links */}
        <Card>
          <CardHeader>
            <CardTitle>Admin Access</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <a 
                href="/admin/error-logs" 
                className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                data-testid="link-admin-error-logs"
              >
                <Bug className="w-4 h-4" />
                View Error Logs (Admin)
              </a>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Admin interface to view and manage all logged errors
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
