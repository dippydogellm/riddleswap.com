import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Gamepad2, Swords, MapPin, FolderKanban, Trophy, Users } from "lucide-react";
import { useSession } from "@/utils/sessionManager";
import { normalizeNftImage, getFallbackImage } from "@/utils/imageNormalizer";

export default function GamingDashboardHub() {
  const session = useSession();
  const [, navigate] = useLocation();

  // Debug session state
  console.log('🎮 [Gaming Hub] Session state:', {
    isLoggedIn: session?.isLoggedIn,
    handle: session?.handle,
    hasWalletData: !!session?.walletData,
    sessionToken: session?.sessionToken ? 'present' : 'missing'
  });

  // Fetch user's owned NFTs
  const { data: userNFTs, isLoading: nftsLoading } = useQuery<any>({
    queryKey: ['/api/inquisition-audit/user-nfts'],
    enabled: session?.isLoggedIn,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch user's land/civilization NFTs (RiddleCity)
  const { data: civilizationData, isLoading: civLoading } = useQuery<any>({
    queryKey: ['/api/gaming/civilization'],
    enabled: session?.isLoggedIn,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch project NFTs (grouped by collection)
  const { data: projectsData, isLoading: projectsLoading } = useQuery<any>({
    queryKey: ['/api/gaming/projects'],
    staleTime: 10 * 60 * 1000,
  });

  // Fetch squadrons summary
  const { data: squadronsData } = useQuery<any>({
    queryKey: ['/api/gaming/squadrons'],
    enabled: session?.isLoggedIn,
  });

  // Fetch active battles count
  const { data: battlesData } = useQuery<any>({
    queryKey: ['/api/gaming/battles/active'],
    enabled: session?.isLoggedIn,
  });

  const isLoading = nftsLoading || civLoading || projectsLoading;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Session Debug Banner - Remove after testing */}
      {!session?.isLoggedIn && (
        <div className="bg-yellow-500 text-black p-3 text-center font-semibold">
          ⚠️ SESSION DEBUG: Not logged in. Please use wallet login to access gaming features.
        </div>
      )}
      
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <Gamepad2 className="w-10 h-10 text-primary" />
                Gaming Hub
              </h1>
              <p className="text-muted-foreground mt-2">
                Manage your NFTs, squadrons, and battles
              </p>
            </div>
            {session?.handle ? (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Welcome back,</p>
                <p className="text-lg font-semibold">{session.handle}</p>
              </div>
            ) : (
              <div className="text-right">
                <Button onClick={() => navigate('/wallet-login')} variant="default">
                  Login to Play
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Your NFTs Section */}
            <section>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-primary" />
                    Your NFTs
                  </CardTitle>
                  <CardDescription>
                    {userNFTs?.nfts?.length || 0} NFTs owned
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!session?.isLoggedIn ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">Please log in to view your NFTs</p>
                      <Button onClick={() => navigate('/wallet-login')}>
                        Log In
                      </Button>
                    </div>
                  ) : userNFTs?.nfts?.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
                        {userNFTs.nfts.slice(0, 10).map((nft: any) => (
                          <div
                            key={nft.nft_id}
                            className="group cursor-pointer"
                            onClick={() => navigate(`/gaming/nft/${nft.nft_id}`)}
                          >
                            <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-2 relative">
                              <img
                                src={normalizeNftImage(nft.image_url || nft.image)}
                                alt={nft.name || 'NFT'}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                onError={(e) => {
                                  e.currentTarget.src = getFallbackImage();
                                }}
                              />
                              {nft.power && (
                                <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                  ⚡ {nft.power}
                                </div>
                              )}
                            </div>
                            <p className="text-sm font-medium truncate">{nft.name || 'Unnamed NFT'}</p>
                            <p className="text-xs text-muted-foreground truncate">{nft.collection_name}</p>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate('/gaming/my-nfts')}
                      >
                        View All {userNFTs.nfts.length} NFTs
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">No NFTs found</p>
                      <div className="flex gap-2 justify-center">
                        <Button onClick={() => navigate('/gaming-nfts')}>
                          Browse Marketplace
                        </Button>
                        <Button variant="outline" onClick={() => navigate('/gaming/nfts/browse')}>
                          Advanced Search
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Your Civilization Section */}
            <section>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-6 h-6 text-primary" />
                    Your Civilization
                  </CardTitle>
                  <CardDescription>
                    Land and properties in RiddleCity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!session?.isLoggedIn ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Please log in to view your civilization</p>
                    </div>
                  ) : civilizationData?.lands?.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        {civilizationData.lands.map((land: any) => (
                          <div
                            key={land.id}
                            className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => navigate(`/gaming/land/${land.id}`)}
                          >
                            <div className="flex items-start gap-3">
                              <MapPin className="w-8 h-8 text-primary flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold truncate">{land.name}</h3>
                                <p className="text-sm text-muted-foreground">Level {land.level || 1}</p>
                                <p className="text-xs text-muted-foreground mt-1">{land.type}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate('/gaming/civilization')}
                      >
                        Manage Civilization
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">You don't own any land yet</p>
                      <Button onClick={() => navigate('/gaming/marketplace')}>
                        Browse Land Marketplace
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Projects Section */}
            <section>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderKanban className="w-6 h-6 text-primary" />
                    Partner Projects
                  </CardTitle>
                  <CardDescription>
                    Explore NFT collections and projects
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {projectsData?.projects?.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        {projectsData.projects.slice(0, 6).map((project: any) => (
                          <div
                            key={project.id}
                            className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => navigate(`/gaming/projects/${project.id}`)}
                          >
                            <div className="flex items-center gap-3 mb-3">
                              {project.logo_url ? (
                                <img
                                  src={project.logo_url}
                                  alt={project.name}
                                  className="w-12 h-12 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <FolderKanban className="w-6 h-6 text-primary" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold truncate">{project.name}</h3>
                                <p className="text-xs text-muted-foreground">{project.nft_count || 0} NFTs</p>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate('/gaming/projects')}
                      >
                        View All Projects
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No projects available yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Battle Shortcuts Section */}
            <section>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Swords className="w-6 h-6 text-primary" />
                    Battle Arena
                  </CardTitle>
                  <CardDescription>
                    Manage squadrons and engage in battles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Squadrons Card */}
                    <div
                      className="border rounded-lg p-6 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate('/gaming/squadrons')}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <Users className="w-10 h-10 text-primary" />
                        <div className="text-right">
                          <p className="text-3xl font-bold">{squadronsData?.count || 0}</p>
                          <p className="text-sm text-muted-foreground">Squadrons</p>
                        </div>
                      </div>
                      <h3 className="font-semibold text-lg mb-2">Your Squadrons</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Manage your NFT squadrons and prepare for battle
                      </p>
                      <Button className="w-full">
                        Manage Squadrons
                      </Button>
                    </div>

                    {/* Battles Card */}
                    <div
                      className="border rounded-lg p-6 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate('/gaming/battles')}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <Swords className="w-10 h-10 text-primary" />
                        <div className="text-right">
                          <p className="text-3xl font-bold">{battlesData?.active_count || 0}</p>
                          <p className="text-sm text-muted-foreground">Active Battles</p>
                        </div>
                      </div>
                      <h3 className="font-semibold text-lg mb-2">Battle Room</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Challenge opponents and compete for rewards
                      </p>
                      <Button className="w-full" variant="destructive">
                        Enter Battle Room
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
