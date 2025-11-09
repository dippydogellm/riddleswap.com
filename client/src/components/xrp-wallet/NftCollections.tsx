import React from 'react';
import { Card, CardContent, Grid, Typography, Chip, Button } from '@mui/material';
import { Eye } from 'lucide-react';

export interface NftItem {
  nftokenID?: string;
  NFTokenID?: string;
  tokenID?: string;
  nft_id?: string;
  image?: string;
  name?: string;
  collectionName?: string;
  collection?: { name?: string };
  issuer?: string;
  nftokenTaxon?: number;
  NFTokenTaxon?: number;
  attributes?: Array<{ trait_type: string; value: string }>;
  rarity?: string | number;
  floor_price?: string | number;
  last_sale_price?: string | number;
}

export interface NftCollectionsProps {
  collections: Map<string, NftItem[]>;
  onSelectCollection: (name: string, nfts: NftItem[]) => void;
}

export const NftCollections: React.FC<NftCollectionsProps> = ({ collections, onSelectCollection }) => {
  if (!collections || collections.size === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Typography variant="body1" color="text.secondary">No NFTs found</Typography>
      </div>
    );
  }

  return (
    <Grid container spacing={3}>
      {Array.from(collections.entries()).map(([collectionKey, nfts]) => {
        const previewNFT = nfts[0];
        const collectionName = previewNFT.collectionName || previewNFT.collection?.name || `Collection ${collectionKey.split(':')[1]}`;
        const previewImage = previewNFT.image;
        if (!previewImage) return null;

        return (
          <Grid item xs={6} sm={4} md={3} lg={2} key={collectionKey}>
            <Card sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', transition: 'all 0.2s', '&:hover': { borderColor: 'primary.main', transform: 'translateY(-4px)' } }}>
              <CardContent sx={{ p: 2 }}>
                <div style={{ position: 'relative', width: '100%', paddingBottom: '100%', backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                  <img src={previewImage} alt={collectionName} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <Typography variant="subtitle1" fontWeight={600} noWrap sx={{ mb: 1 }}>
                  {collectionName}
                </Typography>
                <Chip label={`${nfts.length} NFT${nfts.length !== 1 ? 's' : ''}`} size="small" color="primary" sx={{ mb: 1 }} />
                {previewNFT.floor_price && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    Floor: {typeof previewNFT.floor_price === 'number' ? previewNFT.floor_price.toFixed(2) : previewNFT.floor_price} XRP
                  </Typography>
                )}
                <Button fullWidth variant="outlined" size="small" onClick={() => onSelectCollection(collectionName, nfts)} startIcon={<Eye size={16} />}>View Collection</Button>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
};
