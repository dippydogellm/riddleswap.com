import React from 'react';
import { Route, Switch, Redirect } from 'wouter';
import GamingDashboard from './Dashboard/GamingDashboard';
import BattlesList from './Battles/BattlesList';
import BattleCreate from './Battles/BattleCreate';
import BattleDetail from './Battles/BattleDetail';
import NFTScorecard from './NFTs/NFTScorecard';
import Leaderboards from './Scorecards/Leaderboards';

export default function Gaming() {
  return (
    <Switch>
      <Route path="/gaming" component={GamingDashboard} />
      <Route path="/gaming/dashboard" component={GamingDashboard} />
      <Route path="/gaming/battles" component={BattlesList} />
      <Route path="/gaming/battles/create" component={BattleCreate} />
      <Route path="/gaming/battles/:battleId" component={BattleDetail} />
      <Route path="/gaming/nfts/:nftId/scorecard" component={NFTScorecard} />
      <Route path="/gaming/scorecards" component={Leaderboards} />
      <Route path="/gaming/leaderboards" component={Leaderboards} />
      <Route path="/gaming/*">
        <Redirect to="/gaming" />
      </Route>
    </Switch>
  );
}
