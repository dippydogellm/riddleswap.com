/**
 * Ally Management Dashboard for "The Trolls Inquisition Multi-Chain Mayhem Edition"
 * 
 * Comprehensive ally management system including:
 * - View incoming ally requests
 * - View outgoing ally requests  
 * - Accept/decline requests
 * - Manage current alliances
 * - Send new ally requests
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Users, 
  Heart, 
  Check, 
  X, 
  Send, 
  Clock, 
  Shield, 
  Handshake,
  AlertTriangle,
  Crown,
  Scroll,
  Swords,
  UserPlus,
  Search
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AllyRequest {
  id: string;
  sender_handle: string;
  receiver_handle: string;
  request_type: string;
  status: string;
  message?: string;
  terms?: Record<string, any>;
  expires_at?: string;
  created_at: string;
}

interface Alliance {
  id: string;
  player1_handle: string;
  player2_handle: string;
  alliance_type: string;
  alliance_terms?: Record<string, any>;
  trust_level: number;
  trade_volume: number;
  military_support_count: number;
  last_interaction: string;
  established_at: string;
}

interface RiddleWalletUser {
  user_handle: string;
  player_name?: string;
  total_power_level: number;
  gaming_rank: string;
}

interface ProfileSearchResult {
  id: string;
  type: 'profile';
  title: string;
  description: string;
  url: string;
  image?: string;
  metadata?: {
    user_handle?: string;
    gaming_rank?: string;
    total_power_level?: number;
  };
}

interface AllyDashboardProps {
  userHandle: string;
  currentRound: number;
}

export default function AllyDashboard({ userHandle, currentRound }: AllyDashboardProps) {
  const [selectedTab, setSelectedTab] = useState("incoming");
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [requestTarget, setRequestTarget] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchResults, setSearchResults] = useState<ProfileSearchResult[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch incoming ally requests
  const { data: incomingRequestsData, isLoading: loadingIncoming, refetch: refetchIncoming } = useQuery({
    queryKey: ['ally-requests', 'incoming'],
    queryFn: () => apiRequest('/api/nft-gaming/ally-requests/incoming')
  });
  const incomingRequests = Array.isArray(incomingRequestsData) ? incomingRequestsData : [];

  // Fetch outgoing ally requests
  const { data: outgoingRequestsData, isLoading: loadingOutgoing, refetch: refetchOutgoing } = useQuery({
    queryKey: ['ally-requests', 'outgoing'],
    queryFn: () => apiRequest('/api/nft-gaming/ally-requests/outgoing')
  });
  const outgoingRequests = Array.isArray(outgoingRequestsData) ? outgoingRequestsData : [];

  // Fetch current alliances
  const { data: alliancesData, isLoading: loadingAlliances, refetch: refetchAlliances } = useQuery({
    queryKey: ['alliances'],
    queryFn: () => apiRequest('/api/nft-gaming/alliances')
  });
  const alliances = Array.isArray(alliancesData) ? alliancesData : [];

  // Search profiles using the unified search endpoint
  const searchProfiles = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }
    
    try {
      const response = await fetch(`/api/search/unified?q=${encodeURIComponent(query)}&type=profile&limit=10`);
      if (response.ok) {
        const data = await response.json() as any;
        const results = Array.isArray(data.results) ? data.results : [];
        setSearchResults(results);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('❌ Profile search failed:', error);
      setSearchResults([]);
    }
  };

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      searchProfiles(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Respond to ally request mutation
  const respondToRequestMutation = useMutation({
    mutationFn: ({ requestId, action }: { requestId: string; action: 'accept' | 'decline' }) =>
      apiRequest(`/api/nft-gaming/ally-request/${requestId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action }),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: (_, { action }) => {
      toast({
        title: action === 'accept' ? "🤝 Alliance Accepted!" : "❌ Request Declined",
        description: `Alliance request ${action}ed successfully.`
      });
      refetchIncoming();
      refetchAlliances();
    },
    onError: (error: any) => {
      toast({
        title: "⚠️ Error",
        description: error.message || "Failed to respond to request",
        variant: "destructive"
      });
    }
  });

  // Send ally request mutation
  const sendRequestMutation = useMutation({
    mutationFn: (data: { receiver_handle: string; message?: string }) =>
      apiRequest('/api/nft-gaming/ally-request', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      toast({
        title: "📨 Request Sent!",
        description: "Your alliance request has been sent."
      });
      setIsRequestDialogOpen(false);
      setRequestTarget("");
      setRequestMessage("");
      refetchOutgoing();
    },
    onError: (error: any) => {
      toast({
        title: "⚠️ Error",
        description: error.message || "Failed to send request",
        variant: "destructive"
      });
    }
  });

  // Break alliance mutation
  const breakAllianceMutation = useMutation({
    mutationFn: (allyHandle: string) =>
      apiRequest(`/api/nft-gaming/alliance/${allyHandle}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({
        title: "💔 Alliance Ended",
        description: "The alliance has been dissolved."
      });
      refetchAlliances();
    },
    onError: (error: any) => {
      toast({
        title: "⚠️ Error",
        description: error.message || "Failed to end alliance",
        variant: "destructive"
      });
    }
  });

  const handleRespondToRequest = (requestId: string, action: 'accept' | 'decline') => {
    respondToRequestMutation.mutate({ requestId, action });
  };

  const handleSendRequest = () => {
    if (!requestTarget.trim()) {
      toast({
        title: "⚠️ Error",
        description: "Please enter a user handle",
        variant: "destructive"
      });
      return;
    }

    sendRequestMutation.mutate({
      receiver_handle: requestTarget,
      message: requestMessage || `Greetings from ${userHandle}! Let us form an alliance in Round ${currentRound}.`
    });
  };

  const handleSelectProfile = (profile: ProfileSearchResult) => {
    const handle = profile.metadata?.user_handle || profile.title;
    setRequestTarget(handle);
    setSearchQuery(handle);
    setShowSuggestions(false);
  };

  const handleTargetInputChange = (value: string) => {
    setRequestTarget(value);
    setSearchQuery(value);
  };

  const handleBreakAlliance = (allyHandle: string) => {
    if (confirm(`Are you sure you want to end your alliance with ${allyHandle}?`)) {
      breakAllianceMutation.mutate(allyHandle);
    }
  };

  const getRequestTypeIcon = (type: string) => {
    switch (type) {
      case 'alliance': return <Handshake className="h-4 w-4" />;
      case 'trade_agreement': return <Scroll className="h-4 w-4" />;
      case 'non_aggression': return <Shield className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const getRequestTypeColor = (type: string) => {
    switch (type) {
      case 'alliance': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
      case 'trade_agreement': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
      case 'non_aggression': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100';
    }
  };

  const getAllyFromAlliance = (alliance: Alliance): string => {
    return alliance.player1_handle === userHandle ? alliance.player2_handle : alliance.player1_handle;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6" data-testid="ally-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            🤝 Alliance Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Round {currentRound} • Manage your diplomatic relations
          </p>
        </div>
        
        <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-send-ally-request">
              <UserPlus className="h-4 w-4 mr-2" />
              Send Alliance Request
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-send-ally-request">
            <DialogHeader>
              <DialogTitle>🤝 Send Alliance Request</DialogTitle>
              <DialogDescription>
                Propose an alliance with another civilization in Round {currentRound}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="relative">
                <Label htmlFor="target-handle">Target User Handle</Label>
                <div className="relative">
                  <Input
                    id="target-handle"
                    placeholder="Search for a player (e.g., hermes)..."
                    value={requestTarget}
                    onChange={(e) => handleTargetInputChange(e.target.value)}
                    onFocus={() => {
                      if (searchResults.length > 0) setShowSuggestions(true);
                    }}
                    onBlur={() => {
                      // Delay hiding suggestions to allow clicks
                      setTimeout(() => setShowSuggestions(false), 200);
                    }}
                    data-testid="input-target-handle"
                    className="pr-10"
                  />
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
                
                {/* Search Results Dropdown */}
                {showSuggestions && searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((profile) => {
                      const handle = profile.metadata?.user_handle || profile.title;
                      const powerLevel = profile.metadata?.total_power_level || 0;
                      const rank = profile.metadata?.gaming_rank || 'Unknown';
                      
                      return (
                        <button
                          key={profile.id}
                          onClick={() => handleSelectProfile(profile)}
                          className="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                          data-testid={`suggestion-${handle}`}
                        >
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {handle.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{handle}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {rank} • ⚡ {powerLevel} Power
                              </p>
                              {profile.description && (
                                <p className="text-xs text-gray-400 truncate mt-1">
                                  {profile.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                
                {/* No Results Message */}
                {showSuggestions && searchResults.length === 0 && searchQuery.length >= 2 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg p-3">
                    <div className="text-center text-gray-500 dark:text-gray-400">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No players found matching "{searchQuery}"</p>
                      <p className="text-xs mt-1">Try searching for different terms</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <Label htmlFor="request-message">Alliance Message (Optional)</Label>
                <Textarea
                  id="request-message"
                  placeholder="Greetings! Let us form an alliance..."
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  rows={3}
                  data-testid="textarea-request-message"
                />
              </div>
              
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4" />
                  <span className="font-medium">Live Search:</span>
                </div>
                <p className="mt-1">
                  Start typing to search for players across the platform. Try searching for "hermes" or any player handle.
                </p>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsRequestDialogOpen(false)}
                  data-testid="button-cancel-request"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendRequest}
                  disabled={sendRequestMutation.isPending}
                  data-testid="button-confirm-send-request"
                >
                  {sendRequestMutation.isPending ? (
                    "Sending..."
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Request
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Heart className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Alliances</p>
                <p className="text-2xl font-bold">{alliances?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Pending Incoming</p>
                <p className="text-2xl font-bold">{incomingRequests?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Send className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Pending Outgoing</p>
                <p className="text-2xl font-bold">{outgoingRequests?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Crown className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Round</p>
                <p className="text-2xl font-bold">{currentRound}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="incoming" data-testid="tab-incoming">
            Incoming Requests ({incomingRequests?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="outgoing" data-testid="tab-outgoing">
            Outgoing Requests ({outgoingRequests?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="alliances" data-testid="tab-alliances">
            Active Alliances ({alliances?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Incoming Requests Tab */}
        <TabsContent value="incoming" className="space-y-4" data-testid="content-incoming">
          {loadingIncoming ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto text-gray-400 mb-2" />
              <p>Loading incoming requests...</p>
            </div>
          ) : Array.isArray(incomingRequests) && incomingRequests.length > 0 ? (
            incomingRequests.map((request: AllyRequest) => (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback>
                          {request.sender_handle.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">{request.sender_handle}</CardTitle>
                        <CardDescription>
                          Sent {formatDate(request.created_at)}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getRequestTypeColor(request.request_type)}>
                        {getRequestTypeIcon(request.request_type)}
                        <span className="ml-1 capitalize">{request.request_type.replace('_', ' ')}</span>
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  {request.message && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg mb-4">
                      <p className="text-sm italic">"{request.message}"</p>
                    </div>
                  )}
                  
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRespondToRequest(request.id, 'decline')}
                      disabled={respondToRequestMutation.isPending}
                      data-testid={`button-decline-${request.id}`}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleRespondToRequest(request.id, 'accept')}
                      disabled={respondToRequestMutation.isPending}
                      data-testid={`button-accept-${request.id}`}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Accept Alliance
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12" data-testid="no-incoming-requests">
              <Users className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No Incoming Requests
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                When other players send you alliance requests, they'll appear here.
              </p>
            </div>
          )}
        </TabsContent>

        {/* Outgoing Requests Tab */}
        <TabsContent value="outgoing" className="space-y-4" data-testid="content-outgoing">
          {loadingOutgoing ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto text-gray-400 mb-2" />
              <p>Loading outgoing requests...</p>
            </div>
          ) : Array.isArray(outgoingRequests) && outgoingRequests.length > 0 ? (
            outgoingRequests.map((request: AllyRequest) => (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback>
                          {request.receiver_handle.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">{request.receiver_handle}</CardTitle>
                        <CardDescription>
                          Sent {formatDate(request.created_at)}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getRequestTypeColor(request.request_type)}>
                        {getRequestTypeIcon(request.request_type)}
                        <span className="ml-1 capitalize">{request.request_type.replace('_', ' ')}</span>
                      </Badge>
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  {request.message && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      <p className="text-sm italic">"{request.message}"</p>
                    </div>
                  )}
                  
                  {request.expires_at && (
                    <p className="text-xs text-gray-500 mt-2">
                      Expires: {formatDate(request.expires_at)}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12" data-testid="no-outgoing-requests">
              <Send className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No Outgoing Requests
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Alliance requests you send will appear here while pending.
              </p>
              <Button onClick={() => setIsRequestDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Send Your First Request
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Active Alliances Tab */}
        <TabsContent value="alliances" className="space-y-4" data-testid="content-alliances">
          {loadingAlliances ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto text-gray-400 mb-2" />
              <p>Loading alliances...</p>
            </div>
          ) : Array.isArray(alliances) && alliances.length > 0 ? (
            alliances.map((alliance: Alliance) => {
              const allyHandle = getAllyFromAlliance(alliance);
              return (
                <Card key={alliance.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarFallback>
                            {allyHandle.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">{allyHandle}</CardTitle>
                          <CardDescription>
                            Allied since {formatDate(alliance.established_at)}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          <Heart className="h-3 w-3 mr-1" />
                          Active Alliance
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{alliance.trust_level}</p>
                        <p className="text-xs text-gray-500">Trust Level</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{alliance.trade_volume}</p>
                        <p className="text-xs text-gray-500">Trade Volume</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-600">{alliance.military_support_count}</p>
                        <p className="text-xs text-gray-500">Military Support</p>
                      </div>
                    </div>
                    
                    <div className="flex justify-end">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleBreakAlliance(allyHandle)}
                        disabled={breakAllianceMutation.isPending}
                        data-testid={`button-break-alliance-${allyHandle}`}
                      >
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        End Alliance
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="text-center py-12" data-testid="no-alliances">
              <Handshake className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No Active Alliances
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Form alliances with other civilizations to strengthen your position in Round {currentRound}.
              </p>
              <Button onClick={() => setIsRequestDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Send Alliance Request
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
