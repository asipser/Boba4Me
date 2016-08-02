import { Orders } from '../orders/orders.js';
import './app.html';
import { Template } from 'meteor/templating';
import { Mongo } from 'meteor/mongo';
import { ReactiveVar } from 'meteor/reactive-var';
import { STORES, STORE_NAMES } from './stores.js';
const _STORES = STORES;
const _STORE_NAMES = STORE_NAMES;
// use as MONEY_FORMATTER.format(100)
const MONEY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
}); 
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
          console.log(order);
          for(var i=0;i<orders.length;i++){
            var price = orders[i]['price'];
            // What is correct tax amount? I think food is 6.5, but sales is 6.25%...
            orders[i]['price'] = +((price * 1.065) + (price * (order.tip||0)) + ((order.delivery||0)/orders.length)).toFixed(2);
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
    var store = Session.get('store');
    if (store) {
      console.log(store);
    } else {
      Session.set('store', _STORE_NAMES[0]);
    }
    this.render("order",{
      data: function () {
        return {numOrders:ordersLeft, // sends the order template how many orders are left to be placed and if there is space for more orders to be placed!
                ordersLeft: ordersLeft > 0,
                storeNames: _STORE_NAMES,
                stores: _STORES,
                store: order.place
              }
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
      var id = Orders.find().fetch().length;
      while(Orders.find({"room":id}).count() > 0){ // check to make sure duplicate room not created!
        id +=1;
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

Template.order.onCreated(function(){ 
  this.selectedDrink = new ReactiveVar(_STORES[this.data.store].menu[0].items[0].name);
  this.selectedCategoryIndex = new ReactiveVar(0);
  var t = {};
  _STORES[this.data.store].toppings.forEach(function(item) {
    t[item.name] = false;
  })
  this.selectedToppings = new ReactiveVar(t);
  this.selectedSize = new ReactiveVar('-$0');
  this.price = new ReactiveVar(0);
  $(window).resize(function() {
    var dim = Math.max($(".new-order").width(), $(".new-order").height());
    $(".background-circle.order-circle-1").width(dim);
    $(".background-circle.order-circle-1").height(dim);
    $(".background-circle.order-circle-1").css("margin-left", -dim/2);
  })
});

Template.order.onDestroyed(function() {
  $(window).off("resize");
})

Template.order.onRendered(function() {
    var dim = Math.max($(".new-order").width(), $(".new-order").height());
    $(".background-circle.order-circle-1").width(dim);
    $(".background-circle.order-circle-1").height(dim);
    $(".background-circle.order-circle-1").css("margin-left", -dim/2);
})

Template.order.helpers({
  selectedDrink: function() {
    return Template.instance().selectedDrink.get();
  },

  selectedCategoryIndex: function() {
    return Template.instance().selectedCategoryIndex.get();
  },

  selectedToppings: function() {
    return Template.instance().selectedToppings.get();
  },

  selectedSize: function() {
    return Template.instance().selectedSize.get();
  },

  price: function() {
    const t = Template.instance().selectedToppings.get();
    var toppingsPrice = 0;
    _STORES[this.store].toppings.forEach(function(item) {
      if (t[item.name]) {
        toppingsPrice += item.price;
      }
    })
    const sizePrice = parseFloat(Template.instance().selectedSize.get().split('$')[1]);
    Template.instance().price.set(toppingsPrice + sizePrice);
    return toppingsPrice + sizePrice
  },

  menu: function() {
    return _STORES[this.store].menu;
  },

  drinksPerCategory: function(category) {
    return category.items;
  },

  sizes: function() {
    const store = this.store;
    const categoryIndex = Template.instance().selectedCategoryIndex.get();
    const drink = Template.instance().selectedDrink.get();
    const drinkIndex = _STORES[store].menu[categoryIndex].items.findIndex(function(element){return element.name == drink});
    return _STORES[store].menu[categoryIndex].items[drinkIndex].sizes;
  },

  valueNamePrice: function(size) {
    return size.name + "$" + size.price;
  },

  displayPrice: function(price) {
    return MONEY_FORMATTER.format(price); 
  },

  toppings: function() {
    return _STORES[this.store].toppings;
  },

  sugars: function() {
    return _STORES[this.store].sugar;
  },

  ices: function() {
    return _STORES[this.store].ice;
  },

  parseToID: function(s) {
    return s.replace(/\s/g, "X");
  }
})

Template.order.events({
  'submit .new-order'(event, template) {
    event.preventDefault();
    const name = event.target.name.value;
    const drink = template.selectedDrink.get();
    var size = template.selectedSize.get();
    size = size.substring(0,size.indexOf('$'));
    const t = template.selectedToppings.get();
    const toppings = Object.keys(t).filter(function(item) {
      return t[item];
    })
    const sugar = event.target.sugar.value;
    const ice = event.target.ice.value;
    const price = template.price.get();

    Session.set("total_owed",(Session.get("total_owed") || 0) + parseFloat(price));

    var room_id = (Orders.find({"room":Session.get("roomId")}).fetch()[0]._id);
    var orders_array = (Orders.find({"_id":room_id}).fetch()[0].orders);
    orders_array.push({
      name: name, 
      drink: drink,
      size: size,
      toppings: toppings,
      sugar: sugar,
      ice: ice,
      price: price, 
      order_id:guid()
    });
    console.log(orders_array);
    Orders.update({"_id":room_id},{$set:{"orders":orders_array}});
    Router.go("/postUserOrder/"+Session.get("roomId"));
  },

  'change .drink-select' (event, template) {
    template.selectedDrink.set(event.target.value);
    const store = this.store;
    const drink = event.target.value;
    const categories = _STORES[store].menu.map(function(obj){return obj.name});
    const selectedCategory = event.target.selectedOptions[0].parentElement.label;
    const categoryIndex = categories.indexOf(selectedCategory);
    template.selectedCategoryIndex.set(categoryIndex);
    var size = template.selectedSize.get();
    const sizeName = size ? size.split('$')[0] : "";
    const items = _STORES[store].menu[categoryIndex].items;
    const drinkObj = items.find(function(item){return item.name == drink});
    const drinkSizes = drinkObj ? drinkObj.sizes : [];
    const sizeObj = drinkSizes.find(function(item){return item.name == sizeName}) || {'name': '-', 'price': 0}
    template.selectedSize.set(sizeObj.name+'$'+sizeObj.price);
  },

  'change input[name="size"]' (event, template) {
    template.selectedSize.set(event.target.value);
  },

  'change input[name="toppings"]' (event, template) {
    const topping = event.target.value.split("$")[0];
    var currentToppings = template.selectedToppings.get();
    currentToppings[topping] = event.target.checked;
    template.selectedToppings.set(currentToppings);
  }
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