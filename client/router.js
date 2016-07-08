import { Orders } from '../orders/orders.js';
import './app.html';
import { Template } from 'meteor/templating';
import { Mongo } from 'meteor/mongo';
import { ReactiveVar } from 'meteor/reactive-var';

Router.configure({
    layoutTemplate: 'mainLayout'
});

Router.route('/',function(){
  Session.set("joining", false);
  this.render("home");
});

Router.route('/newHost', function(){
  this.render("newHost");
});

Router.route('/host/:_id',{
  loadingTemplate: 'loading',
  waitOn: function () {
    // return one handle, a function, or an array
    return Meteor.subscribe('orders');
  },
  action: function () {
    var params = this.params; // { _id: "5" }
    room_id = params._id;
    room_id = parseInt(room_id);
    this.render('host', {
        data: function () {
          return {number:room_id,
          orders: Orders.find({"room":room_id}).fetch()[0].orders}
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
      Router.go('/host/'+id);
  },
});

Template.order.events({
  'submit .new-order'(event) {
    event.preventDefault();
    const target = event.target;
    const text = target.text.value; // gets order
    const price = target.price.value; // gets price (later wont be an input but will be calculated by selected options)
    var room_id = (Orders.find({"room":Session.get("roomId")}).fetch()[0]._id);
    var orders_array = (Orders.find({"_id":room_id}).fetch()[0].orders);
    console.log(room_id);
    orders_array.push({text:text, price:parseInt(price)});
    console.log(orders_array);
    Orders.update({"_id":room_id},{$set:{"orders":orders_array}});
  },
});

Template.home.events({
  'click .new-host-link'(event) {
    event.preventDefault();
    Router.go('/newHost');
  },

  'click .join-link'(event) {
    event.preventDefault();
    Session.set("joining", true);
  },

  'submit .join-room'(event) {
    event.preventDefault();
    const target = event.target;
    const text = target.text.value;
    Router.go('/'+text);
  }
});

Template.home.helpers({
  joining() {
    return Session.get("joining");
  }
})