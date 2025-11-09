import React, { useEffect, useRef } from 'react';
import { Paper, Grid, Avatar, Stack, Typography, Chip, Button, CircularProgress } from '@mui/material';
import { CheckCircle, Cancel as XCircle, Gavel } from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

export type OfferType = 'buy' | 'sell' | 'transfer' | 'legacy' | 'orphaned';

export interface Offer {
  offerIndex: string;
  destination?: string;
  amount: string;
  flags?: { sellToken?: boolean };
  nftoken?: { owner?: string; name?: string; image?: string; metadata?: { image?: string; name?: string } };
  nftokenID: string;
  account: string;
  type: OfferType;
  isLegacy?: boolean;
  isOrphaned?: boolean;
  createdAt?: string;
  expiresAt?: string;
}

export interface OffersListProps {
  offers: Offer[];
  walletAddress?: string;
  onAccept: (offer: Offer) => void;
  onDecline: (offer: Offer) => void;
  acceptingOffer?: string | null;
  decliningOffer?: string | null;
  filterType?: OfferType | 'all';
  showNotifications?: boolean;
}

export const OffersList: React.FC<OffersListProps> = ({
  offers,
  walletAddress,
  onAccept,
  onDecline,
  acceptingOffer,
  decliningOffer,
  filterType = 'all',
  showNotifications = false
}) => {
  const notifiedOffersRef = useRef<Set<string>>(new Set());

  // Filter offers based on type
  const filteredOffers = offers.filter(offer => {
    if (filterType === 'all') return true;
    return offer.type === filterType;
  });

  // Separate sell offers for notifications if requested
  const sellOffers = showNotifications ? filteredOffers.filter(offer => offer.type === 'sell') : [];

  // Create notifications for new sell offers
  useEffect(() => {
    if (showNotifications && walletAddress && sellOffers.length > 0) {
      sellOffers.forEach(async (offer) => {
        if (!notifiedOffersRef.current.has(offer.offerIndex)) {
          try {
            const nftName = offer.nftoken?.name || offer.nftoken?.metadata?.name || `NFT #${offer.nftokenID.slice(-6)}`;
            const offerAmount = offer.amount === '0' ? '0' : (parseInt(offer.amount) / 1000000).toFixed(6);

            await apiRequest('/api/notifications', {
              method: 'POST',
              body: JSON.stringify({
                targetUserId: walletAddress, // Assuming walletAddress is the user handle
                type: 'nft_offer',
                title: `New Sell Offer for ${nftName}`,
                content: `Someone wants to sell you ${nftName} for ${offerAmount} XRP`,
                actionUrl: `/xrp-wallet-redesigned`, // Link to wallet page
                relatedId: offer.offerIndex,
              }),
              headers: {
                'Content-Type': 'application/json'
              }
            });

            notifiedOffersRef.current.add(offer.offerIndex);
          } catch (error) {
            console.error('Failed to create sell offer notification:', error);
          }
        }
      });
    }
  }, [sellOffers, showNotifications, walletAddress]);

  if (!filteredOffers || filteredOffers.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Gavel sx={{ fontSize: 64, color: 'text.secondary', mx: 'auto', mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          {filterType === 'all' ? 'No offers found' : `No ${filterType} offers found`}
        </Typography>
      </div>
    );
  }

  return (
    <Stack spacing={2}>
      {filteredOffers.map((offer) => {
        const offerType = offer.type;
        const nftName = offer.nftoken?.name || offer.nftoken?.metadata?.name || `NFT #${offer.nftokenID.slice(-6)}`;
        let nftImage = offer.nftoken?.image || offer.nftoken?.metadata?.image || '';
        if (nftImage && nftImage.startsWith('ipfs://')) {
          nftImage = nftImage.replace('ipfs://', 'https://ipfs.io/ipfs/');
        }
        const offerAmount = offer.amount === '0' ? '0' : (parseInt(offer.amount) / 1000000).toFixed(6);
        const isTransfer = offerType === 'transfer';

        // Determine chip color and label based on offer type
        const getChipProps = (type: OfferType) => {
          switch (type) {
            case 'buy': return { label: 'Buy Offer', color: 'success' as const };
            case 'sell': return { label: 'Sell Offer', color: 'info' as const };
            case 'transfer': return { label: 'Transfer', color: 'secondary' as const };
            case 'legacy': return { label: 'Legacy', color: 'warning' as const };
            case 'orphaned': return { label: 'Orphaned', color: 'error' as const };
            default: return { label: 'Unknown', color: 'default' as const };
          }
        };

        const chipProps = getChipProps(offerType);

        return (
          <Paper key={offer.offerIndex} sx={{ p: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
            <Grid container spacing={2} alignItems="flex-start">
              {nftImage && (
                <Grid item xs={12} sm="auto">
                  <Avatar src={nftImage} variant="rounded" sx={{ width: 80, height: 80 }} />
                </Grid>
              )}
              <Grid item xs={12} sm>
                <Stack spacing={1.5}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Typography variant="subtitle1" fontWeight={600}>{nftName}</Typography>
                    <Chip label={chipProps.label} size="small" color={chipProps.color} variant="outlined" />
                    {offer.isLegacy && <Chip label="Legacy" size="small" color="warning" variant="filled" />}
                    {offer.isOrphaned && <Chip label="Orphaned" size="small" color="error" variant="filled" />}
                  </div>
                  <Stack spacing={0.5}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Typography variant="caption" color="text.secondary">From:</Typography>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{offer.account}</Typography>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Typography variant="caption" color="text.secondary">Amount:</Typography>
                      <Typography variant="body2" fontWeight={600}>{offerAmount} XRP {isTransfer && '(Free Transfer)'}</Typography>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Typography variant="caption" color="text.secondary">NFT ID:</Typography>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{offer.nftokenID.slice(0, 16)}...</Typography>
                    </div>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button onClick={() => onAccept(offer)} disabled={acceptingOffer === offer.offerIndex || decliningOffer === offer.offerIndex} variant="contained" color="success" size="small" startIcon={acceptingOffer === offer.offerIndex ? <CircularProgress size={16} /> : <CheckCircle />}>{acceptingOffer === offer.offerIndex ? 'Processing...' : 'Accept'}</Button>
                    <Button onClick={() => onDecline(offer)} disabled={decliningOffer === offer.offerIndex || acceptingOffer === offer.offerIndex} variant="outlined" color="error" size="small" startIcon={decliningOffer === offer.offerIndex ? <CircularProgress size={16} /> : <XCircle />}>{decliningOffer === offer.offerIndex ? 'Declining...' : 'Decline'}</Button>
                  </Stack>
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        );
      })}
    </Stack>
  );
};
