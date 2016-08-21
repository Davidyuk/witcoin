import React from 'react';
import { Router, Route, IndexRoute, browserHistory } from 'react-router';

import AppContainer from '../../ui/containers/AppContainer';
import HomePageContainer from '../../ui/containers/HomePageContainer';

export const renderRoutes = () => (
  <Router history={browserHistory}>
    <Route path="/" component={AppContainer}>
      <IndexRoute component={HomePageContainer} />
    </Route>
  </Router>
);
