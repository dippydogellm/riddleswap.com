import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Scroll, Swords, Shield, Crown, Star, Sparkles, Zap, User, Heart, Target, Book, Flame, Eye, Crosshair } from "lucide-react";

// Helper functions for NFT display
const getRoleIcon = (role: string) => {
  const playerType = role?.split(' ')[1] || role; // Extract player type from 'material playertype'
  switch (playerType?.toLowerCase()) {
    case 'priest': return <Heart className="h-3 w-3" />;
    case 'knight': return <Crown className="h-3 w-3" />;
    case 'commander': return <Star className="h-3 w-3" />;
    case 'mage': case 'wizard': return <Sparkles className="h-3 w-3" />;
    case 'archer': case 'ranger': return <Target className="h-3 w-3" />;
    case 'rogue': return <Eye className="h-3 w-3" />;
    default: return <Swords className="h-3 w-3" />; // warrior
  }
};

const getAbilityIcon = (ability: string) => {
  if (ability.includes('heal') || ability.includes('religion')) return '💚';
  if (ability.includes('division_boost') || ability.includes('knight')) return '🛡️';
  if (ability.includes('leadership') || ability.includes('command')) return '👑';
  if (ability.includes('magic') || ability.includes('spell')) return '✨';
  if (ability.includes('dragon')) return '🐉';
  if (ability.includes('legendary')) return '⭐';
  if (ability.includes('stealth') || ability.includes('rogue')) return '👤';
  if (ability.includes('fire') || ability.includes('flame')) return '🔥';
  if (ability.includes('undead')) return '💀';
  if (ability.includes('holy') || ability.includes('divine')) return '☀️';
  if (ability.includes('cursed') || ability.includes('dark')) return '🌙';
  if (ability.includes('precision') || ability.includes('archer')) return '🎯';
  return '⚔️';
};

