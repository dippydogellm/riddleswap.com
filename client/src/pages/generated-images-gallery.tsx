import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Sparkles, 
  Crown, 
  Shield,
  Search,
  ArrowLeft,
  RefreshCw,
  Image as ImageIcon
} from "lucide-react";
import { Link } from "wouter";

interface GeneratedImage {
  nft_token_id: string;
  name: string;
  collection_name: string;
  image_url: string;
  character_class?: string | null;
  material_type?: string | null;
  created_at: string;
}

export default function GeneratedImagesGallery() {
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch generated images
  const { data: imagesData, isLoading, error } = useQuery<{ 
    success: boolean; 
    data: { images: GeneratedImage[]; count: number } 
  }>({
    queryKey: ['/api/inquisition-audit/generated-images?limit=200'],
    staleTime: 30000,
  });

  const images = imagesData?.data?.images || [];

  // Filter images based on search
  const filteredImages = images.filter(img => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      img.name?.toLowerCase().includes(query) ||
      img.character_class?.toLowerCase().includes(query) ||
      img.material_type?.toLowerCase().includes(query) ||
      img.nft_token_id?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/inquisition-gaming">
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to Gaming
              </button>
            </Link>
            
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-purple-400" />
                Generated Character Gallery
              </h1>
              <p className="text-slate-400 mt-1">
                AI-generated artwork from The Trolls Inquisition
              </p>
            </div>
          </div>

          <Badge variant="outline" className="border-purple-500 text-purple-300 text-lg px-4 py-2">
            <ImageIcon className="w-4 h-4 mr-2" />
            {filteredImages.length} Images
          </Badge>
        </div>

        {/* Search Bar */}
        <Card className="bg-slate-800 border-purple-600">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Search by name, character class, or material..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="bg-red-900 border-red-600">
            <CardContent className="pt-6">
              <p className="text-red-200">Failed to load generated images. Please try again.</p>
            </CardContent>
          </Card>
        )}

        {/* Gallery Grid */}
        {!isLoading && !error && (
          <>
            {filteredImages.length === 0 ? (
              <Card className="bg-slate-800 border-purple-600">
                <CardContent className="pt-6">
                  <p className="text-slate-400 text-center py-10">
                    {searchQuery 
                      ? "No images match your search." 
                      : "No generated images found. Create some character art in the gaming section!"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredImages.map((image) => (
                  <Card 
                    key={image.nft_token_id} 
                    className="bg-slate-800 border-2 border-purple-600 hover:border-purple-500 transition-all hover:scale-105 overflow-hidden cursor-pointer"
                  >
                    {/* Image */}
                    <div className="relative overflow-hidden bg-slate-900 h-64">
                      <img 
                        src={image.image_url}
                        alt={image.name || 'Generated Character'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23334155" width="100" height="100"/%3E%3C/svg%3E';
                        }}
                      />
                      
                      {/* Character Class Badge */}
                      {image.character_class && (
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-cyan-900 text-cyan-300 border-0 font-bold">
                            <Shield className="w-3 h-3 mr-1" />
                            {image.character_class}
                          </Badge>
                        </div>
                      )}

                      {/* Material Type Badge */}
                      {image.material_type && (
                        <div className="absolute top-2 left-2">
                          <Badge className="bg-amber-900 text-amber-300 border-0 font-bold">
                            <Crown className="w-3 h-3 mr-1" />
                            {image.material_type}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <CardContent className="p-4 space-y-2">
                      <h3 className="text-white font-bold truncate" title={image.name}>
                        {image.name || `NFT #${image.nft_token_id.substring(0, 8)}`}
                      </h3>
                      
                      <p className="text-slate-400 text-xs">
                        {new Date(image.created_at).toLocaleDateString()}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {image.character_class && (
                          <Badge variant="outline" className="border-cyan-600 text-cyan-400 text-xs">
                            {image.character_class}
                          </Badge>
                        )}
                        {image.material_type && (
                          <Badge variant="outline" className="border-amber-600 text-amber-400 text-xs">
                            {image.material_type}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
