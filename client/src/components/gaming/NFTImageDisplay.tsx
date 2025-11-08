/**
 * NFT Image Display Component with History
 * Material UI - Reusable across different pages
 */

import { useState } from 'react';
import {
  Box,
  Card,
  CardMedia,
  CardContent,
  Typography,
  IconButton,
  Dialog,
  DialogContent,
  ImageList,
  ImageListItem,
  Chip,
  Stack,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  History as HistoryIcon,
  ZoomIn as ZoomInIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';

interface ImageHistoryItem {
  id: string;
  storedImageUrl: string;
  openaiImageUrl: string;
  generatedAt: string;
  isCurrent: boolean;
  promptUsed: string;
}

interface NFTImageDisplayProps {
  nftTokenId: string;
  currentImageUrl: string;
  nftName: string;
}

export default function NFTImageDisplay({ nftTokenId, currentImageUrl, nftName }: NFTImageDisplayProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Fetch image history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['nft-image-history', nftTokenId],
    queryFn: async () => {
      const res = await fetch(`/api/gaming/nft/${nftTokenId}/image-history`);
      if (!res.ok) throw new Error('Failed to load image history');
      return res.json();
    },
    enabled: showHistory,
  });

  const imageHistory = historyData?.history || [];

  return (
    <>
      <Card elevation={3} sx={{ position: 'relative', overflow: 'hidden' }}>
        <CardMedia
          component="img"
          image={currentImageUrl}
          alt={nftName}
          sx={{
            width: '100%',
            aspectRatio: '1/1',
            objectFit: 'cover',
            cursor: 'pointer',
            transition: 'transform 0.3s',
            '&:hover': {
              transform: 'scale(1.05)',
            },
          }}
          onClick={() => setPreviewImage(currentImageUrl)}
        />
        
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            gap: 1,
          }}
        >
          <Tooltip title="View History">
            <IconButton
              onClick={() => setShowHistory(true)}
              sx={{
                bgcolor: 'rgba(0,0,0,0.6)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
              }}
            >
              <HistoryIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Zoom">
            <IconButton
              onClick={() => setPreviewImage(currentImageUrl)}
              sx={{
                bgcolor: 'rgba(0,0,0,0.6)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
              }}
            >
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <CardContent>
          <Typography variant="subtitle2" color="text.secondary">
            Full-Body Character Portrait
          </Typography>
        </CardContent>
      </Card>

      {/* Image History Dialog */}
      <Dialog
        open={showHistory}
        onClose={() => setShowHistory(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent>
          <Typography variant="h6" gutterBottom>
            Image Generation History
          </Typography>
          
          {historyLoading && (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          )}

          {!historyLoading && imageHistory.length === 0 && (
            <Typography color="text.secondary" align="center" py={4}>
              No previous images generated
            </Typography>
          )}

          <ImageList cols={3} gap={12}>
            {imageHistory.map((item: ImageHistoryItem) => (
              <ImageListItem key={item.id}>
                <Box
                  component="img"
                  src={item.storedImageUrl || item.openaiImageUrl}
                  alt={`Generated ${new Date(item.generatedAt).toLocaleDateString()}`}
                  sx={{
                    width: '100%',
                    aspectRatio: '1/1',
                    objectFit: 'cover',
                    cursor: 'pointer',
                    border: item.isCurrent ? '3px solid' : 'none',
                    borderColor: 'primary.main',
                    borderRadius: 1,
                  }}
                  onClick={() => setPreviewImage(item.storedImageUrl || item.openaiImageUrl)}
                />
                <Stack direction="row" spacing={1} mt={1} alignItems="center">
                  {item.isCurrent && (
                    <Chip
                      label="Current"
                      size="small"
                      color="primary"
                      icon={<CheckCircleIcon />}
                    />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {new Date(item.generatedAt).toLocaleDateString()}
                  </Typography>
                </Stack>
              </ImageListItem>
            ))}
          </ImageList>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog
        open={!!previewImage}
        onClose={() => setPreviewImage(null)}
        maxWidth="lg"
      >
        <DialogContent sx={{ p: 0 }}>
          <Box
            component="img"
            src={previewImage || ''}
            alt="Preview"
            sx={{ width: '100%', display: 'block' }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
