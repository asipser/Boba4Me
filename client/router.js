FlowRouter.route('/', {
  action: function() {
    BlazeLayout.render("mainLayout", {content: "home"});
  }
});

FlowRouter.route('/host', {
  action: function() {
    BlazeLayout.render("mainLayout", {content: "newHost"});
  }
});

FlowRouter.route('/join', {
  action: function() {
    BlazeLayout.render("mainLayout", {content: "join"});
  }
});

FlowRouter.route('/:id', {
  action: function() {
    BlazeLayout.render("mainLayout", {content: "order"});
  }
});

FlowRouter.route('/host/:id', {
  action: function() {
    BlazeLayout.render("mainLayout", {content: "host"});
  }
});