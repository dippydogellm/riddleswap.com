import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Book, Store, Crown, Landmark, Grid3x3, Users, Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";

// Icon and color mapping based on collection role
function getCollectionIcon(role: string, collectionName: string) {
  // Map specific collections to icons
  if (collectionName.includes("Inquisition")) return Shield;
  if (collectionName.includes("Inquiry")) return Book;
  if (collectionName.includes("Emporium")) return Store;
  if (collectionName.includes("AURUM")) return Crown;
  if (collectionName.includes("Troll") || collectionName.includes("Bridge")) return Landmark;
  
  // Map by role
  switch (role) {
    case 'army': return Shield;
    case 'merchant': return Store;
    case 'bank': return Landmark;
    case 'special': return Crown;
    case 'partner': return Users;
    default: return Sparkles;
  }
}

function getCollectionColor(role: string, collectionName: string) {
  // Map specific collections to colors
  if (collectionName.includes("Inquisition")) return "text-red-500";
  if (collectionName.includes("Inquiry")) return "text-blue-500";
  if (collectionName.includes("Emporium")) return "text-amber-500";
  if (collectionName.includes("AURUM")) return "text-purple-500";
  if (collectionName.includes("Troll") || collectionName.includes("Bridge")) return "text-green-500";
  
  // Map by role
  switch (role) {
    case 'army': return "text-red-500";
    case 'merchant': return "text-amber-500";
    case 'bank': return "text-green-500";
    case 'special': return "text-purple-500";
    case 'partner': return "text-cyan-500";
    default: return "text-gray-400";
  }
}

interface Collection {
  id: string | number;
  collection_name?: string;
  name?: string;
  issuer_address?: string;
  taxon: number | null;
  game_role?: string;
  stats?: {
    total_nfts: number;
    total_points: number;
    avg_points: string;
  };
}

interface NFTCollectionDropdownProps {
  nfts: any[];
  onFilterChange: (filteredNFTs: any[]) => void;
  theme?: 'light' | 'dark';
  showLabel?: boolean;
  persistKey?: string; // Optional localStorage key for persistence
  className?: string;
}

export function NFTCollectionDropdown({ 
  nfts, 
  onFilterChange, 
  theme = 'dark',
  showLabel = true,
  persistKey,
  className = "",
}: NFTCollectionDropdownProps) {
  // Load persisted selection from localStorage if persistKey is provided
  const [selectedCollection, setSelectedCollection] = useState<string>(() => {
    if (persistKey && typeof window !== 'undefined') {
      return localStorage.getItem(persistKey) || "all";
    }
    return "all";
  });

  // Fetch collections dynamically from API
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCollections() {
      try {
        const response = await fetch('/api/inquisition-audit/collections');
        const data = await response.json() as any;
        
        if (data.success) {
          setCollections(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch collections:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchCollections();
  }, []);

  // Build collections array with "All" option
  const allCollections = [
    {
      id: "all",
      collection_name: "All Collections",
      name: "All Collections",
      taxon: null,
      game_role: "all",
    },
    ...collections
  ];

  // Count NFTs per collection
  const collectionCounts = allCollections.reduce((acc, collection) => {
    const collectionId = String(collection.id);
    
    if (collection.id === "all") {
      acc[collectionId] = nfts.length;
    } else {
      const collectionName = collection.collection_name || collection.name || '';
      acc[collectionId] = nfts.filter(nft => {
        const matchName = nft.collection_name?.toLowerCase() === collectionName.toLowerCase();
        const matchTaxon = nft.taxon === collection.taxon || nft.nft_taxon === collection.taxon;
        const matchIssuer = nft.issuer_address === collection.issuer_address;
        return matchName || (matchTaxon && matchIssuer);
      }).length;
    }
    return acc;
  }, {} as Record<string, number>);

  // Filter NFTs based on selected collection
  useEffect(() => {
    if (selectedCollection === "all") {
      onFilterChange(nfts);
    } else {
      const collection = allCollections.find(c => String(c.id) === selectedCollection);
      if (collection) {
        const collectionName = collection.collection_name || collection.name || '';
        const filtered = nfts.filter(nft => {
          const matchName = nft.collection_name?.toLowerCase() === collectionName.toLowerCase();
          const matchTaxon = nft.taxon === collection.taxon || nft.nft_taxon === collection.taxon;
          const matchIssuer = nft.issuer_address === collection.issuer_address;
          return matchName || (matchTaxon && matchIssuer);
        });
        onFilterChange(filtered);
      }
    }
  }, [selectedCollection, nfts, collections]);

  // Handle collection change
  const handleCollectionChange = (value: string) => {
    setSelectedCollection(value);
    
    // Persist to localStorage if persistKey is provided
    if (persistKey && typeof window !== 'undefined') {
      localStorage.setItem(persistKey, value);
    }
  };

  const selectedCollectionData = allCollections.find(c => String(c.id) === selectedCollection);
  const collectionName = selectedCollectionData?.collection_name || selectedCollectionData?.name || '';
  const Icon = selectedCollectionData 
    ? getCollectionIcon(selectedCollectionData.game_role || '', collectionName)
    : Grid3x3;
  const iconColor = selectedCollectionData
    ? getCollectionColor(selectedCollectionData.game_role || '', collectionName)
    : 'text-gray-400';

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <Label className={`mb-2 block text-sm font-semibold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
          Filter by Collection
        </Label>
      )}
      <Select value={selectedCollection} onValueChange={handleCollectionChange}>
        <SelectTrigger 
          className={`w-full ${
            theme === 'dark' 
              ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' 
              : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'
          } transition-colors`}
          disabled={isLoading}
        >
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${iconColor}`} />
            <SelectValue placeholder={isLoading ? "Loading collections..." : "Select collection"} />
          </div>
        </SelectTrigger>
        <SelectContent 
          className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}
        >
          {allCollections.map((collection) => {
            const collectionId = String(collection.id);
            const collectionName = collection.collection_name || collection.name || '';
            const CollectionIcon = getCollectionIcon(collection.game_role || '', collectionName);
            const collectionColor = getCollectionColor(collection.game_role || '', collectionName);
            const count = collectionCounts[collectionId] || 0;
            
            return (
              <SelectItem 
                key={collectionId} 
                value={collectionId}
                className={theme === 'dark' ? 'text-white hover:bg-slate-700' : 'text-gray-900 hover:bg-gray-100'}
              >
                <div className="flex items-center gap-2 w-full">
                  <CollectionIcon className={`w-4 h-4 ${collectionColor}`} />
                  <span className="flex-1">{collectionName}</span>
                  {collection.game_role === 'partner' && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 mr-1">
                      Partner
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    theme === 'dark' 
                      ? 'bg-slate-700 text-gray-300' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {count}
                  </span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {/* Optional: Show active filter info */}
      {selectedCollection !== "all" && selectedCollectionData && (
        <div className={`mt-2 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          Showing {collectionCounts[selectedCollection] || 0} NFTs from {collectionName}
        </div>
      )}
    </div>
  );
}
