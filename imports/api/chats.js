import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { Match, check } from 'meteor/check';

import { SchemaHelpers } from './common';
import faker from 'faker';

export const Chats = new Mongo.Collection('chats');

class MessagesCollection extends Mongo.Collection {
  insert(doc, callback) {
    const message = Messages.findOne(super.insert(doc, callback));
    Chats.update(message.chatId, {$set: {lastMessage: message}});
    return message._id;
  }
}

export const Messages = new MessagesCollection('messages');

Messages.schema = new SimpleSchema({
  _id: { type: String, regEx: SimpleSchema.RegEx.Id },
  chatId: { type: String, regEx: SimpleSchema.RegEx.Id },
  userId: { type: String, regEx: SimpleSchema.RegEx.Id },
  content: { type: String },
  isRead: { type: Boolean, defaultValue: false },
  isMailed: { type: Boolean, defaultValue: false },
  createdAt: SchemaHelpers.createdAt,
  updatedAt: SchemaHelpers.updatedAt,
  deletedAt: SchemaHelpers.deletedAt,
});

Messages.attachSchema(Messages.schema);

Chats.schema = new SimpleSchema({
  _id: { type: String, regEx: SimpleSchema.RegEx.Id },
  userIds: { type: [String], minCount: 1 },
  'userIds.$': { type: String, regEx: SimpleSchema.RegEx.Id },
  lastMessage: { type: new SimpleSchema({
    ...Messages.schema.schema(),
    createdAt: { type: Date },
    updatedAt: { type: Date, optional: true },
    deletedAt: { type: Date, optional: true },
  }), optional: true, defaultValue: null },
});

Chats.attachSchema(Chats.schema);

if (Meteor.isServer) {
  const getChatUsersCursor = chat => Meteor.users.find({_id: {$in: chat.userIds}}, {fields: Meteor.users.publicFields});

  Meteor.publishComposite('chats', function(limit) {
    check(limit, Number);

    if (!this.userId)
      return this.ready();

    let q = {
      userIds: this.userId,
      lastMessage: { $ne: null },
    };
    Counts.publish(this, 'chats', Chats.find(q));
    return {
      find: () => Chats.find(q, {
        sort: {'lastMessage.createdAt': -1},
        limit: limit,
      }),
      children: [
        { find: getChatUsersCursor },
        { find: chat => {
          Counts.publish(this, 'chats.' + chat._id,
            Messages.find({chatId: chat._id, userId: {$ne: this.userId}, isRead: false}));
          return null;
        } },
      ],
    };
  });

  Meteor.publishComposite('chat', function(chatId, limit) {
    check(chatId, String);
    check(limit, Number);

    if (!this.userId)
      return this.ready();
    let chat = Chats.findOne(chatId);
    if (!chat || chat.userIds.indexOf(this.userId) == -1)
      return this.ready();

    return {
      find: () => Chats.find({
        _id: chatId,
        userIds: this.userId,
      }),
      children: [
        { find: getChatUsersCursor },
        { find: chat => Messages.find({ chatId: chat._id }, { sort: {createdAt: -1}, limit: limit }) },
      ]
    };
  });

  Meteor.publish('chats.unread', function() {
    if (!this.userId) return this.ready();

    Counts.publish(this, 'chats.unread', Chats.find({
      userIds: this.userId,
      'lastMessage.userId': {$ne: this.userId},
      'lastMessage.isRead': false,
    }));
    return this.ready();
  });
}

Meteor.methods({
  'chat.get' (pairIds) {
    check(pairIds, [String]);
    check(pairIds, Match.Where(a => a.length));

    if (!this.userId)
      throw new Meteor.Error('not-authorized');

    const userIds = [this.userId, ...pairIds].sort();

    if (Meteor.users.find({_id: {'$in': userIds}}).count() != pairIds.length + 1)
      throw new Meteor.Error('invalid-user-ids');

    const chat = Chats.findOne({userIds});
    return chat ? chat._id : Chats.insert({userIds});
  },

  'message.create' (chatId, content) {
    check(chatId, String);
    check(content, String);
    check(content, Match.Where(a => a.length));

    if (!this.userId)
      throw new Meteor.Error('not-authorized');
    const chat = Chats.findOne(chatId);
    if (!chat)
      throw new Meteor.Error('chat-not-found');
    if (chat.userIds.indexOf(this.userId) == -1)
      throw new Meteor.Error('forbidden');

    Messages.insert({
      chatId,
      userId: this.userId,
      content,
    });
  },

  'message.edit' (messageId, content) {
    check(messageId, String);
    check(content, String);
    check(content, Match.Where(a => a.length));

    if (!this.userId)
      throw new Meteor.Error('not-authorized');
    const message = Messages.findOne(messageId);
    if (!message)
      throw new Meteor.Error('message-not-found');
    if (message.userId != this.userId)
      throw new Meteor.Error('forbidden');

    Messages.update(messageId, {$set: { content }});
  },

  'message.remove' (messageId) {
    check(messageId, String);

    if (!this.userId)
      throw new Meteor.Error('not-authorized');
    const message = Messages.findOne(messageId);
    if (!message)
      throw new Meteor.Error('message-not-found');
    if (message.userId != this.userId)
      throw new Meteor.Error('forbidden');

    Messages.update(messageId, {$set: { deletedAt: new Date() }});
  },

  'message.markAsRead' (chatId, messageIds) {
    check(chatId, String);
    check(messageIds, [String]);

    if (!this.userId)
      throw new Meteor.Error('not-authorized');
    const chat = Chats.findOne(chatId);
    if (!chat)
      throw new Meteor.Error('chat-not-found');
    if (!chat.userIds.includes(this.userId))
      throw new Meteor.Error('forbidden');

    Messages.update(
      {_id: {$in: messageIds}, userId: {$ne: this.userId}, chatId},
      {$set: {isRead: true}}, {multi: true}
    );
    Chats.update(
      {_id: chatId, 'lastMessage._id': {$in: messageIds}, 'lastMessage.userId': {$ne: this.userId}},
      {$set: {'lastMessage.isRead': true}}
    );
  },
});

Factory.define('chat', Chats, {
  userIds: [Factory.get('user'), Factory.get('user')],
});

Factory.define('message', Messages, {
  chatId: function() {
    return Meteor.users.findOne(this.userId)
      ? Factory.create('chat', {userIds: [this.userId, Factory.get('user')]})._id
      : Factory.get('chat');
  },
  content: () => faker.lorem.sentences(faker.random.number(8) + 1),
  createdAt: () => faker.date.past(),
  userId: function() {
    const chat = Chats.findOne(this.chatId);
    return chat
      ? chat.userIds[faker.random.number(chat.userIds.length - 1)]
      : Factory.get('user');
  },
});
