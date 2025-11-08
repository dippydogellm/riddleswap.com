import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Users, 
  UserPlus, 
  MessageCircle, 
  Shield, 
  Heart, 
  Check, 
  X, 
  Crown,
  Handshake,
  AlertTriangle,
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AllianceRequest {
  id: string;
  sender_handle: string;
  receiver_handle: string;
  message?: string;
  request_type: 'alliance' | 'trade_agreement' | 'non_aggression';
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  expires_at: string;
}

interface Alliance {
  id: string;
  player1_handle: string;
  player2_handle: string;
  alliance_type: string;
  formed_at: string;
  status: 'active' | 'ended';
}

interface RiddleWalletUser {
  user_handle: string;
  player_name?: string;
  total_power_level: number;
  gaming_rank: string;
}

export const AllianceHub = () => {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [allianceMessage, setAllianceMessage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch alliance requests
  const { data: incomingRequests = [], isLoading: loadingIncoming } = useQuery<AllianceRequest[]>({
    queryKey: ['/api/nft-gaming/ally-requests/incoming']
  });

  const { data: outgoingRequests = [], isLoading: loadingOutgoing } = useQuery<AllianceRequest[]>({
    queryKey: ['/api/nft-gaming/ally-requests/outgoing']
  });

  // Fetch current alliances
  const { data: alliances = [], isLoading: loadingAlliances } = useQuery<Alliance[]>({
    queryKey: ['/api/nft-gaming/alliances']
  });

  // Fetch available players
  const { data: riddleWalletUsers = [], isLoading: loadingUsers } = useQuery<RiddleWalletUser[]>({
    queryKey: ['/api/nft-gaming/riddle-wallet-users']
  });

  // Send alliance request mutation
  const sendAllianceMutation = useMutation({
    mutationFn: (data: { receiver_handle: string; message?: string }) =>
      apiRequest('/api/nft-gaming/ally-request', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      toast({
        title: "🤝 Alliance Request Sent!",
        description: "Your alliance proposal has been sent."
      });
      setSelectedUser("");
      setAllianceMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/nft-gaming/ally-requests/outgoing'] });
    },
    onError: (error: any) => {
      toast({
        title: "⚠️ Error",
        description: error.message || "Failed to send alliance request",
        variant: "destructive"
      });
    }
  });

  // Respond to alliance request mutation
  const respondToAllianceMutation = useMutation({
    mutationFn: ({ requestId, action }: { requestId: string; action: 'accept' | 'decline' }) =>
      apiRequest(`/api/nft-gaming/ally-request/${requestId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action }),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: (_, { action }) => {
      toast({
        title: action === 'accept' ? "🤝 Alliance Formed!" : "❌ Request Declined",
        description: action === 'accept' ? "Welcome your new ally to the realm!" : "The alliance request has been declined."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/nft-gaming/ally-requests/incoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nft-gaming/alliances'] });
    },
    onError: (error: any) => {
      toast({
        title: "⚠️ Error",
        description: error.message || "Failed to respond to alliance request",
        variant: "destructive"
      });
    }
  });

  // Break alliance mutation
  const breakAllianceMutation = useMutation({
    mutationFn: (allyHandle: string) =>
      apiRequest(`/api/nft-gaming/alliance/${allyHandle}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      toast({
        title: "💔 Alliance Ended",
        description: "The diplomatic bond has been severed."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/nft-gaming/alliances'] });
    },
    onError: (error: any) => {
      toast({
        title: "⚠️ Error",
        description: error.message || "Failed to end alliance",
        variant: "destructive"
      });
    }
  });

  const sendAllianceRequest = () => {
    if (!selectedUser) {
      toast({
        title: "⚠️ Select a Player",
        description: "Please select a player to send an alliance request to.",
        variant: "destructive"
      });
      return;
    }

    sendAllianceMutation.mutate({
      receiver_handle: selectedUser,
      message: allianceMessage || undefined
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Recently';
  };

  return (
    <Card className="gaming-component-card border-blue-500/30">
      <CardHeader>
        <CardTitle className="text-blue-300 font-mono flex items-center gap-2">
          <Users className="h-5 w-5" />
          ALLIANCE COMMAND
        </CardTitle>
        <CardDescription className="text-slate-400">
          Form alliances, coordinate strategies, and manage diplomatic relations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="manage" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="manage" data-testid="tab-manage-alliances">
              <Shield className="h-4 w-4 mr-1" />
              Alliances
            </TabsTrigger>
            <TabsTrigger value="incoming" data-testid="tab-incoming-requests">
              <MessageCircle className="h-4 w-4 mr-1" />
              Incoming ({incomingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="outgoing" data-testid="tab-outgoing-requests">
              <Clock className="h-4 w-4 mr-1" />
              Sent ({outgoingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="request" data-testid="tab-request-alliance">
              <UserPlus className="h-4 w-4 mr-1" />
              New
            </TabsTrigger>
          </TabsList>

          {/* Current Alliances */}
          <TabsContent value="manage" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-blue-300">Active Alliances</h3>
              <Badge variant="outline" className="text-blue-400 border-blue-400">
                {alliances.length} Active
              </Badge>
            </div>

            {loadingAlliances ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="animate-pulse bg-slate-700 h-16 rounded"></div>
                ))}
              </div>
            ) : alliances.length > 0 ? (
              <div className="space-y-3">
                {alliances.map((alliance) => {
                  const allyHandle = alliance.player1_handle !== alliance.player2_handle ? 
                    (alliance.player1_handle === riddleWalletUsers.find(u => u.user_handle === alliance.player1_handle)?.user_handle ? 
                      alliance.player2_handle : alliance.player1_handle) : alliance.player2_handle;
                  
                  const allyUser = riddleWalletUsers.find(u => u.user_handle === allyHandle);
                  
                  return (
                    <Card key={alliance.id} className="bg-slate-800/50 border-blue-500/30">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-blue-600 text-white">
                                {allyHandle.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-semibold text-white">{allyHandle}</div>
                              {allyUser && (
                                <div className="text-sm text-slate-400">
                                  {allyUser.gaming_rank} • ⚡ {allyUser.total_power_level} Power
                                </div>
                              )}
                              <div className="text-xs text-slate-500">
                                Allied {formatTimeAgo(alliance.formed_at)}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                              <Handshake className="h-3 w-3 mr-1" />
                              Allied
                            </Badge>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => breakAllianceMutation.mutate(allyHandle)}
                              disabled={breakAllianceMutation.isPending}
                              data-testid={`button-break-alliance-${allyHandle}`}
                            >
                              <AlertTriangle className="h-4 w-4 mr-1" />
                              End Alliance
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No active alliances</p>
                <p className="text-sm">Send alliance requests to form diplomatic bonds</p>
              </div>
            )}
          </TabsContent>

          {/* Incoming Requests */}
          <TabsContent value="incoming" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-green-300">Incoming Requests</h3>
              <Badge variant="outline" className="text-green-400 border-green-400">
                {incomingRequests.filter(r => r.status === 'pending').length} Pending
              </Badge>
            </div>

            {loadingIncoming ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="animate-pulse bg-slate-700 h-20 rounded"></div>
                ))}
              </div>
            ) : incomingRequests.length > 0 ? (
              <div className="space-y-3">
                {incomingRequests.map((request) => (
                  <Card key={request.id} className="bg-slate-800/50 border-green-500/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-green-600 text-white">
                              {request.sender_handle.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold text-white">{request.sender_handle}</div>
                            <div className="text-sm text-slate-400">
                              Requests {request.request_type}
                            </div>
                            {request.message && (
                              <div className="text-sm text-slate-300 italic mt-1">
                                "{request.message}"
                              </div>
                            )}
                            <div className="text-xs text-slate-500">
                              {formatTimeAgo(request.created_at)}
                            </div>
                          </div>
                        </div>
                        
                        {request.status === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => respondToAllianceMutation.mutate({ 
                                requestId: request.id, 
                                action: 'accept' 
                              })}
                              disabled={respondToAllianceMutation.isPending}
                              data-testid={`button-accept-${request.id}`}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => respondToAllianceMutation.mutate({ 
                                requestId: request.id, 
                                action: 'decline' 
                              })}
                              disabled={respondToAllianceMutation.isPending}
                              data-testid={`button-decline-${request.id}`}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Decline
                            </Button>
                          </div>
                        ) : (
                          <Badge className={
                            request.status === 'accepted' 
                              ? "bg-green-500/20 text-green-400 border-green-500/30"
                              : "bg-red-500/20 text-red-400 border-red-500/30"
                          }>
                            {request.status === 'accepted' ? 'Accepted' : 'Declined'}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No incoming alliance requests</p>
                <p className="text-sm">Other players can send you alliance proposals</p>
              </div>
            )}
          </TabsContent>

          {/* Outgoing Requests */}
          <TabsContent value="outgoing" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-yellow-300">Sent Requests</h3>
              <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                {outgoingRequests.filter(r => r.status === 'pending').length} Pending
              </Badge>
            </div>

            {loadingOutgoing ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="animate-pulse bg-slate-700 h-16 rounded"></div>
                ))}
              </div>
            ) : outgoingRequests.length > 0 ? (
              <div className="space-y-3">
                {outgoingRequests.map((request) => (
                  <Card key={request.id} className="bg-slate-800/50 border-yellow-500/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-yellow-600 text-white">
                              {request.receiver_handle.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold text-white">{request.receiver_handle}</div>
                            <div className="text-sm text-slate-400">
                              {request.request_type} request
                            </div>
                            {request.message && (
                              <div className="text-sm text-slate-300 italic mt-1">
                                "{request.message}"
                              </div>
                            )}
                            <div className="text-xs text-slate-500">
                              Sent {formatTimeAgo(request.created_at)}
                            </div>
                          </div>
                        </div>
                        
                        <Badge className={
                          request.status === 'pending' 
                            ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                            : request.status === 'accepted'
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : "bg-red-500/20 text-red-400 border-red-500/30"
                        }>
                          {request.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                          {request.status === 'accepted' && <Check className="h-3 w-3 mr-1" />}
                          {request.status === 'declined' && <X className="h-3 w-3 mr-1" />}
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No sent alliance requests</p>
                <p className="text-sm">Use the "New" tab to send alliance requests</p>
              </div>
            )}
          </TabsContent>

          {/* Request New Alliance */}
          <TabsContent value="request" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-3">Request New Alliance</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Form diplomatic bonds with other commanders in the realm
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-300 mb-2 block">
                    Select Player
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {loadingUsers ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="animate-pulse bg-slate-700 h-12 rounded"></div>
                        ))}
                      </div>
                    ) : (
                      riddleWalletUsers
                        .filter(user => 
                          !alliances.some(alliance => 
                            alliance.player1_handle === user.user_handle || 
                            alliance.player2_handle === user.user_handle
                          ) &&
                          !outgoingRequests.some(req => 
                            req.receiver_handle === user.user_handle && req.status === 'pending'
                          )
                        )
                        .map((user) => (
                          <Card 
                            key={user.user_handle}
                            className={`cursor-pointer transition-all ${
                              selectedUser === user.user_handle 
                                ? 'bg-purple-600/20 border-purple-500' 
                                : 'bg-slate-800/50 border-slate-600 hover:border-purple-500/50'
                            }`}
                            onClick={() => setSelectedUser(user.user_handle)}
                            data-testid={`player-select-${user.user_handle}`}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-purple-600 text-white text-xs">
                                    {user.user_handle.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <div className="font-medium text-white text-sm">{user.user_handle}</div>
                                  <div className="text-xs text-slate-400">
                                    {user.gaming_rank} • ⚡ {user.total_power_level} Power
                                  </div>
                                </div>
                                {selectedUser === user.user_handle && (
                                  <Crown className="h-4 w-4 text-purple-400" />
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-300 mb-2 block">
                    Alliance Message (Optional)
                  </label>
                  <Textarea
                    placeholder="Greetings! Let us form an alliance for mutual benefit..."
                    value={allianceMessage}
                    onChange={(e) => setAllianceMessage(e.target.value)}
                    className="bg-slate-800/50 border-slate-600 text-slate-200"
                    rows={3}
                    data-testid="input-alliance-message"
                  />
                </div>

                <Button
                  onClick={sendAllianceRequest}
                  disabled={!selectedUser || sendAllianceMutation.isPending}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  data-testid="button-send-alliance-request"
                >
                  {sendAllianceMutation.isPending ? (
                    "Sending Request..."
                  ) : (
                    <>
                      <Heart className="h-4 w-4 mr-2" />
                      Send Alliance Request
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
