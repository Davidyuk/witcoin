import React from 'react';

import Action from './Action';

export default class ActionList extends React.Component {
  render() {
    const actions = this.props.actions;

    return (
      <div>
        <div className="list-group">
          {actions && actions.length ? actions.map(item =>
            <Action action={item} key={item._id} isNotification={this.props.isNotifications} />
          ) : <i>Нет {this.props.isNotifications ? 'уведомлений' : 'действий'}</i>}
        </div>
        <div className="progress" style={{display: this.props.actionsLoading ? 'block' : 'none'}}>
          <div className="progress-bar progress-bar-striped active" style={{width: '100%'}} />
        </div>
      </div>
    );
  }
}

ActionList.propTypes = {
  actions: React.PropTypes.array,
  actionsCount: React.PropTypes.number,
  actionsLoading: React.PropTypes.bool.isRequired,
  isNotifications: React.PropTypes.bool,
};
