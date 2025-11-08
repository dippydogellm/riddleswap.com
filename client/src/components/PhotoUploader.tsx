import React, { useState, useRef } from 'react';
import { Camera, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface PhotoUploaderProps {
  type: 'profile' | 'cover' | 'post';
  onUploadSuccess: (url: string) => void;
  onUploadError: (error: string) => void;
  buttonStyle?: React.CSSProperties;
  children?: React.ReactNode;
}

export function PhotoUploader({ type, onUploadSuccess, onUploadError, buttonStyle, children }: PhotoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      onUploadError("Please select an image file (JPG, PNG, etc.)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      onUploadError("Image must be smaller than 10MB");
      return;
    }

    setIsUploading(true);

    try {
      console.log(`📸 [PHOTO UPLOADER] Starting ${type} image upload...`);
      
      // Create FormData for direct file upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      // Choose the correct endpoint
      const uploadEndpoint = type === 'post' ? '/api/save-post-image' : '/api/upload-photo';
      
      console.log(`📤 [PHOTO UPLOADER] Uploading to ${uploadEndpoint}...`);

      // Direct upload to server (no cloud storage)
      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken') || ''}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = (await response.json()).catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `Upload failed: ${response.statusText}`);
      }

      const data = await response.json() as any;
      const imageUrl = data.url || data.imageUrl;
      
      if (!imageUrl) {
        throw new Error('No image URL received from server');
      }

      console.log(`✅ [PHOTO UPLOADER] File uploaded successfully:`, imageUrl);
      
      onUploadSuccess(imageUrl);
      toast({
        title: "Photo Uploaded",
        description: `${type === 'profile' ? 'Profile' : type === 'cover' ? 'Cover' : 'Post'} photo uploaded successfully!`
      });
      
    } catch (error: any) {
      console.error('❌ [PHOTO UPLOADER] Upload error:', error);
      onUploadError(error.message || "Failed to upload photo. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        style={{ display: 'none' }}
      />
      
      <div
        onClick={() => fileInputRef.current?.click()}
        style={{
          ...buttonStyle,
          position: 'relative',
          overflow: 'hidden',
          cursor: isUploading ? 'default' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.5rem',
          border: '1px solid #d1d5db',
          borderRadius: '0.375rem',
          backgroundColor: 'white',
          transition: 'all 0.2s',
          opacity: isUploading ? 0.6 : 1
        }}
        className="hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
      >
        {isUploading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Upload className="w-4 h-4 animate-spin" />
            <span className="text-sm">Uploading...</span>
          </div>
        ) : (
          children || (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Camera className="w-4 h-4" />
              <span className="text-sm">{type === 'profile' ? 'Profile Picture' : 'Cover Photo'}</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
