import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  AlertTriangle, 
  Bug, 
  CheckCircle, 
  XCircle, 
  Calendar,
  Filter,
  Search,
  BarChart3,
  RefreshCw,
  Eye,
  Edit,
  Clock,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface ErrorLog {
  id: string;
  error_message: string;
  stack_trace?: string;
  user_id?: string;
  user_handle?: string;
  page_url: string;
  user_agent?: string;
  error_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  component_name?: string;
  api_endpoint?: string;
  browser_info?: any;
  error_context?: any;
  resolved: boolean;
  resolution_notes?: string;
  created_at: string;
  resolved_at?: string;
}

interface ErrorStats {
  total: number;
  recent: number;
  unresolved: number;
  bySevetiry: Array<{ severity: string; count: number }>;
  byType: Array<{ error_type: string; count: number }>;
  period: string;
}

interface FilterState {
  search: string;
  severity: string;
  error_type: string;
  resolved: string;
  start_date: string;
  end_date: string;
}

export default function ErrorLogsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [editingError, setEditingError] = useState<ErrorLog | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    severity: '',
    error_type: '',
    resolved: '',
    start_date: '',
    end_date: ''
  });
  const [editForm, setEditForm] = useState({
    resolved: false,
    resolution_notes: '',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical'
  });

  // Fetch error logs
  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/errors/admin/logs', page, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
      });
      
      const response = await apiRequest(`/api/errors/admin/logs?${params}`, {
        method: 'GET'
      });
      return response.json();
    }
  });

  // Fetch error statistics
  const { data: stats } = useQuery<ErrorStats>({
    queryKey: ['/api/errors/admin/stats'],
    queryFn: async () => {
      const response = await apiRequest('/api/errors/admin/stats?days=7', {
        method: 'GET'
      });
      return response.json();
    }
  });

  // Update error mutation
  const updateErrorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest(`/api/errors/admin/logs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/errors/admin/logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/errors/admin/stats'] });
      setEditingError(null);
      toast({ title: 'Success', description: 'Error log updated successfully' });
    }
  });

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      severity: '',
      error_type: '',
      resolved: '',
      start_date: '',
      end_date: ''
    });
    setPage(1);
  };

  const handleEditError = (error: ErrorLog) => {
    setEditingError(error);
    setEditForm({
      resolved: error.resolved,
      resolution_notes: error.resolution_notes || '',
      severity: error.severity
    });
  };

  const handleUpdateError = () => {
    if (!editingError) return;
    updateErrorMutation.mutate({
      id: editingError.id,
      data: editForm
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return XCircle;
      case 'high': return AlertTriangle;
      case 'medium': return AlertCircle;
      case 'low': return Clock;
      default: return Bug;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'react_error': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'api_error': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'network_error': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'validation_error': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'auth_error': return 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400';
      case 'user_report': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Error Logs Administration
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Monitor and manage application errors
            </p>
          </div>
          <Button onClick={() => refetch()} disabled={isLoading} data-testid="button-refresh-logs">
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="logs" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="logs">Error Logs</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="space-y-6">
            {/* Statistics Cards */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Total Errors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {stats.total}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      All time total
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Recent Errors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {stats.recent}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {stats.period}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Unresolved
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                      {stats.unresolved}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Needs attention
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Charts */}
            {stats && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Errors by Severity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stats.bySevetiry.map(({ severity, count }) => (
                        <div key={severity} className="flex items-center justify-between">
                          <Badge className={getSeverityColor(severity)}>
                            {severity.toUpperCase()}
                          </Badge>
                          <span className="font-semibold">{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Errors by Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stats.byType.map(({ error_type, count }) => (
                        <div key={error_type} className="flex items-center justify-between">
                          <Badge className={getTypeColor(error_type)}>
                            {error_type.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <span className="font-semibold">{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="search">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="search"
                        placeholder="Search error messages..."
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                        className="pl-10"
                        data-testid="input-search-errors"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Severity</Label>
                    <Select value={filters.severity} onValueChange={(value) => handleFilterChange('severity', value)}>
                      <SelectTrigger data-testid="select-severity-filter">
                        <SelectValue placeholder="All severities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All severities</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Error Type</Label>
                    <Select value={filters.error_type} onValueChange={(value) => handleFilterChange('error_type', value)}>
                      <SelectTrigger data-testid="select-type-filter">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All types</SelectItem>
                        <SelectItem value="react_error">React Error</SelectItem>
                        <SelectItem value="api_error">API Error</SelectItem>
                        <SelectItem value="network_error">Network Error</SelectItem>
                        <SelectItem value="validation_error">Validation Error</SelectItem>
                        <SelectItem value="auth_error">Auth Error</SelectItem>
                        <SelectItem value="user_report">User Report</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Status</Label>
                    <Select value={filters.resolved} onValueChange={(value) => handleFilterChange('resolved', value)}>
                      <SelectTrigger data-testid="select-status-filter">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All statuses</SelectItem>
                        <SelectItem value="false">Unresolved</SelectItem>
                        <SelectItem value="true">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={clearFilters} variant="outline" size="sm" data-testid="button-clear-filters">
                    Clear Filters
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Error Logs Table */}
            <Card>
              <CardHeader>
                <CardTitle>Error Logs</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600 dark:text-gray-400">Loading error logs...</p>
                  </div>
                ) : logsData?.logs?.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-8 h-8 mx-auto mb-4 text-green-500" />
                    <p className="text-gray-600 dark:text-gray-400">No errors found with current filters</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {logsData?.logs?.map((log: ErrorLog) => {
                      const SeverityIcon = getSeverityIcon(log.severity);
                      
                      return (
                        <div
                          key={log.id}
                          className={cn(
                            "border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
                            !log.resolved && "border-l-4 border-l-red-500"
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <SeverityIcon className="w-4 h-4 flex-shrink-0" />
                                <Badge className={getSeverityColor(log.severity)}>
                                  {log.severity.toUpperCase()}
                                </Badge>
                                <Badge className={getTypeColor(log.error_type)}>
                                  {log.error_type.replace('_', ' ').toUpperCase()}
                                </Badge>
                                {log.resolved ? (
                                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                                    RESOLVED
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    OPEN
                                  </Badge>
                                )}
                              </div>
                              
                              <h3 className="font-medium text-gray-900 dark:text-white mb-1 truncate">
                                {log.error_message}
                              </h3>
                              
                              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                {log.component_name && (
                                  <p>Component: {log.component_name}</p>
                                )}
                                {log.user_handle && (
                                  <p>User: {log.user_handle}</p>
                                )}
                                <p>URL: {log.page_url}</p>
                                <p>Time: {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</p>
                              </div>
                            </div>
                            
                            <div className="flex gap-2 flex-shrink-0 ml-4">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedError(log)}
                                    data-testid={`button-view-error-${log.id}`}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Error Details</DialogTitle>
                                  </DialogHeader>
                                  {selectedError && (
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <Label>Error ID</Label>
                                          <p className="text-sm font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
                                            {selectedError.id}
                                          </p>
                                        </div>
                                        <div>
                                          <Label>Severity</Label>
                                          <Badge className={getSeverityColor(selectedError.severity)}>
                                            {selectedError.severity.toUpperCase()}
                                          </Badge>
                                        </div>
                                      </div>
                                      
                                      <div>
                                        <Label>Error Message</Label>
                                        <p className="text-sm bg-gray-100 dark:bg-gray-800 p-3 rounded">
                                          {selectedError.error_message}
                                        </p>
                                      </div>
                                      
                                      {selectedError.stack_trace && (
                                        <div>
                                          <Label>Stack Trace</Label>
                                          <ScrollArea className="h-40 bg-gray-100 dark:bg-gray-800 p-3 rounded">
                                            <pre className="text-xs">{selectedError.stack_trace}</pre>
                                          </ScrollArea>
                                        </div>
                                      )}
                                      
                                      {selectedError.error_context && (
                                        <div>
                                          <Label>Context</Label>
                                          <ScrollArea className="h-32 bg-gray-100 dark:bg-gray-800 p-3 rounded">
                                            <pre className="text-xs">
                                              {JSON.stringify(selectedError.error_context, null, 2)}
                                            </pre>
                                          </ScrollArea>
                                        </div>
                                      )}
                                      
                                      {selectedError.resolution_notes && (
                                        <div>
                                          <Label>Resolution Notes</Label>
                                          <p className="text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded">
                                            {selectedError.resolution_notes}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </DialogContent>
                              </Dialog>
                              
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditError(log)}
                                    data-testid={`button-edit-error-${log.id}`}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Edit Error Log</DialogTitle>
                                  </DialogHeader>
                                  {editingError && (
                                    <div className="space-y-4">
                                      <div>
                                        <Label>Status</Label>
                                        <Select
                                          value={editForm.resolved.toString()}
                                          onValueChange={(value) => setEditForm(prev => ({ ...prev, resolved: value === 'true' }))}
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="false">Open</SelectItem>
                                            <SelectItem value="true">Resolved</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      
                                      <div>
                                        <Label>Severity</Label>
                                        <Select
                                          value={editForm.severity}
                                          onValueChange={(value) => setEditForm(prev => ({ ...prev, severity: value as any }))}
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                            <SelectItem value="critical">Critical</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      
                                      <div>
                                        <Label>Resolution Notes</Label>
                                        <Textarea
                                          value={editForm.resolution_notes}
                                          onChange={(e) => setEditForm(prev => ({ ...prev, resolution_notes: e.target.value }))}
                                          placeholder="Add notes about how this error was resolved..."
                                          rows={4}
                                        />
                                      </div>
                                      
                                      <div className="flex gap-2">
                                        <Button
                                          onClick={handleUpdateError}
                                          disabled={updateErrorMutation.isPending}
                                          data-testid="button-save-error-changes"
                                        >
                                          {updateErrorMutation.isPending ? (
                                            <>
                                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                              Saving...
                                            </>
                                          ) : (
                                            'Save Changes'
                                          )}
                                        </Button>
                                        <Button
                                          variant="outline"
                                          onClick={() => setEditingError(null)}
                                          disabled={updateErrorMutation.isPending}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Pagination */}
                    {logsData?.pagination && (
                      <div className="flex items-center justify-between border-t pt-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Showing {((logsData.pagination.page - 1) * logsData.pagination.limit) + 1} to{' '}
                          {Math.min(logsData.pagination.page * logsData.pagination.limit, logsData.pagination.total)} of{' '}
                          {logsData.pagination.total} results
                        </p>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(Math.max(1, page - 1))}
                            disabled={page === 1}
                            data-testid="button-previous-page"
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(page + 1)}
                            disabled={page >= logsData.pagination.totalPages}
                            data-testid="button-next-page"
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
