import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/utils/sessionManager";
import BattleCreateDialog from "@/components/battle-create-dialog";
import SquadronCreateDialog from "@/components/squadron-create-dialog";

interface PowerBreakdown {
  army_power: number;
  religion_power: number;
  civilization_power: number;
  economic_power: number;
  total_power: number;
}

interface Squadron {
  id: string;
  name: string;
  squadron_type: string;
  total_power: number;
  total_army_power: number;
  total_religion_power: number;
  total_civilization_power: number;
  total_economic_power: number;
  nft_count: number;
  is_active: boolean;
  in_battle: boolean;
}

interface Battle {
  id: string;
  battle_type: string;
  combat_type: string;
  wager_amount: string;
  is_friendly: boolean;
  creator_player_id: string;
  status: string;
  created_at: string;
}

interface Tournament {
  id: string;
  name: string;
  tournament_type: string;
  combat_type: string;
  entry_fee: string;
  total_prize_pool: string;
  max_participants: number;
  registered_count: number;
  status: string;
  starts_at: string;
}

export default function BattleDashboard() {
  const { isLoggedIn, handle } = useSession();
  const { toast } = useToast();
  const [power, setPower] = useState<PowerBreakdown | null>(null);
  const [squadrons, setSquadrons] = useState<Squadron[]>([]);
  const [openBattles, setOpenBattles] = useState<Battle[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningBattle, setJoiningBattle] = useState<string | null>(null);

  const icons = {
    army: '⚔️',
    religion: '⛪',
    civilization: '🏰',
    economic: '💰'
  };

  useEffect(() => {
    if (handle) {
      loadPlayerData();
    }
  }, [handle]);

  async function loadPlayerData() {
    try {
      setLoading(true);

      // Get auth token
      const token = sessionStorage.getItem('sessionToken');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Fetch player power
      const powerRes = await fetch(`/api/nft-power/player/${handle}`, { headers });
      if (powerRes.ok) {
        const powerData = await powerRes.json();
        setPower(powerData.power);
      }

      // Fetch squadrons
      const squadronsRes = await fetch(`/api/squadrons/${handle}`, { headers });
      if (squadronsRes.ok) {
        const squadronsData = await squadronsRes.json();
        setSquadrons(squadronsData.squadrons || []);
      }

      // Fetch open battles
      const battlesRes = await fetch('/api/battles/open', { headers });
      if (battlesRes.ok) {
        const battlesData = await battlesRes.json();
        setOpenBattles(battlesData.battles || []);
      }

      // Fetch upcoming tournaments
      const tournamentsRes = await fetch('/api/tournaments/upcoming', { headers });
      if (tournamentsRes.ok) {
        const tournamentsData = await tournamentsRes.json();
        setTournaments(tournamentsData.tournaments || []);
      }
    } catch (error) {
      console.error('Error loading battle data:', error);
      toast({
        title: "Error",
        description: "Failed to load battle data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  async function scanNFTPower() {
    try {
      const token = sessionStorage.getItem('sessionToken');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/nft-power/scan/${handle}`, {
        method: 'POST',
        headers
      });

      if (!res.ok) throw new Error('Failed to scan NFT power');

      const data = await res.json() as any;
      setPower(data.power);

      toast({
        title: "Success",
        description: `Scanned ${data.power.nfts_scanned} NFTs. Total Power: ${data.power.total_power}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to scan NFT power",
        variant: "destructive"
      });
    }
  }

  async function joinBattle(battleId: string, squadronId: string) {
    try {
      setJoiningBattle(battleId);

      const token = sessionStorage.getItem('sessionToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/battles/${battleId}/join`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          opponent_squadron_id: squadronId
        })
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error || 'Failed to join battle');
      }

      const data = await response.json() as any;

      toast({
        title: "Battle Joined!",
        description: `You've entered the battle! Battle ID: ${battleId.substring(0, 8)}...`
      });

      loadPlayerData(); // Refresh data
    } catch (error: any) {
      console.error('Error joining battle:', error);
      toast({
        title: "Join Failed",
        description: error.message || "Failed to join battle",
        variant: "destructive"
      });
    } finally {
      setJoiningBattle(null);
    }
  }

  if (!isLoggedIn || !handle) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8">
          <h2 className="text-2xl font-bold mb-4">Login Required</h2>
          <p className="text-gray-600">Please log in to access the battle system</p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading battle data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">⚔️ Battle Dashboard</h1>

        {/* Power Level Display */}
        <Card className="mb-6 p-6 bg-slate-900 border-2 border-purple-600">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white">Your Power Level</h2>
            <Button onClick={scanNFTPower} variant="outline" className="bg-purple-600 border-2 border-purple-400 text-white hover:bg-purple-700">
              Scan NFTs
            </Button>
          </div>
          
          {power ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-red-900 rounded-lg border-2 border-red-600">
                <div className="text-3xl mb-2">{icons.army}</div>
                <div className="text-sm text-gray-300">Army Power</div>
                <div className="text-2xl font-bold text-red-400">{power.army_power}</div>
              </div>
              
              <div className="text-center p-4 bg-blue-900 rounded-lg border-2 border-blue-600">
                <div className="text-3xl mb-2">{icons.religion}</div>
                <div className="text-sm text-gray-300">Religion Power</div>
                <div className="text-2xl font-bold text-blue-400">{power.religion_power}</div>
              </div>
              
              <div className="text-center p-4 bg-purple-900 rounded-lg border-2 border-purple-600">
                <div className="text-3xl mb-2">{icons.civilization}</div>
                <div className="text-sm text-gray-300">Civilization Power</div>
                <div className="text-2xl font-bold text-purple-400">{power.civilization_power}</div>
              </div>
              
              <div className="text-center p-4 bg-yellow-900 rounded-lg border-2 border-yellow-600">
                <div className="text-3xl mb-2">{icons.economic}</div>
                <div className="text-sm text-gray-300">Economic Power</div>
                <div className="text-2xl font-bold text-yellow-400">{power.economic_power}</div>
              </div>
              
              <div className="text-center p-4 bg-green-900 rounded-lg border-2 border-green-600">
                <div className="text-3xl mb-2">💪</div>
                <div className="text-sm text-gray-300">Total Power</div>
                <div className="text-2xl font-bold text-green-400">{power.total_power}</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              Click "Scan NFTs" to calculate your power level
            </div>
          )}
        </Card>

        {/* Main Tabs */}
        <Tabs defaultValue="squadrons" className="space-y-6">
          <TabsList className="bg-slate-800 border-2 border-purple-600">
            <TabsTrigger value="squadrons" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              Squadrons ({squadrons.length})
            </TabsTrigger>
            <TabsTrigger value="battles" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              Open Battles ({openBattles.length})
            </TabsTrigger>
            <TabsTrigger value="tournaments" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              Tournaments ({tournaments.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              Battle History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="squadrons" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Your Squadrons</h2>
              <div className="flex gap-2">
                <BattleCreateDialog 
                  squadrons={squadrons} 
                  onBattleCreated={loadPlayerData}
                  userWalletAddress={handle}
                />
                <SquadronCreateDialog onSquadronCreated={loadPlayerData} />
              </div>
            </div>

            {squadrons.length === 0 ? (
              <Card className="p-8 bg-slate-900 border-2 border-purple-600">
                <div className="text-center text-gray-400">
                  You don't have any squadrons yet. Create one to start battling!
                </div>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {squadrons.map((squadron) => (
                  <Card key={squadron.id} className="p-6 bg-slate-900 border-2 border-purple-600">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white">{squadron.name}</h3>
                        <Badge variant="outline" className="mt-1">
                          {squadron.squadron_type}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-purple-400">{squadron.total_power}</div>
                        <div className="text-sm text-gray-400">Total Power</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                      <div className="text-center">
                        <div className="text-xs md:text-sm text-gray-400">{icons.army}</div>
                        <div className="font-bold text-sm md:text-base text-red-400">{squadron.total_army_power}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs md:text-sm text-gray-400">{icons.religion}</div>
                        <div className="font-bold text-sm md:text-base text-blue-400">{squadron.total_religion_power}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs md:text-sm text-gray-400">{icons.civilization}</div>
                        <div className="font-bold text-sm md:text-base text-purple-400">{squadron.total_civilization_power}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs md:text-sm text-gray-400">{icons.economic}</div>
                        <div className="font-bold text-sm md:text-base text-yellow-400">{squadron.total_economic_power}</div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">{squadron.nft_count} NFTs</span>
                      <div className="space-x-2">
                        <Button size="sm" variant="outline" className="bg-slate-700 border-2 border-slate-500">
                          Manage
                        </Button>
                        {!squadron.in_battle && (
                          <BattleCreateDialog 
                            squadrons={[squadron]} 
                            onBattleCreated={loadPlayerData}
                            userWalletAddress={handle}
                            battleType="1v1"
                          />
                        )}
                        {squadron.in_battle && (
                          <Button size="sm" className="bg-gray-600 border-2 border-gray-400" disabled>
                            In Battle
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="battles" className="space-y-4">
            <h2 className="text-2xl font-bold text-white">Open Battles</h2>
            
            {openBattles.length === 0 ? (
              <Card className="p-8 bg-slate-900 border-2 border-slate-600">
                <div className="text-center text-gray-400">
                  No open battles available. Create one or wait for others!
                </div>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {openBattles.map((battle: any) => {
                  const availableSquadrons = squadrons.filter(s => !s.in_battle);
                  const isOwnBattle = battle.creator_player_id === handle;
                  
                  return (
                    <Card key={battle.id} className="p-6 bg-slate-900 border-2 border-red-600">
                      {/* Battle Map Visualization */}
                      {battle.battle_map_image_url && (
                        <div className="relative w-full h-40 mb-4 rounded-lg overflow-hidden border-2 border-red-400">
                          <img 
                            src={battle.battle_map_image_url} 
                            alt={`${battle.land_type} battle map`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                            <p className="text-white text-xs font-semibold capitalize">📍 {battle.land_type} Terrain</p>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-white capitalize">{battle.combat_type} Battle</h3>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline">{battle.battle_type}</Badge>
                            {battle.land_type && !battle.battle_map_image_url && (
                              <Badge variant="secondary" className="capitalize">{battle.land_type}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {battle.is_friendly ? (
                            <Badge variant="secondary">Friendly</Badge>
                          ) : (
                            <div>
                              <div className="text-lg font-bold text-yellow-400">{battle.wager_amount} XRP</div>
                              <div className="text-xs text-gray-400">Wager</div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 mb-4 text-sm">
                        <div>
                          <span className="text-gray-400">Leader: </span>
                          <span className="text-purple-400">{battle.creator_player_id}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Battle ID: </span>
                          <span className="text-blue-400 font-mono">{battle.id.substring(0, 12)}...</span>
                        </div>
                        {battle.response_timeout_minutes && (
                          <div>
                            <span className="text-gray-400">⏱️ Response Time: </span>
                            <span className="text-yellow-400">{battle.response_timeout_minutes} min</span>
                          </div>
                        )}
                      </div>

                      {isOwnBattle ? (
                        <Badge className="w-full justify-center py-2" variant="outline">
                          Your Battle - Waiting for Opponent
                        </Badge>
                      ) : availableSquadrons.length > 0 ? (
                        <div className="space-y-2">
                          <select 
                            className="w-full p-2 rounded bg-slate-800 border-2 border-slate-600 text-white"
                            onChange={(e) => {
                              if (e.target.value) {
                                joinBattle(battle.id, e.target.value);
                              }
                            }}
                            disabled={joiningBattle === battle.id}
                          >
                            <option value="">Select Squadron to Join...</option>
                            {availableSquadrons.map(squad => (
                              <option key={squad.id} value={squad.id}>
                                {squad.name} ({squad.total_power} power)
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <Badge variant="outline" className="w-full justify-center py-2">
                          No Available Squadrons
                        </Badge>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tournaments" className="space-y-4">
            <h2 className="text-2xl font-bold text-white">Upcoming Tournaments</h2>
            
            {tournaments.length === 0 ? (
              <Card className="p-8 bg-slate-900 border-2 border-purple-600">
                <div className="text-center text-gray-400">
                  No upcoming tournaments. Check back later!
                </div>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {tournaments.map((tournament) => (
                  <Card key={tournament.id} className="p-6 bg-slate-900 border-2 border-purple-600">
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-white">{tournament.name}</h3>
                      <Badge variant="outline" className="mt-1">
                        {tournament.tournament_type}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="text-sm text-gray-400">Entry Fee</div>
                        <div className="text-lg font-bold text-yellow-400">{tournament.entry_fee} XRP</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Prize Pool</div>
                        <div className="text-lg font-bold text-green-400">{tournament.total_prize_pool} XRP</div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="text-sm text-gray-400 mb-1">
                        {tournament.registered_count}/{tournament.max_participants} Registered
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div 
                          className="bg-purple-500 h-2 rounded-full" 
                          style={{ width: `${(tournament.registered_count / tournament.max_participants) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">
                        Starts: {new Date(tournament.starts_at).toLocaleDateString()}
                      </span>
                      <Button size="sm" className="bg-purple-600 border-2 border-purple-400 hover:bg-purple-700">
                        Register
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card className="p-8 bg-slate-900 border-2 border-slate-600">
              <div className="text-center text-gray-400">
                Battle history will be displayed here
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
