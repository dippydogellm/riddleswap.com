import React from 'react';
import { Paper, Grid, Avatar, Stack, Typography, Chip, Button, CircularProgress } from '@mui/material';
import { CheckCircle, Cancel as XCircle, Gavel } from '@mui/icons-material';

export interface Offer {
  offerIndex: string;
  destination?: string;
  amount: string;
  flags?: { sellToken?: boolean };
  nftoken?: { owner?: string; name?: string; image?: string; metadata?: { image?: string; name?: string } };
  nftokenID: string;
  account: string;
}

export interface OffersListProps {
  offers: Offer[];
  walletAddress?: string;
  onAccept: (offer: Offer) => void;
  onDecline: (offer: Offer) => void;
  acceptingOffer?: string | null;
  decliningOffer?: string | null;
}

export const OffersList: React.FC<OffersListProps> = ({ offers, walletAddress, onAccept, onDecline, acceptingOffer, decliningOffer }) => {
  if (!offers || offers.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Gavel sx={{ fontSize: 64, color: 'text.secondary', mx: 'auto', mb: 2 }} />
        <Typography variant="body1" color="text.secondary">No valid offers for your NFTs</Typography>
      </div>
    );
  }

  return (
    <Stack spacing={2}>
      {offers.map((offer) => {
        const isTransfer = offer.destination === walletAddress && offer.amount === '0';
        const isBuyOffer = offer.flags?.sellToken === false && offer.nftoken?.owner === walletAddress;
        const offerType = isTransfer ? 'transfer' : isBuyOffer ? 'buy' : 'sell';
        const nftName = offer.nftoken?.name || offer.nftoken?.metadata?.name || `NFT #${offer.nftokenID.slice(-6)}`;
        let nftImage = offer.nftoken?.image || offer.nftoken?.metadata?.image || '';
        if (nftImage && nftImage.startsWith('ipfs://')) {
          nftImage = nftImage.replace('ipfs://', 'https://ipfs.io/ipfs/');
        }
        const offerAmount = offer.amount === '0' ? '0' : (parseInt(offer.amount) / 1000000).toFixed(6);

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
                    <Chip label={offerType === 'transfer' ? 'Transfer' : offerType === 'buy' ? 'Buy Offer' : 'Sell Offer'} size="small" color={offerType === 'transfer' ? 'secondary' : offerType === 'buy' ? 'success' : 'info'} variant="outlined" />
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
