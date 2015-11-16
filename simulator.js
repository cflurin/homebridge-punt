'use strict';

var Utils = require('./utils.js').Utils;
var Gateway = require('./gateway.js').Gateway;

var WebSocketServer = require('ws').Server,
  http = require('http'),
  express = require('express'),
  app = express();
  

module.exports = {
  Simulator: Simulator
}

function Simulator(log, p_config, Accessories, plugin_name) {

  this.log = log;
  this.p_config = p_config;
  this.Accessories = Accessories;
  this.port = p_config.simulator.port;
  this.plugin_name = plugin_name;
  this.gateway = p_config.gateway;
  this.connection = {};
}

Simulator.prototype.startServer = function() {

  app.use(express.static(__dirname + '/public'));

  var server = http.createServer(app);
  server.listen(this.port, function() {
    this.log("Simulator is running on port %s", server.address().port);
  }.bind(this));

  var wss = new WebSocketServer({server: server});
  
  wss.on('connection', function(ws) {
      
    this.connection.ws = ws;
    this.connection.on = true;
    //this.log("Simulator start");
    
    /*
    var data = {};
    data.plugin = this.plugin_name;
    data.version = Utils.getPluginVersion();
    data.latest = Utils.get_npmVersion(this.plugin_name);
    
    this.log("Simulator: data %s", JSON.stringify(data));
    ws.send(JSON.stringify(data));
    */
    this.refresh();
    
    ws.on('open', function open() {
      this.log("Simulator open");
    }.bind(this));
    
    ws.on('message', function incoming(data) {
      //this.log("Simulator received: %s", JSON.stringify(data));
      data = JSON.parse(data);
      var t_characteristic = data.characteristic;
      //this.log("Simulator received: %s %s", data.item, data.value);
      if (this.gateway.run) this.Accessories[data.item].Gateway.set(t_characteristic, data.value, function() {
        // nothing
      });
      this.Accessories[data.item].i_value[t_characteristic] = data.value;
      this.Accessories[data.item].i_characteristic[t_characteristic].setValue(data.value);
    }.bind(this));
    
    ws.on('close', function() {
      this.connection.on = false;
      //this.log("Simulator stop");
    }.bind(this));
    
  }.bind(this));
}

Simulator.prototype.get = function(t_characteristic, index, gateway, callback) {

  if (!gateway.run) {
    callback(null, this.Accessories[index].i_value[t_characteristic]);
    this.refresh();
  }
}

Simulator.prototype.set = function(t_characteristic, index, value, gateway, callback) {

  if (t_characteristic == "On") {
    value = (value == 0 || value == false) ? false : true;
  }

  this.Accessories[index].i_value[t_characteristic] = value;

  if (!gateway.run) {
    callback();
    this.refresh();
  }
}

Simulator.prototype.refresh = function() {

  var data = [];
  
  for( var i = 0; i < this.Accessories.length; i++ ) {
    var i_data = {};
    i_data.accessory = this.Accessories[i].name;
    
    //i_data.value = JSON.stringify(this.Accessories[i].i_value).replace('{', '').replace('}','');
    // todo select t_charachteristic
    i_data.value = JSON.stringify(this.Accessories[i].i_value.On); 
    //this.log("Simulator i_data %s", JSON.stringify(i_data));
    data.push(i_data);
  }
  
  var j_data = JSON.stringify(data);
  //this.log("Simulator data %s", j_data);
  
  if (this.connection.on) {
    this.connection.ws.send(j_data, function ack(error) {
      if (error) this.log("Simulator error %s", error);
    }.bind(this));
  }
}




