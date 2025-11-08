import { useState } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Avatar, 
  Typography, 
  IconButton, 
  Chip,
  TextField,
  Button,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { 
  Heart, 
  MessageCircle, 
  Repeat2, 
  Quote,
  Send 
} from 'lucide-react';
import { 
  FaFacebook, 
  FaInstagram, 
  FaTiktok, 
  FaSnapchat, 
  FaTwitter 
} from 'react-icons/fa';

export interface NewsfeedPost {
  id: number;
  content: string;
  authorHandle: string;
  authorDisplayName: string;
  authorProfileImage: string;
  createdAt: string;
  likesCount: number;
  sharesCount: number;
  commentsCount: number;
  algorithmScore: number;
  imageUrls?: string[];
  isRetweet?: boolean;
  originalPost?: {
    id: number;
    content: string;
    authorHandle: string;
    authorDisplayName: string;
  };
}

export interface PostComment {
  id: string;
  content: string;
  authorHandle: string;
  authorDisplayName: string;
  authorProfileImage: string;
  createdAt: string;
  likesCount: number;
}

interface PostCardProps {
  post: NewsfeedPost;
  isLiked: boolean;
  onLike: () => void;
  onRetweet: () => void;
  onQuote: (content: string) => void;
  onComment: (content: string) => void;
  onProfileClick: (handle: string) => void;
}

// Helper function to format time ago
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// Helper function to get score color
function getScoreColor(score: number): string {
  if (score >= 80) return '#10b981'; // green
  if (score >= 60) return '#3b82f6'; // blue
  if (score >= 40) return '#f59e0b'; // amber
  return '#6b7280'; // gray
}

