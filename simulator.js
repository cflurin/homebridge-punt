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
    
    var data = {"label": {
        "plugin": this.plugin_name,
        "version": Utils.getPluginVersion(),
        "latest": Utils.get_npmVersion(this.plugin_name)
      }
    };
    
    this.sendData(data);
    this.refresh();
    
    ws.on('open', function open() {
      this.log("Simulator open");
    }.bind(this));
    
    ws.on('message', function incoming(data) {
      //this.log("Simulator received: %s", JSON.stringify(data));
      data = JSON.parse(data);
      var t_characteristic = data.characteristic;
      //this.log("Simulator received: %s %s %s", data.item, t_characteristic, data.value);
      
      //if (this.Accessories[data.item].i_value[t_characteristic]) {
        if (this.gateway.run) { 
          this.Accessories[data.item].Gateway.set(t_characteristic, data.value, function() {
            // nothing
          });
        }
        else {
          // todo t_characteristic
          this.Accessories[data.item].i_value.On = data.value;        
          this.Accessories[data.item].i_characteristic.On.setValue(data.value);
        }
      //} // else todo
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
    data.push(i_data);
  }
  this.sendData(data);
}

Simulator.prototype.sendData = function(data) {

  if (this.connection.on) {
    var j_data = JSON.stringify(data);
    //this.log("Simulator data %s", j_data);
    this.connection.ws.send(j_data, function ack(error) {
      if (error) this.log("Simulator error %s", error);
    }.bind(this));
  }
}




