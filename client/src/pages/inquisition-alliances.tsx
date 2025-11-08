import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Users,
  Shield,
  Trophy,
  Crown,
  ArrowLeft,
  Plus,
  Check,
  X
} from "lucide-react";
import { useSession } from "@/utils/sessionManager";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BackButton } from "@/components/gaming/BackButton";

interface Alliance {
  id: string;
  name: string;
  tag: string;
  description: string;
  alliance_type: string;
  member_count: number;
  max_members: number;
  total_power: number;
  leader_handle: string;
}

const InquisitionAlliances = () => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [selectedAlliance, setSelectedAlliance] = useState<Alliance | null>(null);
  
  // Form states
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [allianceType, setAllianceType] = useState('general');

  // Fetch all alliances
  const { data: alliances = [], isLoading } = useQuery<Alliance[]>({
    queryKey: ['/api/alliances'],
    enabled: session.isLoggedIn
  });

  // Create alliance mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/alliances', {
        method: 'POST',
        body: JSON.stringify({
          name,
          tag: tag.toUpperCase(),
          description,
          alliance_type: allianceType
        })
      });
    },
    onSuccess: () => {
      toast({
        title: "Alliance Created!",
        description: `${name} has been founded successfully.`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/alliances'] });
      setCreateDialogOpen(false);
      setName('');
      setTag('');
      setDescription('');
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create alliance",
        variant: "destructive"
      });
    }
  });

  // Join alliance mutation
  const joinMutation = useMutation({
    mutationFn: async (allianceId: string) => {
      return apiRequest(`/api/alliances/${allianceId}/join`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({
        title: "Request Sent!",
        description: "Your join request has been submitted."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/alliances'] });
      setJoinDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Join Failed",
        description: error.message || "Failed to join alliance",
        variant: "destructive"
      });
    }
  });

  if (!session.isLoggedIn) {
    return (
      <div className="min-h-screen bg-blue-950 flex items-center justify-center">
        <Card className="bg-blue-900 border-blue-500 max-w-md">
          <CardContent className="text-center py-12 space-y-4">
            <Users className="w-16 h-16 text-blue-300 mx-auto" />
            <h2 className="text-2xl font-bold text-white">Login Required</h2>
            <p className="text-blue-200">You need to login to join alliances</p>
            <Link href="/login">
              <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold">
                Login Now
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-950">
      {/* Header - Bold Blue */}
      <div className="bg-blue-900 border-b-4 border-blue-500">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-2 md:gap-4">
              <BackButton to="/inquisition" label="Back to Dashboard" theme="dark" />
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                  <Shield className="w-6 h-6 md:w-8 md:h-8 text-yellow-400" />
                  Alliances
                </h1>
                <p className="text-blue-200 text-xs sm:text-sm mt-1 font-semibold">
                  Form guilds and dominate together
                </p>
              </div>
            </div>
            
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold border-2 border-purple-400 w-full md:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Alliance
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-purple-900 border-purple-500 text-white">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-white">Create Your Alliance</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-bold text-purple-200">Alliance Name</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Knights of Thunder"
                      className="bg-purple-800 border-purple-500 text-white font-semibold"
                      maxLength={50}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-purple-200">Tag (3-5 characters)</label>
                    <Input
                      value={tag}
                      onChange={(e) => setTag(e.target.value.toUpperCase())}
                      placeholder="e.g. KOT"
                      className="bg-purple-800 border-purple-500 text-white font-semibold uppercase"
                      maxLength={5}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-purple-200">Description</label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe your alliance..."
                      className="bg-purple-800 border-purple-500 text-white font-semibold"
                      maxLength={500}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-purple-200">Alliance Type</label>
                    <Select value={allianceType} onValueChange={setAllianceType}>
                      <SelectTrigger className="bg-purple-800 border-purple-500 text-white font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-purple-800 border-purple-500 text-white">
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="military">Military</SelectItem>
                        <SelectItem value="trade">Trade</SelectItem>
                        <SelectItem value="religious">Religious</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={!name || !tag || tag.length < 3 || createMutation.isPending}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold border-2 border-green-400"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Found Alliance'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Alliances List */}
        <Card className="bg-blue-900 border-blue-500 border-4 mb-8">
          <CardHeader className="bg-blue-800 border-b-4 border-blue-500">
            <CardTitle className="text-white text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-yellow-400" />
              All Alliances
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="text-white font-bold">Loading alliances...</div>
              </div>
            ) : alliances.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                <div className="text-white font-bold text-xl">No Alliances Yet</div>
                <div className="text-blue-200 font-semibold">Be the first to create one!</div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {alliances.map((alliance) => (
                  <Card key={alliance.id} className="bg-purple-900 border-purple-500 border-2">
                    <CardHeader className="bg-purple-800 border-b-2 border-purple-500">
                      <CardTitle className="text-white font-bold flex items-center justify-between gap-2">
                        <span className="truncate">{alliance.name}</span>
                        <Badge className="bg-yellow-500 text-black font-bold flex-shrink-0">[{alliance.tag}]</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="text-sm space-y-2">
                        <div className="flex justify-between gap-2">
                          <span className="text-purple-200 font-bold flex-shrink-0">Type:</span>
                          <Badge className="bg-blue-600 text-white font-bold text-xs">{alliance.alliance_type}</Badge>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-purple-200 font-bold flex-shrink-0">Members:</span>
                          <span className="text-white font-bold">{alliance.member_count}/{alliance.max_members}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-purple-200 font-bold flex-shrink-0">Power:</span>
                          <span className="text-yellow-400 font-bold text-xs sm:text-sm">{alliance.total_power.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-purple-200 font-bold flex-shrink-0">Leader:</span>
                          <span className="text-green-400 font-bold truncate text-xs sm:text-sm">@{alliance.leader_handle}</span>
                        </div>
                      </div>
                      <p className="text-purple-100 text-sm font-semibold line-clamp-2">{alliance.description}</p>
                      <Button
                        onClick={() => joinMutation.mutate(alliance.id)}
                        disabled={joinMutation.isPending}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold border-2 border-green-400"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Request to Join
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alliance Features - Bold Colors */}
        <Card className="bg-purple-900 border-purple-500 border-4">
          <CardHeader className="bg-purple-800 border-b-4 border-purple-500">
            <CardTitle className="text-white text-2xl font-bold">Alliance Features</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center space-y-2 bg-yellow-600 p-6 rounded-lg border-4 border-yellow-400">
                <Trophy className="w-12 h-12 text-white mx-auto" />
                <h3 className="font-bold text-white text-lg">Combined Rankings</h3>
                <p className="text-sm text-yellow-100 font-semibold">
                  Pool your alliance's NFT power and climb the global rankings together
                </p>
              </div>
              <div className="text-center space-y-2 bg-purple-600 p-6 rounded-lg border-4 border-purple-400">
                <Crown className="w-12 h-12 text-white mx-auto" />
                <h3 className="font-bold text-white text-lg">Leadership Roles</h3>
                <p className="text-sm text-purple-100 font-semibold">
                  Assign officers, strategists, and champions to manage your alliance
                </p>
              </div>
              <div className="text-center space-y-2 bg-blue-600 p-6 rounded-lg border-4 border-blue-400">
                <Shield className="w-12 h-12 text-white mx-auto" />
                <h3 className="font-bold text-white text-lg">Team Battles</h3>
                <p className="text-sm text-blue-100 font-semibold">
                  Participate in exclusive alliance-only battles with massive rewards
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InquisitionAlliances;
