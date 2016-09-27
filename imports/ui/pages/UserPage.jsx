import { Meteor } from 'meteor/meteor';
import React from 'react';

import NotFoundPage from '../pages/NotFoundPage.jsx';
import UserName from '../components/UserName';
import ActionListContainer from '../containers/ActionListContainer';
import MessageInput from '../components/MessageInput';

export default class UserPage extends React.Component {
  goToChat() {
    Meteor.call('chat.get', [this.props.user._id], (err, chatId) => {
      if (err || !chatId) alert(err || 'Неизвестная ошибка');
      else this.context.router.push('/im/' + chatId);
    });
  }

  createAction(content) {
    Meteor.call('action.create', content);
  }

  render() {
    if (!this.props.user)
      return <NotFoundPage/>;

    return (
      <div className="row">
        <div className="col-md-4">
          <h3>
            <UserName user={this.props.user}/>
          </h3>
          {this.props.user._id != Meteor.userId() ? (
            <button className="btn btn-default btn-sm" onClick={this.goToChat.bind(this)}>
              <span className="glyphicon glyphicon-send"/>&nbsp;
              Написать сообщение
            </button>
          ) : null}
        </div>
        <div className="col-md-8">
          { this.props.user._id == Meteor.userId() ?
            <MessageInput handler={this.createAction} placeholder="Текст записи" />
          : null }
          <ActionListContainer selector={{ userId: this.props.user._id }}/>
        </div>
      </div>
    );
  }
}

UserPage.propTypes = {
  user: React.PropTypes.object,
};

UserPage.contextTypes = {
  router: React.PropTypes.object,
};
