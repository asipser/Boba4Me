import { Orders } from '../orders/orders.js';
import './app.html';
import { Template } from 'meteor/templating';
import { Mongo } from 'meteor/mongo';
import { ReactiveVar } from 'meteor/reactive-var';
import { STORES } from './stores.js';

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
    var room_id = params._id;
    room_id = parseInt(room_id);
    Session.set("roomId",room_id);

    this.render('host', {
        data: function () {
          var order = Orders.find({"room":room_id}).fetch()[0];
          var orders = order.orders;
          for(var i=0;i<orders.length;i++){
            var price = orders[i]['price'];
            // What is correct tax amount? I think food is 6.5, but sales is 6.25%...
            orders[i]['price'] = (price * 1.065) + (price * order.tip) + (order.delivery/orders.length);
          }
          return {number:room_id,
          orders: orders} 
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


Template.order_entry.onCreated(function(){
  this.id = this.data.order_id;
});

Template.order_entry.events({
  'click .cancel'(event){
    event.preventDefault();
    var order_id = Template.instance().id;
    var room_id = (Orders.find({"room":Session.get("roomId")}).fetch()[0]._id); // gets database ID needed for $set
    var orders_array = (Orders.find({"_id":room_id}).fetch()[0].orders);

    var i = orders_array.indexOf("b");
    for(var i=0; i<orders_array.length;i++){
      if(orders_array[i].order_id == order_id)
        orders_array.splice(i,1);
    }
    Orders.update({"_id":room_id},{$set:{"orders":orders_array}});
  },
  'click .fade'(event){
    event.preventDefault();
    temp = Template.instance().firstNode;
    console.log(temp.style.opacity);
    if(temp.style.opacity <1){
      temp.style.opacity = 1;
    }
    else{
      temp.style.opacity =.5;
    }
  }
});

Template.host.events({
  'submit .host-modify-room'(event){
    event.preventDefault();
    const target = event.target;
    const delivery = parseFloat(target.delivery.value);
    const tip = parseFloat(target.tip.value)/100; // expected entry is a percent

    var room_id = (Orders.find({"room":Session.get("roomId")}).fetch()[0]._id);
    Orders.update({"_id":room_id},{$set:{"delivery":delivery,"tip":tip}});

    // target.delivery.disabled = true;
    // target.tip.disabled = true;
    //hide button somehow?

  }
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
    orders_array.push({text:text, price:parseInt(price), order_id:guid()});
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
    }, 100);
    Session.set("t",getTimeRemaining(Orders,order.endTime));
    var time = Session.get("t");
    this.render('postUserOrder', {
        data: function (){
          return {
                  hours:time.hours,
                  minutes:time.minutes,
                  seconds:time.seconds,
                  ended:time.total <=0,
                  total:time.total
                }
        }
    });
  }
});

Template.milkteaBG.helpers({
  milktea(hours, minutes, seconds, total) {
    const AMPLITUDE = 20;
    const width = window.innerWidth;
    var height = window.innerHeight;
    const h = parseInt(hours);
    const m = parseInt(minutes);
    const s = parseInt(seconds);
    if (!(h > 0 || h > 15)) {
      height *= (m*60+s)/(60*15); // 15 minutes
    }
    const BASELINE = height - AMPLITUDE;
    //const xoffset = Session.get("sineCounter");
    const xoffset = total/10;
    pointList = [[0, height].join(",")];
    for (var i = 0; i <= width ; i++) {
      var xval = i + xoffset;
      pointList.push([i, height-(BASELINE + AMPLITUDE * Math.sin(6.28 * xval / width))].join(","));
    }
    pointList.push([width, height].join(","));
    pointList.push([0, height].join(","));
    //Session.set("sineCounter", xoffset+0.1);
    return pointList.join(" ");
  },

  yOffset(hours, minutes, seconds) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const h = parseInt(hours);
    const m = parseInt(minutes);
    const s = parseInt(seconds);
    var pointList = [[0,0].join(",")];
    if ((h > 0 || h > 15)) {
      return 0;
    } else {
      return height - (height * (m*60+s)/(60*15));
    }
  }, 

  straw() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const STRAW_RADIUS = 50;
    var pointList = [
      [width*5/8 - STRAW_RADIUS, 0].join(","),
      [width*5/8 + STRAW_RADIUS, 0].join(","),
      [width*3/8 + STRAW_RADIUS, height].join(","),
      [width*3/8 - STRAW_RADIUS, height].join(","),
      [width*5/8 - STRAW_RADIUS, 0].join(",")
    ];
    return pointList.join(" ");
  }
});

function getTimeRemaining(Orders,endtime){
  var curr_date = new Date();
  var t = endtime.getTime() - curr_date.getTime();
  var seconds = ("0" + Math.floor( (t/1000) % 60 )).slice(-2);
  var minutes = ("0" + Math.floor( (t/1000/60) % 60 )).slice(-2);
  var hours = ("0" + Math.floor( (t/(1000*60*60)) % 24 )).slice(-2);
  var days = Math.floor( t/(1000*60*60*24) );

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

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}