import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  AlertTriangle, 
  RefreshCw, 
  Home, 
  Bug, 
  ChevronLeft, 
  Send,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ErrorDetails {
  message?: string;
  stack?: string;
  componentStack?: string;
  errorId?: string;
  timestamp?: string;
  url?: string;
  userAgent?: string;
  errorType?: string;
  severity?: string;
}

interface ErrorReportData {
  description: string;
  reproductionSteps: string;
  expectedBehavior: string;
  actualBehavior: string;
  contact?: string;
}

export default function ErrorHandlingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [errorDetails, setErrorDetails] = useState<ErrorDetails>({});
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportData, setReportData] = useState<ErrorReportData>({
    description: '',
    reproductionSteps: '',
    expectedBehavior: '',
    actualBehavior: ''
  });
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  useEffect(() => {
    // Get error details from URL params or session storage
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    
    if (errorParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(errorParam));
        setErrorDetails(parsed);
      } catch {
        // If parsing fails, just use default error
        setErrorDetails({
          message: 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
          url: window.location.href
        });
      }
    } else {
      // Check session storage for error details
      const sessionError = sessionStorage.getItem('lastError');
      if (sessionError) {
        try {
          const parsed = JSON.parse(sessionError);
          setErrorDetails(parsed);
          sessionStorage.removeItem('lastError');
        } catch {
          setErrorDetails({
            message: 'An unexpected error occurred',
            timestamp: new Date().toISOString(),
            url: window.location.href
          });
        }
      }
    }
  }, []);

  const handleRetry = () => {
    const previousUrl = errorDetails.url || '/';
    window.location.href = previousUrl;
  };

  const handleGoHome = () => {
    setLocation('/');
  };

  const handleGoBack = () => {
    window.history.back();
  };

  const handleCopyErrorDetails = async () => {
    try {
      const errorInfo = {
        errorId: errorDetails.errorId,
        message: errorDetails.message,
        timestamp: errorDetails.timestamp,
        url: errorDetails.url,
        userAgent: errorDetails.userAgent,
        stack: errorDetails.stack
      };
      
      await navigator.clipboard.writeText(JSON.stringify(errorInfo, null, 2));
      toast({
        title: "Error details copied",
        description: "Error information has been copied to your clipboard"
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Unable to copy error details to clipboard",
        variant: "destructive"
      });
    }
  };

  const handleSubmitReport = async () => {
    if (!reportData.description.trim()) {
      toast({
        title: "Description required",
        description: "Please provide a description of the error",
        variant: "destructive"
      });
      return;
    }

    setSubmittingReport(true);
    
    try {
      const response = await fetch('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken') || ''}`
        },
        body: JSON.stringify({
          ...reportData,
          errorDetails,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent
        })
      });

      if (response.ok) {
        setReportSubmitted(true);
        toast({
          title: "Report submitted",
          description: "Thank you for reporting this error. We'll investigate it."
        });
      } else {
        throw new Error('Failed to submit report');
      }
    } catch (error) {
      console.error('Failed to submit error report:', error);
      toast({
        title: "Submission failed",
        description: "Unable to submit error report. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setSubmittingReport(false);
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case 'critical': return XCircle;
      case 'high': return AlertTriangle;
      case 'medium': return AlertCircle;
      case 'low': return Clock;
      default: return AlertTriangle;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={handleGoBack}
            className="mb-4"
            data-testid="button-go-back"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
          
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Oops! Something went wrong
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Don't worry - your session is still active and your data is safe.
            </p>
          </div>
        </div>

        {/* Error Details Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="w-5 h-5" />
              Error Information
              {errorDetails.severity && (
                <Badge className={cn("text-white", getSeverityColor(errorDetails.severity))}>
                  {errorDetails.severity?.toUpperCase()}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorDetails.message && (
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Error Message
                </Label>
                <p className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-sm text-gray-900 dark:text-gray-100">
                  {errorDetails.message}
                </p>
              </div>
            )}

            {errorDetails.errorId && (
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Error ID
                </Label>
                <p className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-sm font-mono text-gray-900 dark:text-gray-100">
                  {errorDetails.errorId}
                </p>
              </div>
            )}

            {errorDetails.timestamp && (
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  When it happened
                </Label>
                <p className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-sm text-gray-900 dark:text-gray-100">
                  {new Date(errorDetails.timestamp).toLocaleString()}
                </p>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyErrorDetails}
              className="w-full"
              data-testid="button-copy-error-details"
            >
              <Bug className="w-4 h-4 mr-2" />
              Copy Error Details
            </Button>
          </CardContent>
        </Card>

        {/* Actions Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>What would you like to do?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                onClick={handleRetry}
                className="w-full"
                data-testid="button-retry-page"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              
              <Button
                variant="outline"
                onClick={handleGoHome}
                className="w-full"
                data-testid="button-go-home-page"
              >
                <Home className="w-4 h-4 mr-2" />
                Go to Homepage
              </Button>
            </div>

            <Button
              variant="ghost"
              onClick={() => setShowReportForm(!showReportForm)}
              className="w-full"
              data-testid="button-report-error-form"
            >
              <Send className="w-4 h-4 mr-2" />
              {showReportForm ? 'Hide' : 'Report'} Error Details
            </Button>
          </CardContent>
        </Card>

        {/* Error Report Form */}
        {showReportForm && !reportSubmitted && (
          <Card>
            <CardHeader>
              <CardTitle>Report Error Details</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Help us fix this issue by providing additional details about what happened.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="description">What were you doing when this error occurred? *</Label>
                <Textarea
                  id="description"
                  value={reportData.description}
                  onChange={(e) => setReportData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what you were trying to do when the error happened..."
                  rows={3}
                  data-testid="textarea-error-description"
                />
              </div>

              <div>
                <Label htmlFor="reproductionSteps">Steps to reproduce (optional)</Label>
                <Textarea
                  id="reproductionSteps"
                  value={reportData.reproductionSteps}
                  onChange={(e) => setReportData(prev => ({ ...prev, reproductionSteps: e.target.value }))}
                  placeholder="1. First I clicked... 2. Then I... 3. The error appeared..."
                  rows={3}
                  data-testid="textarea-reproduction-steps"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="expectedBehavior">What did you expect to happen?</Label>
                  <Textarea
                    id="expectedBehavior"
                    value={reportData.expectedBehavior}
                    onChange={(e) => setReportData(prev => ({ ...prev, expectedBehavior: e.target.value }))}
                    placeholder="I expected..."
                    rows={2}
                    data-testid="textarea-expected-behavior"
                  />
                </div>

                <div>
                  <Label htmlFor="actualBehavior">What actually happened?</Label>
                  <Textarea
                    id="actualBehavior"
                    value={reportData.actualBehavior}
                    onChange={(e) => setReportData(prev => ({ ...prev, actualBehavior: e.target.value }))}
                    placeholder="Instead..."
                    rows={2}
                    data-testid="textarea-actual-behavior"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="contact">Contact email (optional)</Label>
                <Input
                  id="contact"
                  type="email"
                  value={reportData.contact || ''}
                  onChange={(e) => setReportData(prev => ({ ...prev, contact: e.target.value }))}
                  placeholder="your.email@example.com"
                  data-testid="input-contact-email"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Only if you'd like us to follow up with you about this error
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleSubmitReport}
                  disabled={submittingReport || !reportData.description.trim()}
                  className="flex-1"
                  data-testid="button-submit-error-report"
                >
                  {submittingReport ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit Report
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setShowReportForm(false)}
                  disabled={submittingReport}
                  data-testid="button-cancel-report"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success Message */}
        {reportSubmitted && (
          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Report Submitted Successfully
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Thank you for helping us improve! We'll review your report and work on fixing this issue.
                </p>
                <Button onClick={handleGoHome} data-testid="button-go-home-after-report">
                  <Home className="w-4 h-4 mr-2" />
                  Continue to Homepage
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
