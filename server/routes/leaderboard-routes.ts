/**
 * Leaderboard API Routes
 * Global leaderboards with percentage up/down indicators
 */

import { Router } from 'express';
import {
  getPlayerLeaderboard,
  getAllianceLeaderboard,
  getPlayerRankHistory,
  getAllianceRankHistory,
  updatePlayerLeaderboard,
  updateAllianceLeaderboard,
} from '../services/leaderboard-service';

const router = Router();

/**
 * GET /api/leaderboards/players
 * Get global player leaderboard with rank changes
 */
router.get('/players', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const leaderboard = await getPlayerLeaderboard(Number(limit));

    res.json({
      success: true,
      data: leaderboard.map(entry => ({
        player_handle: entry.player_handle,
        rank: entry.global_rank,
        previous_rank: entry.previous_rank,
        rank_change: entry.rank_change, // Positive = moved up
        rank_change_percentage: entry.rank_change_percentage, // % improvement
        total_power: entry.total_power,
        total_victories: entry.total_victories,
        total_defeats: entry.total_defeats,
        win_rate: entry.win_rate,
        recorded_at: entry.recorded_at,
      })),
    });
  } catch (error) {
    console.error('❌ [Leaderboard] Failed to fetch player leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch player leaderboard' });
  }
});

/**
 * GET /api/leaderboards/alliances
 * Get global alliance leaderboard with rank changes
 */
router.get('/alliances', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const leaderboard = await getAllianceLeaderboard(Number(limit));

    res.json({
      success: true,
      data: leaderboard.map(entry => ({
        alliance_id: entry.alliance_id,
        alliance_tag: entry.alliance_tag,
        rank: entry.global_rank,
        previous_rank: entry.previous_rank,
        rank_change: entry.rank_change,
        rank_change_percentage: entry.rank_change_percentage,
        total_power: entry.total_power,
        total_victories: entry.total_victories,
        total_defeats: entry.total_defeats,
        member_count: entry.member_count,
        recorded_at: entry.recorded_at,
      })),
    });
  } catch (error) {
    console.error('❌ [Leaderboard] Failed to fetch alliance leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch alliance leaderboard' });
  }
});

/**
 * GET /api/leaderboards/players/:playerHandle/history
 * Get rank history for a specific player
 */
router.get('/players/:playerHandle/history', async (req, res) => {
  try {
    const { playerHandle } = req.params;
    const { days = 7 } = req.query;

    const history = await getPlayerRankHistory(playerHandle, Number(days));

    res.json({
      success: true,
      player_handle: playerHandle,
      history: history.map(entry => ({
        rank: entry.global_rank,
        rank_change: entry.rank_change,
        rank_change_percentage: entry.rank_change_percentage,
        total_power: entry.total_power,
        recorded_at: entry.recorded_at,
      })),
    });
  } catch (error) {
    console.error('❌ [Leaderboard] Failed to fetch player rank history:', error);
    res.status(500).json({ error: 'Failed to fetch player rank history' });
  }
});

/**
 * GET /api/leaderboards/alliances/:allianceId/history
 * Get rank history for a specific alliance
 */
router.get('/alliances/:allianceId/history', async (req, res) => {
  try {
    const { allianceId } = req.params;
    const { days = 7 } = req.query;

    const history = await getAllianceRankHistory(allianceId, Number(days));

    res.json({
      success: true,
      alliance_id: allianceId,
      history: history.map(entry => ({
        rank: entry.global_rank,
        rank_change: entry.rank_change,
        rank_change_percentage: entry.rank_change_percentage,
        total_power: entry.total_power,
        member_count: entry.member_count,
        recorded_at: entry.recorded_at,
      })),
    });
  } catch (error) {
    console.error('❌ [Leaderboard] Failed to fetch alliance rank history:', error);
    res.status(500).json({ error: 'Failed to fetch alliance rank history' });
  }
});

/**
 * POST /api/leaderboards/update
 * Manually trigger leaderboard update (admin only, or scheduled)
 */
router.post('/update', async (req, res) => {
  try {
    console.log('🔄 [Leaderboard] Manual update triggered');

    const [playerResult, allianceResult] = await Promise.all([
      updatePlayerLeaderboard(),
      updateAllianceLeaderboard(),
    ]);

    res.json({
      success: true,
      players_updated: playerResult.playersUpdated,
      alliances_updated: allianceResult.alliancesUpdated,
    });
  } catch (error) {
    console.error('❌ [Leaderboard] Failed to update leaderboards:', error);
    res.status(500).json({ error: 'Failed to update leaderboards' });
  }
});

export default router;
