import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Globe, 
  Twitter, 
  MessageCircle, 
  Eye, 
  Smartphone,
  Monitor,
  X,
  ExternalLink
} from 'lucide-react';
import { VerificationBadge } from './VerificationBadge';

interface MetadataPreviewProps {
  projectData: {
    title: string;
    description?: string;
    website?: string;
    logo_url?: string;
    banner_url?: string;
    twitter?: string;
    discord?: string;
    telegram?: string;
  };
  originalData?: any;
  open: boolean;
  onClose: () => void;
}

export function MetadataPreview({ projectData, originalData, open, onClose }: MetadataPreviewProps) {
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Mock data for preview - in real app this would come from unified metadata endpoint
  const previewData = {
    ...originalData,
    ...projectData,
    // Add some mock stats for preview
    floor_price: "150 XRP",
    total_nfts: 1000,
    owners: 456,
    verified: true // For preview purposes
  };

  const TokenPagePreview = ({ mobile = false }) => (
    <div className={`bg-white dark:bg-slate-900 rounded-lg overflow-hidden ${mobile ? 'max-w-sm' : 'w-full'}`}>
      {/* Banner */}
      {previewData.banner_url && (
        <div className={`relative ${mobile ? 'h-32' : 'h-48'}`}>
          <img
            src={previewData.banner_url}
            alt="Project banner"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}
      
      {/* Project Header */}
      <div className="p-4 space-y-4">
        <div className="flex items-start space-x-4">
          {/* Logo */}
          <div className={`${mobile ? 'w-16 h-16' : 'w-20 h-20'} flex-shrink-0`}>
            {previewData.logo_url ? (
              <img
                src={previewData.logo_url}
                alt="Project logo"
                className="w-full h-full object-cover rounded-xl border-2 border-white shadow-md"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNGMEYwRjAiLz48dGV4dCB4PSIxMDAiIHk9IjEwNSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkxvZ288L3RleHQ+PC9zdmc+';
                }}
              />
            ) : (
              <div className="w-full h-full bg-slate-200 dark:bg-slate-700 rounded-xl flex items-center justify-center">
                <span className="text-slate-400 text-xs">Logo</span>
              </div>
            )}
          </div>

          {/* Project Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h2 className={`font-bold text-slate-900 dark:text-white truncate ${mobile ? 'text-lg' : 'text-xl'}`}>
                {previewData.title || 'Untitled Project'}
              </h2>
              <VerificationBadge verified={previewData.verified} size="sm" />
            </div>
            
            {previewData.description && (
              <p className={`text-slate-600 dark:text-slate-400 ${mobile ? 'text-sm' : 'text-base'} line-clamp-2`}>
                {previewData.description}
              </p>
            )}

            {/* Social Links */}
            <div className="flex items-center space-x-3 mt-2">
              {previewData.website && (
                <Button size="sm" variant="outline" className="h-8 px-3">
                  <Globe className="w-3 h-3 mr-1" />
                  Website
                </Button>
              )}
              {previewData.twitter && (
                <Button size="sm" variant="outline" className="h-8 px-3">
                  <Twitter className="w-3 h-3 mr-1" />
                  Twitter
                </Button>
              )}
              {previewData.discord && (
                <Button size="sm" variant="outline" className="h-8 px-3">
                  <MessageCircle className="w-3 h-3 mr-1" />
                  Discord
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 py-4 border-t border-slate-200 dark:border-slate-700">
          <div className="text-center">
            <div className={`font-bold text-slate-900 dark:text-white ${mobile ? 'text-sm' : 'text-base'}`}>
              {previewData.floor_price || 'N/A'}
            </div>
            <div className={`text-slate-600 dark:text-slate-400 ${mobile ? 'text-xs' : 'text-sm'}`}>
              Floor
            </div>
          </div>
          <div className="text-center">
            <div className={`font-bold text-slate-900 dark:text-white ${mobile ? 'text-sm' : 'text-base'}`}>
              {previewData.total_nfts?.toLocaleString() || '0'}
            </div>
            <div className={`text-slate-600 dark:text-slate-400 ${mobile ? 'text-xs' : 'text-sm'}`}>
              Items
            </div>
          </div>
          <div className="text-center">
            <div className={`font-bold text-slate-900 dark:text-white ${mobile ? 'text-sm' : 'text-base'}`}>
              {previewData.owners?.toLocaleString() || '0'}
            </div>
            <div className={`text-slate-600 dark:text-slate-400 ${mobile ? 'text-xs' : 'text-sm'}`}>
              Owners
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const MarketplaceCardPreview = ({ mobile = false }) => (
    <div className={`bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-lg ${mobile ? 'w-full' : 'max-w-sm'}`}>
      {/* Card Image */}
      <div className={`relative ${mobile ? 'h-32' : 'h-48'}`}>
        {previewData.logo_url ? (
          <img
            src={previewData.logo_url}
            alt="Collection"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNGMEYwRjAiLz48dGV4dCB4PSIxMDAiIHk9IjEwNSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5GVDwvdGV4dD48L3N2Zz4=';
            }}
          />
        ) : (
          <div className="w-full h-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
            <span className="text-slate-400">NFT</span>
          </div>
        )}
        
        {/* Verification Badge */}
        <div className="absolute top-2 left-2">
          <VerificationBadge verified={previewData.verified} size="xs" />
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className={`font-semibold text-slate-900 dark:text-white truncate ${mobile ? 'text-sm' : 'text-base'}`}>
            {previewData.title || 'Untitled Collection'}
          </h3>
        </div>
        
        {previewData.description && (
          <p className={`text-slate-600 dark:text-slate-400 mb-3 line-clamp-2 ${mobile ? 'text-xs' : 'text-sm'}`}>
            {previewData.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div>
            <div className={`font-semibold text-slate-900 dark:text-white ${mobile ? 'text-sm' : 'text-base'}`}>
              {previewData.floor_price || 'N/A'}
            </div>
            <div className={`text-slate-500 ${mobile ? 'text-xs' : 'text-sm'}`}>Floor</div>
          </div>
          
          <Button size="sm" className="h-8">
            <Eye className="w-3 h-3 mr-1" />
            View
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Metadata Preview</DialogTitle>
              <DialogDescription>
                See how your project will appear on token and NFT pages
              </DialogDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant={previewMode === 'desktop' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewMode('desktop')}
              >
                <Monitor className="w-4 h-4 mr-2" />
                Desktop
              </Button>
              <Button
                variant={previewMode === 'mobile' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewMode('mobile')}
              >
                <Smartphone className="w-4 h-4 mr-2" />
                Mobile
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto flex-1">
          <Tabs defaultValue="token-page" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="token-page">Token/NFT Page</TabsTrigger>
              <TabsTrigger value="marketplace-card">Marketplace Card</TabsTrigger>
            </TabsList>

            <TabsContent value="token-page" className="space-y-4">
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                This is how your project will appear on individual token and NFT pages
              </div>
              
              <div className={`${previewMode === 'mobile' ? 'max-w-sm mx-auto' : ''}`}>
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <TokenPagePreview mobile={previewMode === 'mobile'} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="marketplace-card" className="space-y-4">
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                This is how your project will appear as a card in marketplace listings
              </div>
              
              <div className={`${previewMode === 'mobile' ? 'max-w-sm mx-auto' : 'max-w-md'}`}>
                <MarketplaceCardPreview mobile={previewMode === 'mobile'} />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
            <Badge variant="outline">Preview</Badge>
            <span>Changes are not yet saved</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Close Preview
            </Button>
            <Button 
              onClick={() => {
                // This would trigger the save action in the parent component
                onClose();
              }}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
