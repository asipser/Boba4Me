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

Router.route('/newHost',{
  loadingTemplate: 'loading',
  waitOn: function () {
    // return one handle, a function, or an array
    return Meteor.subscribe('orders');
  },
  action: function () {
    this.render("newHost");
  }
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
  onBeforeAction: function () { // checks if order has run out of time (if it does it immediately ports to postUserOrder screen!)
    var params = this.params; 
    target_id = parseInt(params._id);
    if(Orders.find({"room":target_id}).count() <= 0){
      Router.go('/');
    }
    else if(Orders.find({"room":target_id}).fetch()[0].completed){
      Router.go("/postUserOrder/" + target_id);
    }
    else
      this.next();
  },
  action: function () {
    var params = this.params;
    target_id = params._id;
    Session.set('roomId', parseInt(target_id));
    var order = (Orders.find({"room":parseInt(target_id)}).fetch()[0]);
    var ordersLeft = order.maxOrders - order.orders.length;
    this.render("order",{
      data: function () {
        return {numOrders:ordersLeft, // sends the order template how many orders are left to be placed and if there is space for more orders to be placed!
                ordersLeft: ordersLeft > 0}
      }
    });
  }
});

Template.newHost.events({ // need to stop enter from submitting form probably?
  'submit .create-room-form'(event) {
      event.preventDefault();
      const target = event.target;
      const where = target.where.value; // gets place ordering from
      const maxOrders = parseInt(target.maxOrders.value); // gets max # of orders
      const secretWord = target.secretHost.value;
      console.log("" === target.secretHost.value);
      var startTime = new Date();
      var endTime = timestringToDate(target.when.value, new Date());
      console.log(endTime);
      var id = Math.floor(Math.random()*10000);
      while(Orders.find({"room":id}).count() > 0){ // check to make sure duplicate room not created!
        id = Math.floor(Math.random()*10000);
      }
      Session.set('roomId', id);
      console.log("Generated room with id " + id);
      Orders.insert({
        room:id,
        orders:new Array(),
        createdAt: startTime, // current time, needed to see room length
        endTime: endTime, // end date time!,
        place: where, // where people choose to eat,
        maxOrders:maxOrders,
        delivery:0, // needs to be an integer
        tip:0, // 
        secretWord:secretWord,
        completed:false,
        completedTime:undefined
      });
        Router.go('/host/'+id);
  },
});

// set default order ending time to 15 min from now
Template.newHost.onRendered(function() {
  const now = new Date();
  const MINUTES_OFFSET = 15;
  $("#when").val(dateToInputString(new Date(new Date().setMinutes(now.getMinutes() + MINUTES_OFFSET)))); 
})

Template.host.events({
  'submit .host-modify-room'(event){
    event.preventDefault();
    const target = event.target;
    const delivery = parseInt(target.delivery.value);
    const tip = parseInt(target.tip.value);

    var room_id = (Orders.find({"room":Session.get("roomId")}).fetch()[0]._id);
    Orders.update({"_id":room_id},{$set:{"delivery":delivery,"tip":tip}});

    // target.delivery.disabled = true;
    // target.tip.disabled = true;
    //hide button somehow?

  },
  'click .cancel'(event){
    event.preventDefault();
    console.log(event);
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
    Router.go("/postUserOrder/"+Session.get("roomId"));
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
});

Router.route('postUserOrder/:_id',{
  loadingTemplate: 'loading',
  waitOn: function () {
    // return one handle, a function, or an array
    return Meteor.subscribe('orders');
  },
  action: function () {
    var params = this.params; 
    target_id = params._id;
    var order = Orders.find({"room":parseInt(target_id)}).fetch()[0];
    //Session.set("t",getTimeRemaining(order.endTime));
    timeinterval = setInterval(function () {
      var t = getTimeRemaining(Orders,order.endTime);
      Session.set("t", t);
    }, 1000);
    Session.set("t",getTimeRemaining(Orders,order.endTime));
    this.render('postUserOrder', {
        data: function (){
          return {minutes:Session.get("t").minutes,
                  seconds:Session.get("t").seconds,
                  ended:Session.get("t").total <=0}
        }
    });
  }
});

function getTimeRemaining(Orders,endtime){
  var curr_date = new Date();
  var t = endtime.getTime() - curr_date.getTime();
  var seconds = ("0" + Math.floor( (t/1000) % 60 )).slice(-2);
  var minutes = ("0" + Math.floor( (t/1000/60) % 60 )).slice(-2);
  var hours = ("0" + Math.floor( (t/(1000*60*60)) % 24 )).slice(-2);
  var days = Math.floor( t/(1000*60*60*24) );

  console.log(t)
  if(t <= 0){
    clearInterval(timeinterval);
    var order_id = (Orders.find({"endTime":endtime}).fetch()[0]._id);
    Orders.update({"_id":order_id},{$set:{"completed":true}});
  }

  return {
    'total': t,
    'days': days,
    'hours': hours,
    'minutes': minutes,
    'seconds': seconds
  };

}

// outputs string like "15:25"
var dateToInputString = (date) => {
  return bufferWithZeroes(String(date.getHours()), 2)
    + ":" + bufferWithZeroes(String(date.getMinutes()), 2);
}

var timestringToDate = (timestring, date) => {
  return new Date(String(date.getFullYear()) 
      + "-" + bufferWithZeroes(String(date.getMonth() + 1), 2) // months are 0-indexed
      + "-" + bufferWithZeroes(String(date.getDate()), 2)
      + "T" + timestring)
}

// buffers the front of @input with zeroes to make it @desiredLength
var bufferWithZeroes = (input, desiredLength) => {
  var output = input;
  while (output.length < desiredLength) {
    output = "0" + output;
  }
  return output;
}