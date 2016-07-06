import { Orders } from '../orders/orders.js';
import './app.html';
import { Template } from 'meteor/templating';
import { Mongo } from 'meteor/mongo';
import { ReactiveVar } from 'meteor/reactive-var';

Router.configure({
    layoutTemplate: 'mainLayout'
});

Router.route('/',function(){
  this.render("home");
});


Router.route('/newHost', function(){
  this.render("newHost");
});

Router.route('/join', function(){
  this.render("join");
});

Router.route('/host',{
  loadingTemplate: 'loading',
  waitOn: function () {
    // return one handle, a function, or an array
    return Meteor.subscribe('orders');
  },
  action: function () {
    this.render('host', {
        data: function () {
          return {number:Session.get("roomId"),
          orders: Orders.find({"room":Session.get("roomId")}).fetch()[0].orders}
        }
    });
  }
});

Router.route('/:_id',{
  loadingTemplate: 'loading',
  waitOn: function () {
    // return one handle, a function, or an array
    return Meteor.subscribe('orders');
  },
  action: function () {
    var params = this.params; // { _id: "5" }
    target_id = params._id;
    if(Orders.find({"room":parseInt(target_id)}).count() > 0){
      Session.set('roomId', parseInt(target_id));
      this.render("order");
    }
    else{
      Router.go('/');
    }
  }

});

Template.newHost.events({
  'click .new-room'(event) {
    // This is where one could add additional room settings.
    event.preventDefault();
    var id = Math.floor(Math.random()*10000);
    Session.set('roomId', id);
    console.log("Generated room with id " + id);
    Orders.insert({
      room:id,
      orders:new Array(),
      createdAt: new Date(), // current time, needed to see room length
    });
      Router.go('/host');
  },
});

Template.order.events({
  'submit .new-order'(event) {
    event.preventDefault();
    const target = event.target;
    const text = target.text.value;
    var room_id = (Orders.find({"room":Session.get("roomId")}).fetch()[0]._id);
    var orders_array = (Orders.find({"_id":room_id}).fetch()[0].orders);
    console.log(room_id);
    orders_array.push({text:text});
    console.log(orders_array);
    Orders.update({"_id":room_id},{$set:{"orders":orders_array}});
  },
});

Template.join.events({
  'submit .join-room'(event) {
    event.preventDefault();
    const target = event.target;
    const text = target.text.value;
    Router.go('/'+text);
  },
});