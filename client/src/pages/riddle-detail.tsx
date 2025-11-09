import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Heart, 
  MessageCircle, 
  Share,
  ArrowLeft,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ProfessionalHeader from "@/components/professional-header";
import UniversalFooter from "@/components/universal-footer";

interface RiddlePost {
  id: number;
  content: string;
  authorHandle: string;
  authorDisplayName: string;
  authorProfileImage: string;
  createdAt: string;
  likesCount: number;
  sharesCount: number;
  commentsCount: number;
  imageUrls?: string[];
}

export default function RiddleDetailPage() {
  const [, params] = useRoute<{ id: string }>("/riddle/:id");
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const riddleId = params?.id || '';

  // Fetch individual riddle/post
  const { data: riddle, isLoading } = useQuery<RiddlePost>({
    queryKey: [`/api/posts/${riddleId}`],
    enabled: !!riddleId,
  });

  // Set page metadata for sharing
  useEffect(() => {
    if (riddle) {
      document.title = `${riddle.authorDisplayName}: "${riddle.content.substring(0, 100)}..." | RiddleSwap`;
    }
  }, [riddle]);

  const shareUrl = window.location.href;
  
  const shareOnTwitter = () => {
    if (!riddle) return;
    
    const text = `Check out this riddle from ${riddle.authorDisplayName}!\n\n"${riddle.content.substring(0, 200)}${riddle.content.length > 200 ? '...' : ''}"\n\n`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'width=550,height=420');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({
      title: "Link copied!",
      description: "Share this riddle with your friends",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900">
        <ProfessionalHeader />
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-2xl mx-auto">
            <Card className="bg-white/10 backdrop-blur-md border-blue-500/30">
              <CardContent className="p-8">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-blue-500/20 rounded w-3/4"></div>
                  <div className="h-4 bg-blue-500/20 rounded w-full"></div>
                  <div className="h-4 bg-blue-500/20 rounded w-5/6"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        <UniversalFooter />
      </div>
    );
  }

  if (!riddle) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900">
        <ProfessionalHeader />
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl font-bold text-white mb-4">Riddle Not Found</h1>
            <p className="text-blue-200 mb-6">This riddle might have been removed or doesn't exist.</p>
            <Link href="/newsfeed">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Newsfeed
              </Button>
            </Link>
          </div>
        </div>
        <UniversalFooter />
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900">
      <ProfessionalHeader />
      
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <div className="max-w-2xl mx-auto mb-4">
          <Link href="/newsfeed">
            <Button variant="ghost" className="text-blue-300 hover:text-blue-100 hover:bg-blue-900/30">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Newsfeed
            </Button>
          </Link>
        </div>

        {/* Main Riddle Card */}
        <div className="max-w-2xl mx-auto">
          <Card className="bg-white/10 backdrop-blur-md border-blue-500/30 shadow-2xl">
            <CardHeader className="border-b border-blue-500/20">
              <div className="flex items-start gap-3">
                {riddle.authorProfileImage && (
                  <Link href={`/social-profile/${riddle.authorHandle}`}>
                    <Avatar className="h-12 w-12 border-2 border-blue-500/50 cursor-pointer hover:border-blue-400 transition-all">
                      <AvatarImage src={riddle.authorProfileImage} alt={riddle.authorDisplayName} />
                    </Avatar>
                  </Link>
                )}
                <div className="flex-1">
                  <Link href={`/social-profile/${riddle.authorHandle}`}>
                    <h3 className="font-bold text-white hover:text-blue-300 cursor-pointer transition-colors">
                      {riddle.authorDisplayName}
                    </h3>
                  </Link>
                  <p className="text-sm text-blue-300">@{riddle.authorHandle}</p>
                  <p className="text-xs text-blue-400 mt-1">{formatDate(riddle.createdAt)}</p>
                </div>
                <Badge variant="outline" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
                  Riddle #{riddle.id}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {/* Content */}
              <div className="mb-6">
                <p className="text-white text-lg leading-relaxed whitespace-pre-wrap">
                  {riddle.content}
                </p>
              </div>

              {/* Images */}
              {riddle.imageUrls && riddle.imageUrls.length > 0 && (
                <div className="mb-6 grid grid-cols-2 gap-2">
                  {riddle.imageUrls.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Riddle image ${idx + 1}`}
                      className="rounded-lg w-full object-cover border border-blue-500/30"
                    />
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center gap-6 py-4 border-y border-blue-500/20">
                <div className="flex items-center gap-2 text-blue-300">
                  <Heart className="h-5 w-5" />
                  <span className="font-semibold">{riddle.likesCount}</span>
                  <span className="text-sm">Likes</span>
                </div>
                <div className="flex items-center gap-2 text-blue-300">
                  <MessageCircle className="h-5 w-5" />
                  <span className="font-semibold">{riddle.commentsCount}</span>
                  <span className="text-sm">Comments</span>
                </div>
                <div className="flex items-center gap-2 text-blue-300">
                  <Share className="h-5 w-5" />
                  <span className="font-semibold">{riddle.sharesCount}</span>
                  <span className="text-sm">Shares</span>
                </div>
              </div>

              {/* Share Actions */}
              <div className="flex gap-3 mt-6">
                <Button 
                  onClick={shareOnTwitter}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Share on X/Twitter
                </Button>
                <Button 
                  onClick={copyLink}
                  variant="outline"
                  className="flex-1 border-blue-500/50 text-blue-300 hover:bg-blue-900/30 hover:text-blue-100"
                >
                  <Share className="h-4 w-4 mr-2" />
                  {copied ? "Link Copied!" : "Copy Link"}
                </Button>
              </div>

              {/* View on Newsfeed */}
              <div className="mt-6 text-center">
                <Link href="/newsfeed">
                  <Button variant="ghost" className="text-blue-300 hover:text-blue-100 hover:bg-blue-900/30">
                    View all riddles on Newsfeed →
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <UniversalFooter />
    </div>
  );
}
