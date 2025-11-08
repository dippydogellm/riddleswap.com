import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { 
  Twitter, 
  Heart, 
  Repeat, 
  ExternalLink,
  RefreshCw,
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Tweet {
  id: string;
  content: string;
  tweet_type?: string;
  created_at: string;
  tweet_url?: string;
  likes?: number;
  retweets?: number;
  source: 'database' | 'twitter_api';
}

interface TwitterFeedResponse {
  success: boolean;
  tweets: Tweet[];
  liveTweets: Tweet[];
  total: number;
}

export const TwitterFeed = () => {
  const { data, isLoading, refetch } = useQuery<TwitterFeedResponse>({
    queryKey: ['/api/riddleauthor/tweets/recent'],
    retry: 3,
    refetchInterval: 60000,
  });

  const allTweets = [
    ...(data?.liveTweets || []),
    ...(data?.tweets || [])
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <Card className="bg-slate-800/50 border-purple-500/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Twitter className="h-5 w-5 text-blue-400" />
            Latest Tweets from THE ORACLE
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="h-6 w-6 animate-spin text-purple-400" />
            </div>
          ) : allTweets.length > 0 ? (
            <div className="space-y-4">
              {allTweets.map((tweet) => (
                <div
                  key={tweet.id}
                  className="p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-purple-400 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
                        <Twitter className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">THE ORACLE AI</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(tweet.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    {tweet.source === 'twitter_api' && (
                      <Badge variant="outline" className="text-xs border-blue-500 text-blue-400">
                        Live
                      </Badge>
                    )}
                  </div>

                  <p className="text-slate-200 mb-3 whitespace-pre-wrap">{tweet.content}</p>

                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    {tweet.likes !== undefined && (
                      <div className="flex items-center gap-1">
                        <Heart className="h-4 w-4" />
                        <span>{tweet.likes}</span>
                      </div>
                    )}
                    {tweet.retweets !== undefined && (
                      <div className="flex items-center gap-1">
                        <Repeat className="h-4 w-4" />
                        <span>{tweet.retweets}</span>
                      </div>
                    )}
                    {tweet.tweet_url && (
                      <a
                        href={tweet.tweet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        View on Twitter <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-slate-400 py-12">
              <Twitter className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tweets yet. THE ORACLE is gathering wisdom...</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
