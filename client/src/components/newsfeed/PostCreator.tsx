import { useState } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Avatar, 
  TextField, 
  Button, 
  Typography, 
  IconButton 
} from '@mui/material';
import { Send, Image as ImageIcon, X, RefreshCw } from 'lucide-react';
import { PhotoUploader } from '@/components/PhotoUploader';

interface PostCreatorProps {
  userHandle?: string;
  onSubmit: (content: string, imageUrl?: string) => void;
  isSubmitting?: boolean;
}

export function PostCreator({ userHandle, onSubmit, isSubmitting = false }: PostCreatorProps) {
  const [content, setContent] = useState('');
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const maxCharacters = 280;
  
  const handleSubmit = () => {
    if ((!content.trim() && !uploadedImageUrl) || content.length > maxCharacters) return;
    
    onSubmit(content, uploadedImageUrl || undefined);
    setContent('');
    setUploadedImageUrl(null);
  };
  
  const remainingChars = maxCharacters - content.length;
  const charColor = remainingChars < 20 
    ? (remainingChars < 0 ? 'error' : 'warning')
    : 'success';

  return (
    <Card 
      sx={{ 
        mb: 3, 
        background: 'linear-gradient(135deg, #EBF4FF 0%, #E9D5FF 100%)', 
        boxShadow: 3, 
        '&:hover': { boxShadow: 6 }, 
        transition: 'all 0.3s' 
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {/* User Avatar */}
          <Avatar 
            sx={{ 
              width: 48, 
              height: 48, 
              border: '2px solid white', 
              boxShadow: 2 
            }}
          >
            {userHandle?.charAt(0).toUpperCase()}
          </Avatar>
          
          {/* Post Form */}
          <Box sx={{ flex: 1 }}>
            <TextField
              data-testid="textarea-new-post"
              placeholder="What's on your mind? Share a riddle..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              multiline
              rows={4}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: 3,
                  fontSize: '1.125rem',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                  },
                  '&.Mui-focused': {
                    bgcolor: 'white',
                  }
                }
              }}
              inputProps={{ maxLength: maxCharacters }}
            />
            
            {/* Actions Row */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {/* Image Upload */}
                <PhotoUploader
                  type="post"
                  onUploadSuccess={(url) => setUploadedImageUrl(url)}
                  onUploadError={(error) => console.error('Upload failed:', error)}
                  buttonStyle={{
                    padding: '12px',
                    borderRadius: '16px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ImageIcon style={{ width: 20, height: 20 }} />
                    <Typography variant="body2" fontWeight="medium" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                      Photo
                    </Typography>
                  </Box>
                </PhotoUploader>
                
                {/* Upload Preview */}
                {uploadedImageUrl && (
                  <Box sx={{ position: 'relative' }}>
                    <img 
                      src={uploadedImageUrl} 
                      alt="Upload preview" 
                      style={{ 
                        width: 48, 
                        height: 48, 
                        borderRadius: 12, 
                        objectFit: 'cover', 
                        border: '2px solid white', 
                        boxShadow: '0 4px 8px rgba(0,0,0,0.1)' 
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => setUploadedImageUrl(null)}
                      sx={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        bgcolor: 'error.main',
                        color: 'white',
                        width: 24,
                        height: 24,
                        '&:hover': {
                          bgcolor: 'error.dark',
                          transform: 'scale(1.1)'
                        },
                        transition: 'all 0.2s'
                      }}
                    >
                      <X style={{ width: 12, height: 12 }} />
                    </IconButton>
                  </Box>
                )}
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {/* Character Count */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      border: `4px solid`,
                      borderColor: `${charColor}.main`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: `${charColor}.light`,
                      color: `${charColor}.dark`,
                      fontWeight: 'bold',
                      fontSize: '0.75rem'
                    }}
                  >
                    {Math.max(0, remainingChars)}
                  </Box>
                  <Typography 
                    variant="body2" 
                    fontWeight="medium" 
                    color={`${charColor}.main`}
                  >
                    {content.length}/{maxCharacters}
                  </Typography>
                </Box>
                
                {/* Post Button */}
                <Button
                  data-testid="button-submit-post"
                  onClick={handleSubmit}
                  disabled={(!content.trim() && !uploadedImageUrl) || isSubmitting || content.length > maxCharacters}
                  variant="contained"
                  sx={{
                    background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)',
                    fontWeight: 'bold',
                    px: 4,
                    py: 1.5,
                    borderRadius: 3,
                    boxShadow: 3,
                    '&:hover': {
                      boxShadow: 6,
                      transform: 'scale(1.05)'
                    },
                    '&:disabled': {
                      opacity: 0.5,
                      transform: 'none'
                    },
                    transition: 'all 0.3s'
                  }}
                  startIcon={isSubmitting ? <RefreshCw className="animate-spin" style={{ width: 20, height: 20 }} /> : <Send style={{ width: 20, height: 20 }} />}
                >
                  <Typography variant="body2" fontWeight="bold">
                    {isSubmitting ? 'Posting...' : 'Post Riddle'}
                  </Typography>
                </Button>
              </Box>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
