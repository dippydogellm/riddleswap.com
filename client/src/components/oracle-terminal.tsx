import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Terminal, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Twitter,
  Send,
  RefreshCw,
  Zap,
  TrendingUp,
  MessageCircle
} from 'lucide-react';

interface TwitterStats {
  isConfigured: boolean;
  hasTokens: boolean;
  canPost: boolean;
  lastTweetTime?: string;
  nextTweetTime?: string;
  tweetCount: number;
}

interface TweetData {
  id: string;
  content: string;
  tweet_type: string;
  status: string;
  created_at: string;
  posted_at?: string;
  project_name?: string;
}

export const OracleTerminal = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [postingTweet, setPostingTweet] = useState(false);

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Twitter OAuth status
  const { data: twitterStatus, refetch: refetchTwitter } = useQuery<any>({
    queryKey: ['/api/twitter/oauth2/status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch recent tweets
  const { data: recentTweets, refetch: refetchTweets } = useQuery<TweetData[]>({
    queryKey: ['/api/riddleauthor/tweets'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Debug log
  console.log('🐦 Oracle Terminal - Recent Tweets:', recentTweets);

  // Test Telegram connection
  const testTelegram = async () => {
    setTestingTelegram(true);
    try {
      const response: any = await apiRequest('/api/twitter/test-telegram', {
        method: 'POST',
      });
      
      if (response?.success) {
        alert('✅ Telegram connected! Check your channel for a test message.');
      } else {
        alert('❌ Telegram test failed: ' + (response?.error || 'Unknown error'));
      }
    } catch (error: any) {
      alert('❌ Error: ' + error.message);
    } finally {
      setTestingTelegram(false);
    }
  };

  // Post test tweet
  const postTestTweet = async () => {
    setPostingTweet(true);
    try {
      const response: any = await apiRequest('/api/twitter/test-tweet', {
        method: 'POST',
        body: JSON.stringify({
          content: '🔮 Oracle Terminal Test - ' + new Date().toLocaleString() + '\n\n✅ Monitoring systems operational\n📊 Real-time tweet tracking active\n🚀 #RiddleSwap #Oracle',
          tweet_type: 'test'
        })
      });
      
      if (response?.success) {
        alert('✅ Test tweet posted successfully! Check Twitter and refresh the log.');
        // Refresh tweets after posting
        setTimeout(() => refetchTweets(), 2000);
      } else {
        alert('❌ Tweet failed: ' + (response?.error || 'Unknown error'));
      }
    } catch (error: any) {
      alert('❌ Error: ' + error.message);
    } finally {
      setPostingTweet(false);
    }
  };

  const getStatusBadge = (isGood: boolean) => {
    return isGood ? (
      <Badge className="bg-green-500 hover:bg-green-600">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Online
      </Badge>
    ) : (
      <Badge variant="destructive">
        <XCircle className="w-3 h-3 mr-1" />
        Offline
      </Badge>
    );
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const seconds = Math.floor((currentTime.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Terminal className="w-8 h-8 text-blue-500" />
          <div>
            <h2 className="text-2xl font-bold">Oracle Terminal</h2>
            <p className="text-sm text-muted-foreground">
              System Status & Process Monitoring
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">System Time</div>
          <div className="font-mono text-lg">{currentTime.toLocaleTimeString()}</div>
        </div>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Twitter Scheduler Status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Twitter className="w-4 h-4" />
                Twitter Scheduler
              </CardTitle>
              {getStatusBadge(twitterStatus?.status?.canPost || false)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Configured:</span>
                <span className="font-medium">
                  {twitterStatus?.status?.configured ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Authorized:</span>
                <span className="font-medium">
                  {twitterStatus?.status?.authorized ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Can Post:</span>
                <span className="font-medium">
                  {twitterStatus?.status?.canPost ? '✅ Yes' : '❌ No'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Telegram Integration */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Send className="w-4 h-4" />
                Telegram Bot
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={testTelegram}
                disabled={testingTelegram}
              >
                {testingTelegram ? 'Testing...' : 'Test'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bot Name:</span>
                <span className="font-medium font-mono text-xs">@TheOracleRiddleBot</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auto-Post:</span>
                <span className="font-medium">✅ Enabled</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Suggestions:</span>
                <span className="font-medium">✅ Enabled</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tweet Statistics */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Tweet Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Tweets:</span>
                <span className="font-medium">{recentTweets?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Interval:</span>
                <span className="font-medium">Every 4 hours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Projects:</span>
                <span className="font-medium">6 (Rotating)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Process Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Recent Activity Log
            </CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={postTestTweet}
                disabled={postingTweet}
              >
                <Twitter className="w-4 h-4 mr-2" />
                {postingTweet ? 'Posting...' : 'Post Test Tweet'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  refetchTwitter();
                  refetchTweets();
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
          <CardDescription>
            Live monitoring of Oracle processes and tweet automation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] w-full rounded-md border p-4">
            <div className="space-y-3 font-mono text-sm">
              {recentTweets && recentTweets.length > 0 ? (
                recentTweets.slice(0, 20).map((tweet) => (
                  <div key={tweet.id} className="border-b pb-3 last:border-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {tweet.tweet_type}
                        </Badge>
                        <Badge 
                          variant={tweet.status === 'posted_to_twitter' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {tweet.status === 'posted_to_twitter' ? '✅ Posted' : '🔄 Simulated'}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(tweet.created_at)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {tweet.content}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No recent activity</p>
                  <p className="text-xs mt-1">Tweets will appear here as they are posted</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Project Rotation Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Project Showcase Rotation
          </CardTitle>
          <CardDescription>
            Automated rotation through all 6 RiddleSwap projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { name: 'The Inquisition', status: 'MINTING NOW', emoji: '⚔️' },
              { name: 'The Inquiry', status: 'MINTING NOW', emoji: '🔍' },
              { name: 'Lost Emporium', status: 'LIVE', emoji: '🏺' },
              { name: 'Dantes Aurum', status: 'LIVE', emoji: '💰' },
              { name: 'Under The Bridge', status: 'LIVE', emoji: '🌉' },
              { name: 'RDL Token', status: 'LIVE', emoji: '🪙' },
            ].map((project) => (
              <Card key={project.name} className="bg-muted/50">
                <CardContent className="pt-4 pb-3">
                  <div className="text-center space-y-2">
                    <div className="text-2xl">{project.emoji}</div>
                    <div className="text-sm font-medium">{project.name}</div>
                    <Badge 
                      variant={project.status === 'MINTING NOW' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {project.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