export function PostCard({
  post,
  isLiked,
  onLike,
  onRetweet,
  onQuote,
  onComment,
  onProfileClick
}: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);
  const [quoteText, setQuoteText] = useState('');

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    onComment(newComment);
    setNewComment('');
  };

  const handleQuote = () => {
    if (!quoteText.trim()) return;
    onQuote(quoteText);
    setQuoteText('');
    setShowQuoteDialog(false);
  };

  const handleShare = (platform: string) => {
    const shareUrl = `${window.location.origin}/riddle/${post.id}`;
    const text = `Check out this riddle from ${post.authorDisplayName}!\n\n"${post.content.substring(0, 200)}${post.content.length > 200 ? '...' : ''}"\n\n`;
    
    switch (platform) {
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, '_blank', 'width=550,height=420');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank', 'width=550,height=420');
        break;
      default:
        navigator.clipboard.writeText(shareUrl);
    }
  };

  return (
    <Card sx={{ mb: 2, '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.3s' }}>
      <CardContent sx={{ p: 3 }}>
        {/* Retweet indicator */}
        {post.isRetweet && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'text.secondary' }}>
            <Repeat2 style={{ width: 16, height: 16 }} />
            <Typography variant="body2">
              <Typography 
                component="span" 
                fontWeight="medium" 
                sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                onClick={() => onProfileClick(post.authorHandle)}
              >
                {post.authorDisplayName || post.authorHandle}
              </Typography> retweeted
            </Typography>
          </Box>
        )}
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Avatar 
            src={post.authorProfileImage}
            sx={{ 
              width: 48, 
              height: 48, 
              cursor: 'pointer', 
              '&:hover': { opacity: 0.8 } 
            }}
            onClick={() => onProfileClick(post.isRetweet ? post.originalPost!.authorHandle : post.authorHandle)}
          >
            {(post.isRetweet ? post.originalPost!.authorDisplayName : post.authorDisplayName)?.charAt(0).toUpperCase()}
          </Avatar>
          
          <Box sx={{ flex: 1 }}>
            {/* Author info and score */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <Typography 
                variant="body1" 
                fontWeight="bold"
                sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                onClick={() => onProfileClick(post.isRetweet ? post.originalPost!.authorHandle : post.authorHandle)}
              >
                {post.isRetweet ? post.originalPost!.authorDisplayName || post.originalPost!.authorHandle : post.authorDisplayName || post.authorHandle}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                @{post.isRetweet ? post.originalPost!.authorHandle : post.authorHandle}
              </Typography>

              <Typography variant="body2" color="text.secondary">·</Typography>
              <Typography variant="body2" color="text.secondary">
                {formatTimeAgo(post.createdAt)}
              </Typography>
              
              {/* Algorithm Score */}
              <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box 
                  sx={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    bgcolor: getScoreColor(post.algorithmScore) 
                  }} 
                />
                <Typography variant="caption" color="text.secondary">
                  {post.algorithmScore.toFixed(1)}
                </Typography>
              </Box>
            </Box>
            
            {/* Post content */}
            <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
              {post.isRetweet ? post.originalPost!.content : post.content}
            </Typography>
            
            {/* Image display */}
            {post.imageUrls && post.imageUrls.length > 0 && (
              <Box 
                sx={{ 
                  mb: 2, 
                  borderRadius: 2, 
                  overflow: 'hidden', 
                  border: 1, 
                  borderColor: 'divider' 
                }}
              >
                <img 
                  src={post.imageUrls[0]} 
                  alt="Post image"
                  style={{ width: '100%', maxHeight: 384, objectFit: 'cover' }}
                />
              </Box>
            )}
            
            {/* Action buttons */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
                <IconButton 
                  size="small" 
                  onClick={() => setShowComments(!showComments)}
                  sx={{ 
                    color: showComments ? 'primary.main' : 'text.secondary',
                    bgcolor: showComments ? 'primary.light' : 'transparent',
                    '&:hover': { bgcolor: 'primary.light', color: 'primary.main' }
                  }}
                  data-testid={`button-comment-${post.id}`}
                >
                  <MessageCircle style={{ width: 16, height: 16 }} />
                  <Typography variant="caption" sx={{ ml: 0.5 }} fontWeight="medium">
                    {post.commentsCount}
                  </Typography>
                </IconButton>
                
                <IconButton 
                  size="small" 
                  onClick={onRetweet}
                  sx={{ 
                    color: 'text.secondary',
                    '&:hover': { bgcolor: 'success.light', color: 'success.main' }
                  }}
                  data-testid={`button-retweet-${post.id}`}
                >
                  <Repeat2 style={{ width: 16, height: 16 }} />
                  <Typography variant="caption" sx={{ ml: 0.5 }} fontWeight="medium">
                    {post.sharesCount}
                  </Typography>
                </IconButton>

                <IconButton 
                  size="small" 
                  onClick={() => setShowQuoteDialog(true)}
                  sx={{ 
                    color: 'text.secondary',
                    '&:hover': { bgcolor: 'secondary.light', color: 'secondary.main' }
                  }}
                  data-testid={`button-quote-${post.id}`}
                >
                  <Quote style={{ width: 16, height: 16 }} />
                </IconButton>
                
                <IconButton 
                  size="small" 
                  onClick={onLike}
                  sx={{ 
                    color: isLiked ? 'error.main' : 'text.secondary',
                    bgcolor: isLiked ? 'error.light' : 'transparent',
                    '&:hover': { bgcolor: 'error.light', color: 'error.main' }
                  }}
                  data-testid={`button-like-${post.id}`}
                >
                  <Heart 
                    style={{ width: 16, height: 16 }} 
                    fill={isLiked ? 'currentColor' : 'none'}
                  />
                  <Typography variant="caption" sx={{ ml: 0.5 }} fontWeight="medium">
                    {post.likesCount}
                  </Typography>
                </IconButton>
              </Box>
              
              {/* Social share buttons */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, display: { xs: 'none', sm: 'inline' } }}>
                  Share:
                </Typography>
                
                <IconButton size="small" onClick={() => handleShare('twitter')} data-testid={`button-share-twitter-${post.id}`}>
                  <FaTwitter style={{ width: 14, height: 14, color: '#1DA1F2' }} />
                </IconButton>
                
                <IconButton size="small" onClick={() => handleShare('facebook')} data-testid={`button-share-facebook-${post.id}`}>
                  <FaFacebook style={{ width: 14, height: 14, color: '#4267B2' }} />
                </IconButton>
                
                <IconButton size="small" onClick={() => handleShare('instagram')} data-testid={`button-share-instagram-${post.id}`}>
                  <FaInstagram style={{ width: 14, height: 14, color: '#E1306C' }} />
                </IconButton>
                
                <IconButton size="small" onClick={() => handleShare('tiktok')} data-testid={`button-share-tiktok-${post.id}`}>
                  <FaTiktok style={{ width: 14, height: 14 }} />
                </IconButton>
                
                <IconButton size="small" onClick={() => handleShare('snapchat')} data-testid={`button-share-snapchat-${post.id}`}>
                  <FaSnapchat style={{ width: 14, height: 14, color: '#FFFC00' }} />
                </IconButton>
              </Box>
            </Box>

            {/* Comments Section */}
            {showComments && (
              <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
                {/* Add Comment */}
                <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
                  <Avatar sx={{ width: 32, height: 32 }}>U</Avatar>
                  <Box sx={{ flex: 1, display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newComment.trim()) {
                          handleAddComment();
                        }
                      }}
                    />
                    <IconButton 
                      size="small"
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      sx={{
                        background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)',
                        color: 'white',
                        '&:hover': {
                          background: 'linear-gradient(90deg, #2563eb 0%, #7c3aed 100%)',
                        },
                        '&:disabled': {
                          opacity: 0.5
                        }
                      }}
                      data-testid={`button-add-comment-${post.id}`}
                    >
                      <Send style={{ width: 16, height: 16 }} />
                    </IconButton>
                  </Box>
                </Box>

                {/* Comments placeholder */}
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  Comments will load here
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </CardContent>

      {/* Quote Dialog */}
      <Dialog 
        open={showQuoteDialog} 
        onClose={() => setShowQuoteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Quote Riddle</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            placeholder="Add your thoughts..."
            value={quoteText}
            onChange={(e) => setQuoteText(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          
          {/* Original post preview */}
          <Box sx={{ 
            border: 1, 
            borderColor: 'divider', 
            borderRadius: 2, 
            p: 2, 
            bgcolor: 'action.hover' 
          }}>
            <Box sx={{ display: 'flex', gap: 1.5, mb: 1 }}>
              <Avatar 
                src={post.authorProfileImage}
                sx={{ width: 32, height: 32 }}
              >
                {post.authorDisplayName?.charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="body2" fontWeight="medium">
                  {post.authorDisplayName || post.authorHandle}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  @{post.authorHandle}
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2">
              {post.content}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowQuoteDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleQuote}
            variant="contained"
            disabled={!quoteText.trim()}
          >
            Quote Riddle
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