const formatAbilityName = (ability: string) => {
  return ability.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getAbilityDescription = (ability: string) => {
  const descriptions: Record<string, string> = {
    // Priest abilities - Religion Control
    'healing': 'Can heal allied units and restore health',
    'religion_control': 'Controls religious aspects and divine favor',
    'blessings': 'Provides divine protection and buffs to allies',
    'divine_intervention': 'Can call upon divine powers in critical moments',
    'mass_heal': 'Heals multiple units simultaneously',
    'turn_undead': 'Can control or banish undead creatures',
    'sanctuary': 'Creates protective sacred zones',
    
    // Knight abilities - Division Boosts
    'division_boost': 'Provides powerful boosts to entire military divisions',
    'heavy_armor': 'Enhanced protection from physical attacks',
    'cavalry_charge': 'Devastating mounted combat attacks',
    'inspire_troops': 'Boosts morale and combat effectiveness of nearby units',
    'defensive_formation': 'Organizes superior defensive strategies',
    'noble_leadership': 'Commands respect and loyalty from all ranks',
    'battle_cry': 'Rallies allies and intimidates enemies',
    
    // Enhanced abilities
    'leadership': 'Boosts morale and effectiveness of nearby units',
    'battle_tactics': 'Improves strategic positioning and battle outcomes',
    'strategic_planning': 'Long-term tactical advantages and foresight',
    'morale_boost': 'Prevents fear and improves unit courage',
    'magic_attack': 'Can cast offensive spells dealing magical damage',
    'elemental_power': 'Controls elemental forces (fire, ice, lightning)',
    'mana_regeneration': 'Faster recovery of magical energy',
    'spell_mastery': 'Advanced knowledge of magical arts',
    'ranged_attack': 'Effective at long-distance combat',
    'precision_strike': 'Higher accuracy and critical hit chance',
    'multi_shot': 'Can attack multiple targets simultaneously',
    'eagle_eye': 'Enhanced vision and targeting abilities',
    'stealth': 'Can move undetected and perform surprise attacks',
    'backstab': 'Devastating attacks from behind enemy lines',
    'shadow_step': 'Can teleport through shadows',
    'critical_strike': 'Increased chance for devastating attacks',
    'melee_combat': 'Excellent at close-quarters fighting',
    'shield_mastery': 'Enhanced defensive capabilities and blocking',
    'endurance': 'Higher stamina and resistance to fatigue',
    'weapon_expertise': 'Master of various weapon types',
    'legendary_power': 'Unique legendary abilities and enhanced stats',
    'magical_enhancement': 'All abilities enhanced by magical power',
    'dragon_affinity': 'Special connection with dragons and draconic power',
    'aura_of_legend': 'Inspiring presence that affects all nearby allies',
    
    // Material enhancements
    'blessing_aura': 'Holy materials provide divine protection',
    'fear_aura': 'Cursed materials instill terror in enemies',
    'fire_resistance': 'Dragon scale provides immunity to fire damage',
    'magic_resistance': 'Mythril provides protection against magical attacks',
    'unbreakable': 'Adamant equipment never breaks or dulls',
    'undead_damage': 'Silver materials deal extra damage to undead'
  };
  
  return descriptions[ability] || 'Special combat ability';
};

interface NFTDetails {
  id: string;
  name: string;
  traits: Record<string, any>;
  game_stats: {
    base_power: number;
    role: string;
    special_abilities: Record<string, boolean>;
    combat_effectiveness: number;
    leadership_value: number;
    magical_power: number;
  };
  image_url?: string;
  rarity_score: string;
}

interface CollectionData {
  collection: {
    collection_name: string;
    game_role: string;
    power_level: number;
  };
  nfts: NFTDetails[];
  total_power: number;
}

interface ForceManagerProps {
  collections: Record<string, CollectionData>;
  isLoading: boolean;
}

export const ForceManager = ({ collections, isLoading }: ForceManagerProps) => {
  if (isLoading) {
    return (
      <Card className="gaming-component-card">
        <CardHeader>
          <div className="animate-pulse">
            <div className="h-6 bg-slate-600 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-slate-700 rounded w-1/2"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-slate-600 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gaming-component-card border-purple-500/30">
      <CardHeader>
        <CardTitle className="text-purple-300 font-mono flex items-center gap-2">
          <Scroll className="h-5 w-5" />
          DEPLOYED FORCES
        </CardTitle>
        <CardDescription className="text-slate-400">
          Manage your NFT collections and military forces
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.keys(collections || {}).length === 0 ? (
            <div className="text-center py-8">
              <Swords className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400">No forces deployed yet</p>
              <Button className="mt-4" data-testid="button-deploy-forces">
                Deploy First Force
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(collections || {}).map(([key, collection]: [string, any]) => (
                <Card key={key} className="bg-slate-800/50 border-purple-500/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-purple-300 text-lg flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {collection.collection?.collection_name || 'Unknown Collection'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">NFTs:</span>
                        <span className="text-cyan-400">{collection.nfts?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Role:</span>
                        <span className="text-green-400">{collection.collection?.game_role || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Power:</span>
                        <span className="text-red-400">{collection.total_power || 0}</span>
                      </div>
                      
                      {/* Role Summary */}
                      {collection.nfts && collection.nfts.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-slate-600">
                          <div className="text-xs text-slate-300 mb-2">Force Composition:</div>
                          <div className="flex flex-wrap gap-1">
                            {(() => {
                              const roles = collection.nfts.reduce((acc: Record<string, number>, nft: NFTDetails) => {
                                const fullRole = nft.game_stats?.role || 'iron warrior';
                                const playerType = fullRole.split(' ')[1] || fullRole; // Extract just the player type
                                acc[playerType] = (acc[playerType] || 0) + 1;
                                return acc;
                              }, {});
                              
                              return Object.entries(roles).map(([playerType, count]) => (
                                <Badge key={playerType} variant="outline" className="text-xs flex items-center gap-1">
                                  {getRoleIcon(playerType)}
                                  {playerType}: {String(count)}
                                </Badge>
                              ));
                            })()} 
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            className="flex-1 bg-purple-600 hover:bg-purple-700"
                            data-testid={`button-view-details-${key}`}
                          >
                            <Star className="h-3 w-3 mr-2" />
                            View Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-purple-300 flex items-center gap-2">
                              <Shield className="h-5 w-5" />
                              {collection.collection?.collection_name || 'Collection'} - Detailed View
                            </DialogTitle>
                          </DialogHeader>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                            {collection.nfts?.map((nft: NFTDetails) => (
                              <Card key={nft.id} className="bg-slate-800/50 border-slate-600">
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm text-cyan-300 flex items-center gap-2">
                                    {getRoleIcon(nft.game_stats?.role)}
                                    {nft.name || `NFT #${nft.id.slice(-4)}`}
                                  </CardTitle>
                                  <div className="flex gap-1">
                                    <Badge variant="outline" className="text-xs">
                                      {nft.game_stats?.role || 'warrior'}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs text-red-400">
                                      {nft.game_stats?.base_power || 0} PWR
                                    </Badge>
                                  </div>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                  {/* Special Abilities */}
                                  {nft.game_stats?.special_abilities && Object.keys(nft.game_stats.special_abilities).length > 0 && (
                                    <div>
                                      <div className="text-xs text-slate-400 mb-1">Special Abilities:</div>
                                      <div className="flex flex-wrap gap-1">
                                        {Object.entries(nft.game_stats.special_abilities)
                                          .filter(([_, enabled]) => enabled)
                                          .map(([ability, _]) => (
                                            <TooltipProvider key={ability}>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Badge variant="secondary" className="text-xs cursor-help">
                                                    {getAbilityIcon(ability)}
                                                    {formatAbilityName(ability)}
                                                  </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p>{getAbilityDescription(ability)}</p>
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          ))
                                        }
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Power Breakdown */}
                                  <div className="text-xs space-y-1">
                                    {nft.game_stats?.combat_effectiveness && (
                                      <div className="flex justify-between">
                                        <span className="text-slate-400">Combat:</span>
                                        <span className="text-red-400">{Math.floor(nft.game_stats.combat_effectiveness)}</span>
                                      </div>
                                    )}
                                    {nft.game_stats?.leadership_value > 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-slate-400">Leadership:</span>
                                        <span className="text-yellow-400">{Math.floor(nft.game_stats.leadership_value)}</span>
                                      </div>
                                    )}
                                    {nft.game_stats?.magical_power > 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-slate-400">Magic:</span>
                                        <span className="text-purple-400">{Math.floor(nft.game_stats.magical_power)}</span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Traits */}
                                  {nft.traits && Array.isArray(nft.traits) && nft.traits.length > 0 && (
                                    <div>
                                      <div className="text-xs text-slate-400 mb-1">Traits:</div>
                                      <div className="space-y-1 max-h-20 overflow-y-auto">
                                        {nft.traits.map((trait: any, idx: number) => (
                                          <div key={idx} className="text-xs flex justify-between">
                                            <span className="text-slate-300">{trait.trait_type}:</span>
                                            <span className="text-cyan-300">{trait.value}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <Button 
                        size="sm" 
                        className="bg-green-600 hover:bg-green-700"
                        data-testid={`button-manage-${key}`}
                      >
                        <Crown className="h-3 w-3 mr-2" />
                        Deploy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
