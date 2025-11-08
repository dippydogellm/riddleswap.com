import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface ProjectOverride {
  id: string;
  project_id: string;
  title?: string;
  description?: string;
  website?: string;
  logo_url?: string;
  banner_url?: string;
  social_links?: {
    twitter?: string;
    discord?: string;
    telegram?: string;
    [key: string]: string | undefined;
  };
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectOverrideInput {
  project_id: string;
  title?: string;
  description?: string;
  website?: string;
  logo_url?: string;
  banner_url?: string;
  social_links?: Record<string, string>;
}

// Hook for fetching project overrides
export function useProjectOverrides(projectId: string) {
  const { isAuthenticated } = useAuth();

  return useQuery<{ success: boolean; overrides: ProjectOverride }>({
    queryKey: ['/api/project-content-overrides', projectId],
    enabled: !!projectId && isAuthenticated,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });
}

// Hook for fetching all user's overrides
export function useUserOverrides() {
  const { isAuthenticated } = useAuth();

  return useQuery<{ success: boolean; overrides: ProjectOverride[] }>({
    queryKey: ['/api/project-content-overrides'],
    enabled: isAuthenticated,
    staleTime: 60000, // 1 minute
  });
}

// Hook for project override mutations
export function useProjectOverrideMutations(projectId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Create or update override
  const saveOverride = useMutation({
    mutationFn: async (data: ProjectOverrideInput) => {
      const response = await apiRequest('/api/project-content-overrides', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate specific project overrides
      queryClient.invalidateQueries({ 
        queryKey: ['/api/project-content-overrides', variables.project_id] 
      });
      
      // Invalidate all user overrides
      queryClient.invalidateQueries({ 
        queryKey: ['/api/project-content-overrides'] 
      });
      
      // Invalidate unified metadata for this project
      queryClient.invalidateQueries({ 
        queryKey: ['/api/metadata/unified', variables.project_id] 
      });
      
      // Invalidate subscription usage
      queryClient.invalidateQueries({ 
        queryKey: ['/api/subscriptions/usage'] 
      });

      toast({
        title: 'Override Saved',
        description: 'Your project override has been saved successfully.',
      });
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || 'Failed to save override';
      toast({
        title: 'Save Failed',
        description: message,
        variant: 'destructive',
      });
    },
  });

  // Update specific fields
  const updateOverride = useMutation({
    mutationFn: async ({ 
      overrideId, 
      updates 
    }: { 
      overrideId: string; 
      updates: Partial<ProjectOverrideInput> 
    }) => {
      const response = await apiRequest(`/api/project-content-overrides/${overrideId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ 
        queryKey: ['/api/project-content-overrides'] 
      });
      
      if (projectId) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/project-content-overrides', projectId] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['/api/metadata/unified', projectId] 
        });
      }

      toast({
        title: 'Override Updated',
        description: 'Your changes have been saved.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update override',
        variant: 'destructive',
      });
    },
  });

  // Publish/unpublish override
  const togglePublish = useMutation({
    mutationFn: async ({ 
      overrideId, 
      published 
    }: { 
      overrideId: string; 
      published: boolean 
    }) => {
      const response = await apiRequest(`/api/project-content-overrides/${overrideId}/publish`, {
        method: 'POST',
        body: JSON.stringify({ published }),
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/project-content-overrides'] 
      });
      
      if (projectId) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/project-content-overrides', projectId] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['/api/metadata/unified', projectId] 
        });
      }

      toast({
        title: variables.published ? 'Override Published' : 'Override Unpublished',
        description: variables.published 
          ? 'Your override is now visible to the public.'
          : 'Your override is no longer visible to the public.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Publish Failed',
        description: error.message || 'Failed to update publish status',
        variant: 'destructive',
      });
    },
  });

  // Delete override
  const deleteOverride = useMutation({
    mutationFn: async (overrideId: string) => {
      const response = await apiRequest(`/api/project-content-overrides/${overrideId}`, {
        method: 'DELETE',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/project-content-overrides'] 
      });
      
      if (projectId) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/project-content-overrides', projectId] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['/api/metadata/unified', projectId] 
        });
      }

      queryClient.invalidateQueries({ 
        queryKey: ['/api/subscriptions/usage'] 
      });

      toast({
        title: 'Override Deleted',
        description: 'Your project override has been deleted.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete override',
        variant: 'destructive',
      });
    },
  });

  return {
    saveOverride,
    updateOverride,
    togglePublish,
    deleteOverride,
  };
}

// Hook for preview data (doesn't save)
export function useOverridePreview() {
  const generatePreview = (
    originalData: any,
    overrideData: Partial<ProjectOverrideInput>
  ) => {
    return {
      ...originalData,
      ...overrideData,
      // Merge social links
      social_links: {
        ...originalData.social_links,
        ...overrideData.social_links,
      },
    };
  };

  return { generatePreview };
}

// Hook for batch operations
export function useBatchOverrideOperations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const bulkPublish = useMutation({
    mutationFn: async (overrideIds: string[]) => {
      const response = await apiRequest('/api/project-content-overrides/bulk/publish', {
        method: 'POST',
        body: JSON.stringify({ overrideIds, published: true }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/project-content-overrides'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/metadata/unified'] 
      });
      
      toast({
        title: 'Bulk Publish Successful',
        description: 'Selected overrides have been published.',
      });
    },
  });

  const bulkUnpublish = useMutation({
    mutationFn: async (overrideIds: string[]) => {
      const response = await apiRequest('/api/project-content-overrides/bulk/publish', {
        method: 'POST',
        body: JSON.stringify({ overrideIds, published: false }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/project-content-overrides'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/metadata/unified'] 
      });
      
      toast({
        title: 'Bulk Unpublish Successful',
        description: 'Selected overrides have been unpublished.',
      });
    },
  });

  const bulkDelete = useMutation({
    mutationFn: async (overrideIds: string[]) => {
      const response = await apiRequest('/api/project-content-overrides/bulk/delete', {
        method: 'DELETE',
        body: JSON.stringify({ overrideIds }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/project-content-overrides'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/metadata/unified'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/subscriptions/usage'] 
      });
      
      toast({
        title: 'Bulk Delete Successful',
        description: 'Selected overrides have been deleted.',
      });
    },
  });

  return {
    bulkPublish,
    bulkUnpublish,
    bulkDelete,
  };
}
