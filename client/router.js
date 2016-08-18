import { Orders } from '../orders/orders.js';
import './app.html';
import { Template } from 'meteor/templating';
import { Mongo } from 'meteor/mongo';
import { ReactiveVar } from 'meteor/reactive-var';
import { STORES, STORE_NAMES } from './stores.js';
import toastr from 'toastr';

const _STORES = STORES;
const _STORE_NAMES = STORE_NAMES;
var timeinterval;
// use as MONEY_FORMATTER.format(100)
const MONEY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
}); 
Router.configure({
    layoutTemplate: 'mainLayout'
});
toastr.options = {
  "closeButton": false,
  "debug": false,
  "newestOnTop": false,
  "progressBar": false,
  "positionClass": "toast-bottom-center",
  "preventDuplicates": false,
  "onclick": null,
  "showDuration": "300",
  "hideDuration": "1000",
  "timeOut": "1000",
  "extendedTimeOut": "1000",
  "showEasing": "swing",
  "hideEasing": "linear",
  "showMethod": "fadeIn",
  "hideMethod": "fadeOut"
}
Router.route('/',function(){
  Session.set("joining", false);
  Session.set("editing",false); // needed incase in modify screen user changes url to another page
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
    order = Orders.find({"room":room_id}).fetch()[0];
    if(order.secretWord != "" && Session.get("secretWord") != order.secretWord){
      var word = prompt("Please enter in the secret word:");
      if(word != order.secretWord){
        toastr["error"]("Wrong word!");
        Router.go("/");
      }
      else
        Session.setPersistent("secretWord", word)
    }
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
    Session.set("roomId",target_id);
    if(Orders.find({"room":target_id}).count() <= 0){
      toastr["error"]("Wrong room #!");
      Router.go('/');
    }
    else if(Orders.find({"room":target_id}).fetch()[0].completed){
      toastr["info"]("Order has ended. Moving to recipet page");
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
                store: order.place,
                editing:Session.get("editing")
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
      Session.setPersistent("secretWord", secretWord);
      console.log("Generated room with id " + id);
      Orders.insert({
        room:id,
        orders:new Array(),
        createdAt: startTime, // current time, needed to see room length
        endTime: endTime, // end date time!,
        place: where, // where people choose to eat,
        maxOrders:maxOrders,
        delivery:4, // needs to be an integer
        tip:.1, // 
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
  this.id = new ReactiveVar(this.data.order_id);
  console.log(this);
});

Template.user_order_entry.onCreated(function(){
  this.id = new ReactiveVar(this.data.order_id);
});


Template.order_entry.helpers({
  sizeAbbreviation(size) {
    return size[0];
  },

  toppingsText(toppings) {
    return toppings.join(", ");
  },

  parseToID(name, drink) {
    return (name+drink).replace(/\s/g, "X");
  },
  status: function() {
    console.log(this.changed);
    var status = this.changed;
    if(status){
      var input_id = this.name + this.drink;
      input_id = input_id.replace(/\s/g, "X");
      var input = $('#'+input_id)[0];
      if(input){
        console.log(input.checked);
        input.checked = false;
        $label = $("label[for='"+input_id+"']");
        Template.instance().firstNode.style.opacity = 1;
        $label.html("");
      toastr["warning"](this.name + " has changed their order!")
      }
      return "changed";
    }
    else
      return "default";
  },
  changed:function(item){
    var changed = this.changed_items[item];
    if(changed)
      return "changed";
    else
      return "default";
  },
  ended:function(){
    return Template.parentData().ended;
  },
  updatedPrice(price){
    var parentData= Template.parentData();
    console.log(parentData);
    var tip = parentData.tip;
    var delivery = parentData.delivery;
    var length = parentData.num_orders;
    // for(var i=0;i<orders.length;i++){
    //   var price = orders[i]['price'];
    //   // What is correct tax amount? I think food is 6.5, but sales is 6.25%...
    //   orders[i]['price'] = +((price * 1.065) + (price * (order.tip||0)) + ((order.delivery||0)/orders.length)).toFixed(2);
    // }
    return +((price * 1.065) + (price * (tip||0)) + ((delivery||0)/length)).toFixed(2)
  },


})

Template.user_order_entry.inheritsHelpersFrom("order_entry");

Template.order_entry.events({
  'click .cancel'(event,temp){
    event.preventDefault();
    //console.log(temp);
    var order_id = temp.id.get();
    console.log(order_id);
    //console.log(order_id);
    var room_id = (Orders.find({"room":Session.get("roomId")}).fetch()[0]._id); // gets database ID needed for $set
    var orders_array = (Orders.find({"_id":room_id}).fetch()[0].orders);
    for(var i=0; i<orders_array.length;i++){
      if(orders_array[i].order_id == order_id){
        if(i != orders_array.length-1)
          temp.id.set(orders_array[i+1].order_id);
        orders_array.splice(i,1);
      }
    }
    //console.log(orders_array);
    Orders.update({"_id":room_id},{$set:{"orders":orders_array}});
    //console.log(Orders.find({"room":Session.get("roomId")}).fetch()[0]);

  },
  'click .edit'(event){
    var order_id = Template.instance().id.get();
    var room_id = (Orders.find({"room":Session.get("roomId")}).fetch()[0]._id); // gets database ID needed for $set
    var orders_array = (Orders.find({"_id":room_id}).fetch()[0].orders);    
    var user_order;
    var user_order_index=0;
    console.log(orders_array);
    for(var i=0; i<orders_array.length;i++){
      if(orders_array[i].order_id == order_id){
        user_order=orders_array[i];
        user_order_index=i;
      }
    }
    Session.set("order_id", order_id);// used for when in the modify mode of /order it can see which order it is changing
    Session.set("drink",user_order['drink']);
    Session.set("name",user_order['name']);
    Session.set("size",user_order['size']);
    Session.set("toppings",user_order['toppings']);
    Session.set("sugar",user_order['sugar']);
    Session.set("ice",user_order['ice']);
    Session.set("price",user_order['price']);
    Session.set("editing",true);
    Router.go("/"+Session.get("roomId"));
  },
  'click .fade'(event){
    var temp = Template.instance().firstNode;
    var order_id = (Template.instance().id.get());
    $label = $("label[for='"+$(event.target).attr('id')+"']");
    console.log(event.target.checked);
    if(!event.target.checked){
      temp.style.opacity = 1;
      $label.html("");
    }
    else{
      temp.style.opacity =.5;
      $label.html("<i class='icon ion-checkmark'></i>");
      var room_id = (Orders.find({"room":Session.get("roomId")}).fetch()[0]._id);
      var orders = (Orders.find({"room":Session.get("roomId")}).fetch()[0].orders);
      for(var i=0;i<orders.length;i++){
        if(orders[i]['order_id'] == order_id)
          orders[i]['changed'] = false;
          orders[i]['changed_items'] = {};
      }
      console.log(orders);
      Orders.update({"_id":room_id},{$set:{"orders":orders}});
    }
  }
});
Template.user_order_entry.inheritsEventsFrom("order_entry");

Template.host.events({
  'submit .host-modify-room'(event){
    event.preventDefault();
    const target = event.target;
    const delivery = (parseFloat(target.delivery.value) || 4.0);
    const tip = (parseFloat(target.tip.value)/100 || .1); // expected entry is a percent

    var room_id = (Orders.find({"room":Session.get("roomId")}).fetch()[0]._id);
    Orders.update({"_id":room_id},{$set:{"delivery":delivery,"tip":tip}});

    // target.delivery.disabled = true;
    // target.tip.disabled = true;
    //hide button somehow?

  },
  'click .end-order'(event){
    //toastr['success']('Event Closed!');
    console.log('hello');
    var room_id = (Orders.find({"room":Session.get("roomId")}).fetch()[0]._id);
    Orders.update({"_id":room_id},{$set:{"endTime":new Date(),"completed":true}});   
  },
  'click .extend-order'(event){

    var order = (Orders.find({"room":Session.get("roomId")}).fetch()[0]);
    toastr['success']('Added 5 Minutes to time left!');
    Orders.update({"_id":order._id},{$set:{"endTime":new Date(order.endTime.getTime() + 5*60000),"completed":false}});   
  }

});

Template.order.onCreated(function(){ 
  this.selectedDrink = new ReactiveVar(_STORES[this.data.store].menu[0].items[0].name);
  this.selectedCategoryIndex = new ReactiveVar(0);
  var categoryIndex =0;
  var t = {};
  var selectedSize = "Medium$3.00";
  var price = 3.0;
  _STORES[this.data.store].toppings.forEach(function(item) {
    t[item.name] = false;
  })
  t["Bubbles"]=true;
  if(Session.get("editing")){
    for(var i=0;i<Session.get("toppings").length;i++){
     t[Session.get("toppings")[i]]=true;
    }
    price = Session.get("price")-.5*Session.get("toppings").length;
    selectedSize=Session.get("size") + '$' + price;
    this.selectedDrink.set(Session.get("drink"));
    var categories = _STORES[this.data.store].menu.map(function(obj){return {name:obj.name,items:obj.items.map(function(obj_ele){return obj_ele.name})}});
    for(var i=0;i<categories.length;i++){
      for(var j=0;j<categories[i]['items'].length;j++){
        if(Session.get('drink') == categories[i]['items'][j]){
          categoryIndex=i;
        }
      }
    }
    this.selectedCategoryIndex.set(categoryIndex);
  }
  this.selectedToppings = new ReactiveVar(t);
  this.selectedSize = new ReactiveVar(selectedSize);
  console.log(price);
  this.price = new ReactiveVar(price);
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

    $("#"+(Session.get("size")||"Medium"))[0].checked=true;
    $("#"+(Session.get("sugar") || "Regular Sugar").replace(" ", "X"))[0].checked=true;
    $("#"+(Session.get("ice") || "Regular Ice").replace(" ", "X"))[0].checked=true;

    if(Session.get("editing")){
      for(var i=0;i<Session.get("toppings").length;i++){
        $("#"+Session.get("toppings")[i].replace(" ", "X"))[0].checked=true;
      }
      $("#name_entry")[0].value = Session.get("name");
      $(".drink-select")[0].value=Session.get("drink");
    }
    else
      $("#Bubbles")[0].checked=true;

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
    console.log("store" + store + " catefory index: " + categoryIndex + " drink: " + drink + " index: " + drinkIndex);
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

Template.postUserOrder.events({
  'click #add-order'(event){
    Router.go('/'+Session.get("roomId"));
  }
});

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
    var changed_items = {};
    if(name != Session.get("name"))
      changed_items.name = true;
    if(drink != Session.get("drink"))
      changed_items.drink = true;
    if(JSON.stringify(toppings) != JSON.stringify(Session.get("toppings")))
      changed_items.toppings = true;
    if(size != Session.get("size"))
      changed_items.size = true;
    if(sugar != Session.get("sugar"))
      changed_items.sugar = true;
    if(ice != Session.get("ice"))
      changed_items.ice = true;
    console.log("changed items");
    console.log(changed_items);
    var room_id = (Orders.find({"room":Session.get("roomId")}).fetch()[0]._id);
    var orders_array = (Orders.find({"_id":room_id}).fetch()[0].orders);
    if(event.target.modify){
      for(var i=0; i<orders_array.length;i++){
        if(orders_array[i]['order_id'] == Session.get("order_id")){
          user_order=orders_array[i];
          console.log(user_order);
          user_order['name']=name;
          user_order['drink']=drink;
          user_order['size']=size;
          user_order['toppings']=toppings;
          user_order['sugar']=sugar;
          user_order['price']=price;
          user_order['ice']=ice;
          user_order['changed']=true;
          user_order['changed_items']=changed_items;
        }
      }
      Orders.update({"_id":room_id},{$set:{"orders":orders_array}});
      toastr["info"]("Order Modified!")
      Session.set("editing",false);
      Router.go("/postUserOrder/"+Session.get("roomId"));    
    }
    else{
      if(Session.get("orderer_id") === undefined)
        Session.setPersistent("orderer_id",guid());
      orders_array.push({
        name: name, 
        drink: drink,
        size: size,
        toppings: toppings,
        sugar: sugar,
        ice: ice,
        price: price, 
        order_id:guid(),
        orderer_id:Session.get("orderer_id"),
        changed:false, // used for when user clicks modify in postUserOrder. Host will then be able to seee modified orders.
        changed_items:{}
      });
      console.log(orders_array);
      Orders.update({"_id":room_id},{$set:{"orders":orders_array}});
      toastr["success"]("Order Submitted!")
      Router.go("/postUserOrder/"+Session.get("roomId"));
    }
  },
  'change .drink-select' (event, template) {
    template.selectedDrink.set(event.target.value);
    const store = this.store;
    const drink = event.target.value;
    console.log(event.target);
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
Template.postUserOrder.onCreated(function(){
    console.log("roomId: " + Session.get("roomId"));
    if(!timeinterval){
      timeinterval = setInterval(function () {
        var order_endtime = Orders.find({"room":parseInt(target_id)}).fetch()[0].endTime;
        var t = getTimeRemaining(order_endtime);
        Session.set("t", t);
      }, 1000);
    }
    else
      console.log("Countdown already in progress");
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
    Session.set("roomId",parseInt(target_id));
    var order = Orders.find({"room":parseInt(target_id)}).fetch()[0];
    if(Session.get("t") === undefined)
      Session.set("t",getTimeRemaining(order.endTime));
    var orders = order.orders;
    var user_orders = [];
    for(var i=0;i<orders.length;i++){
      if(orders[i]['orderer_id'] == Session.get("orderer_id")){
        user_orders.push(orders[i]);
      }
    }
    this.render('postUserOrder', {
        data: function (){
          return {
                  hours:Session.get("t").hours,
                  minutes:Session.get("t").minutes,
                  seconds:Session.get("t").seconds,
                  ended:Session.get("t").total <=0,
                  total:Session.get("t").total,
                  orders:user_orders,
                  num_orders:Math.max(orders.length,4),
                  tip:order.tip,
                  delivery:order.delivery
                }
        }
    });
  }
});

// Template.milkteaBG.helpers({
//   milktea(hours, minutes, seconds, total) {
//     const AMPLITUDE = 20;
//     const width = window.innerWidth;
//     var height = window.innerHeight;
//     const h = parseInt(hours);
//     const m = parseInt(minutes);
//     const s = parseInt(seconds);
//     if (!(h > 0 || h > 15)) {
//       height *= (m*60+s)/(60*15); // 15 minutes
//     }
//     const BASELINE = height - AMPLITUDE;
//     //const xoffset = Session.get("sineCounter");
//     const xoffset = total/10;
//     pointList = [[0, height].join(",")];
//     for (var i = 0; i <= width ; i++) {
//       var xval = i + xoffset;
//       pointList.push([i, height-(BASELINE + AMPLITUDE * Math.sin(6.28 * xval / width))].join(","));
//     }
//     pointList.push([width, height].join(","));
//     pointList.push([0, height].join(","));
//     //Session.set("sineCounter", xoffset+0.1);
//     return pointList.join(" ");
//   },

//   yOffset(hours, minutes, seconds) {
//     const width = window.innerWidth;
//     const height = window.innerHeight;
//     const h = parseInt(hours);
//     const m = parseInt(minutes);
//     const s = parseInt(seconds);
//     var pointList = [[0,0].join(",")];
//     if ((h > 0 || h > 15)) {
//       return 0;
//     } else {
//       return height - (height * (m*60+s)/(60*15));
//     }
//   }, 

//   straw() {
//     const width = window.innerWidth;
//     const height = window.innerHeight;
//     const STRAW_RADIUS = 50;
//     var pointList = [
//       [width*5/8 - STRAW_RADIUS, 0].join(","),
//       [width*5/8 + STRAW_RADIUS, 0].join(","),
//       [width*3/8 + STRAW_RADIUS, height].join(","),
//       [width*3/8 - STRAW_RADIUS, height].join(","),
//       [width*5/8 - STRAW_RADIUS, 0].join(",")
//     ];
//     return pointList.join(" ");
//   }
// });

function getTimeRemaining(endtime){
  var curr_date = new Date();
  var t = endtime.getTime() - curr_date.getTime();
  var seconds = ("0" + Math.floor( (t/1000) % 60 )).slice(-2);
  var minutes = ("0" + Math.floor( (t/1000/60) % 60 )).slice(-2);
  var hours = ("0" + Math.floor( (t/(1000*60*60)) % 24 )).slice(-2);
  var days = Math.floor( t/(1000*60*60*24) );
  if(t <= 0){
    //clearInterval(timeinterval);
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