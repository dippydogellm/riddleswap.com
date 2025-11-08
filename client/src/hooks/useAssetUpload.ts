import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from './use-toast';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface AssetUploadOptions {
  maxSizeMB?: number;
  acceptedTypes?: string[];
  folder?: string;
  generateThumbnails?: boolean;
}

export interface UploadedAsset {
  id: string;
  url: string;
  thumbnailUrl?: string;
  filename: string;
  size: number;
  contentType: string;
  folder?: string;
  createdAt: string;
}

// Hook for asset upload functionality
export function useAssetUpload(options: AssetUploadOptions = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ loaded: 0, total: 0, percentage: 0 });

  const {
    maxSizeMB = 10,
    acceptedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    folder = 'profile-assets',
    generateThumbnails = true,
  } = options;

  // Validate file before upload
  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return `File type ${file.type} is not supported. Accepted types: ${acceptedTypes.join(', ')}`;
    }
    
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File size must be less than ${maxSizeMB}MB`;
    }
    
    return null;
  };

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File): Promise<UploadedAsset> => {
      // Validate file
      const validationError = validateFile(file);
      if (validationError) {
        throw new Error(validationError);
      }

      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);
      if (generateThumbnails) {
        formData.append('generateThumbnails', 'true');
      }

      // Create XMLHttpRequest for progress tracking
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentage = Math.round((event.loaded * 100) / event.total);
            setUploadProgress({
              loaded: event.loaded,
              total: event.total,
              percentage,
            });
          }
        });

        // Handle completion
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              resolve(result);
            } catch (error) {
              reject(new Error('Invalid response format'));
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        });

        // Handle errors
        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        // Make request
        xhr.open('POST', '/api/assets/upload');
        
        // Add auth headers if available
        const sessionToken = localStorage.getItem('sessionToken');
        if (sessionToken) {
          xhr.setRequestHeader('Authorization', `Bearer ${sessionToken}`);
        }
        
        xhr.send(formData);
      });
    },
    onSuccess: (uploadedAsset) => {
      setUploadProgress({ loaded: 0, total: 0, percentage: 0 });
      
      // Invalidate asset queries
      queryClient.invalidateQueries({ queryKey: ['/api/assets'] });
      
      toast({
        title: 'Upload Successful',
        description: `${uploadedAsset.filename} has been uploaded successfully.`,
      });
    },
    onError: (error: any) => {
      setUploadProgress({ loaded: 0, total: 0, percentage: 0 });
      
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload file',
        variant: 'destructive',
      });
    },
  });

  // Bulk upload mutation
  const bulkUploadMutation = useMutation({
    mutationFn: async (files: File[]): Promise<UploadedAsset[]> => {
      const results: UploadedAsset[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate each file
        const validationError = validateFile(file);
        if (validationError) {
          throw new Error(`File ${file.name}: ${validationError}`);
        }
        
        // Update progress for bulk upload
        setUploadProgress({
          loaded: i,
          total: files.length,
          percentage: Math.round((i / files.length) * 100),
        });
        
        // Upload file
        const result = await uploadMutation.mutateAsync(file);
        results.push(result);
      }
      
      return results;
    },
    onSuccess: (assets) => {
      setUploadProgress({ loaded: 0, total: 0, percentage: 0 });
      
      toast({
        title: 'Bulk Upload Successful',
        description: `${assets.length} files uploaded successfully.`,
      });
    },
    onError: (error: any) => {
      setUploadProgress({ loaded: 0, total: 0, percentage: 0 });
      
      toast({
        title: 'Bulk Upload Failed',
        description: error.message || 'Failed to upload files',
        variant: 'destructive',
      });
    },
  });

  // Delete asset mutation
  const deleteAssetMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const response = await apiRequest(`/api/assets/${assetId}`, {
        method: 'DELETE',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assets'] });
      
      toast({
        title: 'Asset Deleted',
        description: 'Asset has been deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete asset',
        variant: 'destructive',
      });
    },
  });

  return {
    // Upload functions
    uploadFile: uploadMutation.mutateAsync,
    uploadFiles: bulkUploadMutation.mutateAsync,
    deleteAsset: deleteAssetMutation.mutateAsync,
    
    // Upload state
    isUploading: uploadMutation.isPending || bulkUploadMutation.isPending,
    uploadProgress,
    
    // Validation
    validateFile,
    
    // Mutation objects (for additional state like error)
    uploadMutation,
    bulkUploadMutation,
    deleteAssetMutation,
  };
}
