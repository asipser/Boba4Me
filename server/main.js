import { Meteor } from 'meteor/meteor';
import { Orders } from '../orders/orders.js';
import { Mongo } from 'meteor/mongo';

Meteor.startup(() => {

if (Meteor.isServer) {
  // This code only runs on the server
  Meteor.publish('orders', function ordersPublication() {
    return Orders.find();
  });
}
});
