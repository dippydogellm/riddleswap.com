import React, { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { StoryBuilder } from '@/components/story-builder';
import { TwitterFeed } from '@/components/twitter-feed';
import { OracleTerminal } from '@/components/oracle-terminal';
import { 
  Bot, 
  MessageSquare, 
  Sparkles, 
  GamepadIcon, 
  BookOpen, 
  Twitter, 
  Palette, 
  Brain,
  Zap,
  MessageCircle,
  Send,
  Settings,
  Play,
  Pause,
  RefreshCw,
  Star,
  TrendingUp,
  Clock,
  Users,
  Heart,
  Terminal
} from 'lucide-react';

// Type definitions for THE ORACLE API responses
interface PersonalityData {
  status?: string;
  communication_style?: string;
  interaction_count?: number;
  knowledge_depth?: string;
  personality_name?: string;
  traits?: any;
  humor_level?: number;
  formality_level?: number;
  enthusiasm_level?: number;
}

interface MessageData {
  id: string;
  message_role: 'user' | 'assistant';
  content: string;
  created_at: string;
  ai_confidence?: number;
}

interface ConversationData {
  id: string;
  messages?: MessageData[];
  status?: string;
  message_count?: number;
}

interface TweetRecommendationData {
  id: string;
  content: string;
  user_handle: string;
  created_at: string;
  priority?: string;
  used_in_tweet?: boolean;
}

interface NFTBookData {
  id: string;
  title: string;
  description: string;
  copies_minted?: number;
  created_at: string;
}

interface TweetData {
  id: string;
  content: string;
  tweet_type: string;
  created_at: string;
}

// THE ORACLE AI Interface Component
const TheOraclePage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'stories' | 'nft-books' | 'social' | 'terminal'>('chat');
  const [tweetRecommendation, setTweetRecommendation] = useState('');
  const [storyPrompt, setStoryPrompt] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Get AI personality info
  const { data: personality, isLoading: personalityLoading } = useQuery<PersonalityData>({
    queryKey: ['/api/riddleauthor/personality'],
    retry: 3,
  });

  // Get conversation history
  const { data: conversation, isLoading: conversationLoading } = useQuery<ConversationData>({
    queryKey: ['/api/riddleauthor/conversation'],
    retry: 3,
  });

  // Get tweet recommendations
  const { data: tweetRecommendations, isLoading: recommendationsLoading } = useQuery<any[]>({
    queryKey: ['/api/riddleauthor/tweet-recommendations'],
    retry: 3,
  });

  // Get NFT books
  const { data: nftBooks, isLoading: nftBooksLoading } = useQuery<NFTBookData[]>({
    queryKey: ['/api/riddleauthor/nft-books'],
    retry: 3,
  });

  // Get recent tweets
  const { data: recentTweets, isLoading: tweetsLoading } = useQuery<TweetData[]>({
    queryKey: ['/api/riddleauthor/tweets/recent'],
    retry: 3,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      setIsTyping(true);
      const response = await apiRequest('/api/riddleauthor/chat', {
        method: 'POST',
        body: JSON.stringify({ 
          message, 
          sessionId: `oracle-chat-${Date.now()}`,
          userHandle: 'dippydoge'
        }),
      });
      return response;
    },
    onSuccess: () => {
      setCurrentMessage('');
      setIsTyping(false);
      queryClient.invalidateQueries({ queryKey: ['/api/riddleauthor/conversation'] });
      toast({
        title: "Message sent to THE ORACLE",
        description: "The AI narrator is crafting a response...",
      });
    },
    onError: (error) => {
      setIsTyping(false);
      toast({
        title: "Communication Error",
        description: "Failed to reach THE ORACLE. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Submit tweet recommendation mutation
  const submitRecommendation = useMutation({
    mutationFn: async (recommendation: string) => {
      return await apiRequest('/api/riddleauthor/tweet-recommendations', {
        method: 'POST',
        body: JSON.stringify({ content: recommendation }),
      });
    },
    onSuccess: () => {
      setTweetRecommendation('');
      queryClient.invalidateQueries({ queryKey: ['/api/riddleauthor/tweet-recommendations'] });
      toast({
        title: "Tweet Recommendation Submitted",
        description: "Your recommendation will be considered for upcoming automated tweets.",
      });
    },
  });

  // Generate story mutation
  const generateStory = useMutation({
    mutationFn: async (prompt: string) => {
      return await apiRequest('/api/riddleauthor/stories/generate', {
        method: 'POST',
        body: JSON.stringify({ 
          prompt,
          story_type: 'narrative',
          length: 'medium'
        }),
      });
    },
    onSuccess: () => {
      setStoryPrompt('');
      toast({
        title: "Story Generated",
        description: "THE ORACLE has crafted a new story for you.",
      });
    },
  });

  // Create tweet mutation
  const createTweet = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest('/api/riddleauthor/tweets', {
        method: 'POST',
        body: JSON.stringify({ 
          content,
          tweet_type: 'announcement',
          scheduled_for: new Date().toISOString()
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/riddleauthor/tweets/recent'] });
      toast({
        title: "Tweet Created",
        description: "THE ORACLE has prepared a new tweet.",
      });
    },
  });

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [conversation]);

  const handleSendMessage = () => {
    if (currentMessage.trim()) {
      sendMessage.mutate(currentMessage.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary', p: 2 }}>
      <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 2 }}>
            <Box sx={{ p: 1.5, borderRadius: '50%', background: 'linear-gradient(to right, #7c3aed, #2563eb)', display: 'inline-flex' }}>
              <Bot className="h-8 w-8" />
            </Box>
            <Typography variant="h4" fontWeight={700} sx={{ background: 'linear-gradient(to right, #a78bfa, #60a5fa)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
              THE ORACLE AI
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 720, mx: 'auto' }}>
            Your AI-powered game narrator, storyteller, and NFT trading guide. Chat with the digital consciousness behind The Trolls Inquisition Multi-Chain Mayhem Edition.
          </Typography>
        </Box>

        {/* AI Personality Status */}
        {personality && (
          <Card sx={{ mb: 3 }}>
            <CardHeader title={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Brain className='h-5 w-5' />
                <Typography variant='subtitle1'>AI Personality Status</Typography>
              </Box>
            }/>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label={personality.status || 'Active'} color="success" variant="outlined" size="small" />
                    <Typography variant='body2' color='text.secondary'>
                      Mood: {personality.communication_style || 'Mysterious Guide'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Zap className='h-4 w-4' />
                    <Typography variant='body2' color='text.secondary'>
                      Interactions: {personality.interaction_count || 0}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Star className='h-4 w-4' />
                    <Typography variant='body2' color='text.secondary'>
                      Knowledge Depth: {personality.knowledge_depth || 'Expert'}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Main Interface Tabs */}
        <Box sx={{ mb: 2 }}>
          <Tabs
            value={['chat','stories','nft-books','social','terminal'].indexOf(activeTab)}
            onChange={(_e, idx) => setActiveTab(['chat','stories','nft-books','social','terminal'][idx] as any)}
            aria-label="Oracle tabs"
          >
            <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: .5}}><MessageCircle className='h-4 w-4'/> Chat</Box>} data-testid="tab-chat"/>
            <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: .5}}><BookOpen className='h-4 w-4'/> Stories</Box>} data-testid="tab-stories"/>
            <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: .5}}><Palette className='h-4 w-4'/> NFT Books</Box>} data-testid="tab-nft-books"/>
            <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: .5}}><Twitter className='h-4 w-4'/> Social</Box>} data-testid="tab-social"/>
            <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: .5}}><Terminal className='h-4 w-4'/> Terminal</Box>} data-testid="tab-terminal"/>
          </Tabs>
        </Box>

          {/* Chat Interface */}
        {activeTab === 'chat' && (
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} lg={8}>
                <Card sx={{ height: { xs: 400, sm: 500, lg: 600 }, display: 'flex', flexDirection: 'column' }}>
                  <CardHeader title={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><MessageSquare className='h-5 w-5'/> Conversation with THE ORACLE</Box>} />
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', height: { xs: 300, sm: 400, lg: 500 } }}>
                    <Box ref={chatScrollRef} sx={{ flex: 1, mb: 1.5, overflowY: 'auto', pr: 1 }}>
                      {conversationLoading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                          <CircularProgress size={24} />
                        </Box>
                      ) : conversation?.messages && conversation.messages.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {conversation.messages.map((message: MessageData, index: number) => (
                            <Box key={index} sx={{ display: 'flex', justifyContent: message.message_role === 'user' ? 'flex-end' : 'flex-start' }}>
                              <Box sx={{ maxWidth: '80%', p: 1.25, borderRadius: 1.25, bgcolor: message.message_role === 'user' ? 'primary.main' : 'action.hover', color: message.message_role === 'user' ? 'primary.contrastText' : 'text.primary' }}>
                                <Typography variant='body2'>{message.content}</Typography>
                                <Typography variant='caption' sx={{ opacity: 0.7, mt: 0.5, display: 'block' }}>
                                  {new Date(message.created_at).toLocaleTimeString()}
                                </Typography>
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                          <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                            <Bot className='h-12 w-12' style={{ opacity: 0.5, margin: '0 auto 8px' }} />
                            <Typography>Start a conversation with THE ORACLE</Typography>
                          </Box>
                        </Box>
                      )}
                      {isTyping && (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                          <Box sx={{ bgcolor: 'action.hover', p: 1.25, borderRadius: 1.25 }}>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <Box sx={{ width: 8, height: 8, bgcolor: 'primary.light', borderRadius: '50%', animation: 'bounce 1s infinite' }} />
                              <Box sx={{ width: 8, height: 8, bgcolor: 'primary.light', borderRadius: '50%', animation: 'bounce 1s infinite', animationDelay: '0.1s' }} />
                              <Box sx={{ width: 8, height: 8, bgcolor: 'primary.light', borderRadius: '50%', animation: 'bounce 1s infinite', animationDelay: '0.2s' }} />
                            </Box>
                          </Box>
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        placeholder="Ask RiddleAuthor about the game, request stories, or get NFT trading advice..."
                        value={currentMessage}
                        onChange={(e) => setCurrentMessage(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                        fullWidth
                        multiline
                        minRows={2}
                        inputProps={{ 'data-testid': 'input-message' }}
                      />
                      <Button onClick={handleSendMessage} disabled={!currentMessage.trim() || sendMessage.isPending} variant='contained' data-testid='button-send-message'>
                        <Send className='h-4 w-4' />
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} lg={4}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Card>
                    <CardHeader title={<Typography variant='subtitle2'>Quick Actions</Typography>} />
                    <CardContent>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Button variant='outlined' size='small' onClick={() => setCurrentMessage('What should RiddleAuthor tweet about?')} data-testid='button-tweet-ideas-quick'>
                          <Twitter className='h-4 w-4' style={{ marginRight: 6 }} /> Tweet Ideas
                        </Button>
                        <Button variant='outlined' size='small' onClick={() => setCurrentMessage('What NFT trading opportunities do you see?')} data-testid='button-trading-quick'>
                          <TrendingUp className='h-4 w-4' style={{ marginRight: 6 }} /> Trading Insights
                        </Button>
                        <Button variant='outlined' size='small' onClick={() => setCurrentMessage('Create a story about my latest adventure')} data-testid='button-story-quick'>
                          <BookOpen className='h-4 w-4' style={{ marginRight: 6 }} /> Story Request
                        </Button>
                        <Button variant='outlined' size='small' onClick={() => setCurrentMessage('Help me with customer service')} data-testid='button-support-quick'>
                          <Heart className='h-4 w-4' style={{ marginRight: 6 }} /> Customer Service
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader title={<Typography variant='subtitle2'>AI Status</Typography>} />
                    <CardContent>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant='body2' color='text.secondary'>Response Time</Typography>
                          <Chip label='Fast' color='success' variant='outlined' size='small' />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant='body2' color='text.secondary'>Learning Mode</Typography>
                          <Chip label='Active' color='primary' variant='outlined' size='small' />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant='body2' color='text.secondary'>Personality</Typography>
                          <Chip label='Mysterious' color='secondary' variant='outlined' size='small' />
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}


          {/* Stories Interface */}
        {activeTab === 'stories' && (
          <Box sx={{ mt: 2 }}>
            <StoryBuilder />
          </Box>
        )}

          {/* NFT Books Interface */}
        {activeTab === 'nft-books' && (
          <Box sx={{ mt: 2 }}>
            <Card>
              <CardHeader title="Monthly NFT Books" subheader="RiddleAuthor creates limited edition NFT books (123 copies each month)" />
              <CardContent>
                <Box sx={{ maxHeight: 400, overflowY: 'auto', pr: 1 }}>
                  {nftBooksLoading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : nftBooks && nftBooks.length > 0 ? (
                    <Grid container spacing={2}>
                      {nftBooks.map((book: NFTBookData, index: number) => (
                        <Grid item xs={12} md={6} key={index}>
                          <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'action.hover' }}>
                            <Typography variant='subtitle2' sx={{ mb: 1 }}>{book.title}</Typography>
                            <Typography variant='body2' color='text.secondary' sx={{ mb: 1.5 }}>{book.description}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Chip label={`${book.copies_minted || 0}/123`} color='success' variant='outlined' size='small' />
                              <Typography variant='caption' color='text.secondary'>
                                {new Date(book.created_at).toLocaleDateString()}
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'text.secondary' }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <BookOpen className='h-12 w-12' style={{ opacity: 0.5, margin: '0 auto 8px' }} />
                        <Typography>No NFT books published yet</Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}

          {/* Social Media Interface */}
        {activeTab === 'social' && (
          <Box sx={{ mt: 2 }}>
            <TwitterFeed />
          </Box>
        )}

          {/* Oracle Terminal - System Monitoring */}
        {activeTab === 'terminal' && (
          <Box sx={{ mt: 2 }}>
            <OracleTerminal />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default TheOraclePage;
