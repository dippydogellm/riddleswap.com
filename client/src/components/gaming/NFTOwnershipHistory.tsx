/**
 * NFT Ownership History Component
 * Material UI - Shows ownership transfers and history
 */

import { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Stack,
  IconButton,
  Collapse,
  Link,
  Tooltip,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';
import {
  SwapHoriz as TransferIcon,
  Add as MintIcon,
  LocalFireDepartment as BurnIcon,
  ExpandMore as ExpandMoreIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';

interface OwnershipHistoryProps {
  nftTokenId: string;
  currentOwner: string;
}

interface HistoryItem {
  id: string;
  previousOwner: string | null;
  newOwner: string;
  changeReason: string;
  changedAt: string;
  transactionHash: string | null;
  powerLevel: number;
  status: string;
}

export default function NFTOwnershipHistory({ nftTokenId, currentOwner }: OwnershipHistoryProps) {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['nft-ownership-history', nftTokenId],
    queryFn: async () => {
      const res = await fetch(`/api/gaming/nft/${nftTokenId}/ownership-history`);
      if (!res.ok) throw new Error('Failed to load ownership history');
      return res.json();
    },
  });

  const history: HistoryItem[] = data?.history || [];

  const getEventIcon = (reason: string) => {
    switch (reason) {
      case 'initial':
      case 'mint':
        return <MintIcon />;
      case 'burn':
        return <BurnIcon />;
      default:
        return <TransferIcon />;
    }
  };

  const getEventColor = (reason: string): "primary" | "secondary" | "success" | "error" | "warning" | "info" => {
    switch (reason) {
      case 'initial':
      case 'mint':
        return 'success';
      case 'burn':
        return 'error';
      case 'transfer':
        return 'primary';
      default:
        return 'info';
    }
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const displayHistory = expanded ? history : history.slice(0, 3);

  return (
    <Card elevation={2}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Ownership History
          </Typography>
          <Chip
            label={`${history.length} ${history.length === 1 ? 'Event' : 'Events'}`}
            size="small"
            color="primary"
          />
        </Stack>

        {isLoading && (
          <Typography color="text.secondary" align="center" py={2}>
            Loading history...
          </Typography>
        )}

        {!isLoading && history.length === 0 && (
          <Typography color="text.secondary" align="center" py={2}>
            No ownership history available
          </Typography>
        )}

        {!isLoading && history.length > 0 && (
          <>
            <Timeline position="right">
              {displayHistory.map((item, index) => (
                <TimelineItem key={item.id}>
                  <TimelineOppositeContent sx={{ flex: 0.3, color: 'text.secondary' }}>
                    <Typography variant="caption">
                      {new Date(item.changedAt).toLocaleDateString()}
                    </Typography>
                    <Typography variant="caption" display="block">
                      {new Date(item.changedAt).toLocaleTimeString()}
                    </Typography>
                  </TimelineOppositeContent>
                  
                  <TimelineSeparator>
                    <TimelineDot color={getEventColor(item.changeReason)}>
                      {getEventIcon(item.changeReason)}
                    </TimelineDot>
                    {index < displayHistory.length - 1 && <TimelineConnector />}
                  </TimelineSeparator>
                  
                  <TimelineContent>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {item.changeReason === 'initial' ? 'Minted' : 
                         item.changeReason === 'transfer' ? 'Transferred' :
                         item.changeReason === 'burn' ? 'Burned' :
                         item.changeReason}
                      </Typography>
                      
                      {item.previousOwner && (
                        <Stack direction="row" spacing={0.5} alignItems="center" mt={0.5}>
                          <Typography variant="caption" color="text.secondary">
                            From:
                          </Typography>
                          <Tooltip title={item.previousOwner}>
                            <Link
                              href={`https://xrpl.org/accounts/${item.previousOwner}`}
                              target="_blank"
                              rel="noopener"
                              underline="hover"
                              variant="caption"
                            >
                              {shortenAddress(item.previousOwner)}
                            </Link>
                          </Tooltip>
                        </Stack>
                      )}
                      
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                          To:
                        </Typography>
                        <Tooltip title={item.newOwner}>
                          <Link
                            href={`https://xrpl.org/accounts/${item.newOwner}`}
                            target="_blank"
                            rel="noopener"
                            underline="hover"
                            variant="caption"
                          >
                            {shortenAddress(item.newOwner)}
                          </Link>
                        </Tooltip>
                        {item.newOwner.toLowerCase() === currentOwner.toLowerCase() && (
                          <Chip label="You" size="small" color="primary" sx={{ height: 16 }} />
                        )}
                      </Stack>
                      
                      {item.transactionHash && (
                        <Stack direction="row" spacing={0.5} alignItems="center" mt={0.5}>
                          <Typography variant="caption" color="text.secondary">
                            TX:
                          </Typography>
                          <Link
                            href={`https://xrpl.org/transactions/${item.transactionHash}`}
                            target="_blank"
                            rel="noopener"
                            underline="hover"
                            variant="caption"
                          >
                            {shortenAddress(item.transactionHash)}
                            <OpenInNewIcon sx={{ fontSize: 10, ml: 0.3 }} />
                          </Link>
                        </Stack>
                      )}

                      <Stack direction="row" spacing={1} mt={0.5}>
                        <Chip
                          label={`Power: ${item.powerLevel}`}
                          size="small"
                          sx={{ height: 18 }}
                        />
                        <Chip
                          label={item.status}
                          size="small"
                          color={item.status === 'active' ? 'success' : 'default'}
                          sx={{ height: 18 }}
                        />
                      </Stack>
                    </Box>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>

            {history.length > 3 && (
              <Box textAlign="center" mt={2}>
                <IconButton
                  onClick={() => setExpanded(!expanded)}
                  sx={{
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
                    transition: 'transform 0.3s',
                  }}
                >
                  <ExpandMoreIcon />
                </IconButton>
                <Typography variant="caption" color="text.secondary" display="block">
                  {expanded ? 'Show less' : `Show ${history.length - 3} more events`}
                </Typography>
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
