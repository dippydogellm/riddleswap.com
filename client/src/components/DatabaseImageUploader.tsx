import { useState, useRef } from 'react';
import { Camera, Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface DatabaseImageUploaderProps {
  type: 'crest' | 'commander';
  currentImage?: string | null;
  onUploadSuccess: (base64Data: string) => void;
  onUploadError: (error: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export function DatabaseImageUploader({ 
  type, 
  currentImage, 
  onUploadSuccess, 
  onUploadError, 
  className,
  children 
}: DatabaseImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(currentImage || null);
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

    // Limit file size to 5MB to prevent database issues
    if (file.size > 5 * 1024 * 1024) {
      onUploadError("Image must be smaller than 5MB");
      return;
    }

    setIsUploading(true);

    try {
      console.log(`📸 [DATABASE IMAGE UPLOADER] Starting ${type} image upload...`);
      
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Data = e.target?.result as string;
        
        if (base64Data) {
          console.log(`✅ [DATABASE IMAGE UPLOADER] File converted to base64`);
          setPreviewImage(base64Data);
          onUploadSuccess(base64Data);
          toast({
            title: "Image Uploaded",
            description: `${type === 'crest' ? 'Civilization crest' : 'Commander profile'} image uploaded successfully!`
          });
        } else {
          throw new Error('Failed to convert image to base64');
        }
        setIsUploading(false);
      };

      reader.onerror = () => {
        throw new Error('Failed to read image file');
      };

      reader.readAsDataURL(file);
      
    } catch (error: any) {
      console.error('❌ [DATABASE IMAGE UPLOADER] Upload error:', error);
      onUploadError(error.message || "Failed to upload image. Please try again.");
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setPreviewImage(null);
    onUploadSuccess(''); // Send empty string to clear the image
    toast({
      title: "Image Removed",
      description: `${type === 'crest' ? 'Civilization crest' : 'Commander profile'} image removed successfully!`
    });
  };

  const displayImage = previewImage || currentImage;

  return (
    <div className={className}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        style={{ display: 'none' }}
      />
      
      {/* Image Preview */}
      {displayImage && (
        <div className="relative mb-3">
          <img 
            src={displayImage} 
            alt={`${type === 'crest' ? 'Civilization crest' : 'Commander profile'}`}
            className="w-full h-32 object-cover rounded-lg border-2 border-slate-300 dark:border-slate-600"
            onError={() => {
              console.warn('Failed to load image:', displayImage.substring(0, 50) + '...');
              setPreviewImage(null);
            }}
          />
          <Button
            onClick={handleRemoveImage}
            size="sm"
            variant="destructive"
            className="absolute top-2 right-2 h-6 w-6 p-0"
            disabled={isUploading}
            data-testid={`button-remove-${type}-image`}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      
      {/* Upload Button */}
      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        variant="outline"
        className="w-full"
        data-testid={`button-upload-${type}-image`}
      >
        {isUploading ? (
          <>
            <Upload className="mr-2 h-4 w-4 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            {displayImage ? (
              <>
                <Camera className="mr-2 h-4 w-4" />
                Change {type === 'crest' ? 'Crest' : 'Profile Picture'}
              </>
            ) : (
              <>
                <ImageIcon className="mr-2 h-4 w-4" />
                Upload {type === 'crest' ? 'Crest' : 'Profile Picture'}
              </>
            )}
          </>
        )}
      </Button>

      {children}
    </div>
  );
}
