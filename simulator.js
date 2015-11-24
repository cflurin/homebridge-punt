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
    
    this.refresh("all");
    
    var data = {"label": {
        "plugin": this.plugin_name,
        "version": Utils.getPluginVersion(),
        "latest": Utils.get_npmVersion(this.plugin_name),
        "data_type": "info",    // [info, value]
        "index": ""             // [all, 0,1,2,...]
      }
    };
    
    this.sendData(data);
    
    ws.on('open', function open() {
      this.log("Simulator open");
    }.bind(this));
    
    ws.on('message', function incoming(data) {
      //this.log("Simulator received: %s", JSON.stringify(data));
      data = JSON.parse(data);
      var t_characteristic = data.characteristic;
      var index = data.index;
      //this.log("Simulator received: %s %s %s", index, t_characteristic, data.value);
      
      switch(t_characteristic) {
        case "On":
          if (this.gateway.run) { 
            this.Accessories[index].Gateway.set(t_characteristic, data.value, function() {
              // nothing
            });
          }
          else {
            this.Accessories[index].i_value[t_characteristic] = data.value;
            this.Accessories[index].i_characteristic[t_characteristic].setValue(data.value);
          }
          break;
        case "OutletInUse":
          this.Accessories[index].i_value[t_characteristic] = data.value;      
          this.Accessories[index].i_characteristic[t_characteristic].setValue(data.value);
          break;
        case "CurrentTemperature":
          var value = parseFloat(data.value);
          this.Accessories[index].i_value[t_characteristic] = value;
          this.Accessories[index].i_characteristic[t_characteristic].setValue(value);
          break;
        case "CurrentPosition":
        case "TargetPosition":
        case "ContactSensorState":
        case "PositionState":
        case "Brightness":
        case "Hue":
        case "Saturation":
          var value = parseInt(data.value);
          this.Accessories[index].i_value[t_characteristic] = value;
          this.Accessories[index].i_characteristic[t_characteristic].setValue(value);
          break;
        default:
      }
      
      this.refresh(index);
      
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
  }
}

Simulator.prototype.set = function(t_characteristic, index, value, gateway, callback) {

  //this.log("Simulator set %s %s", index, value);
  if (t_characteristic == "On") {
    value = (value == 0 || value == false) ? false : true;
  }

  this.Accessories[index].i_value[t_characteristic] = value;

  if (!gateway.run) {
    callback();
  }
  this.refresh(index);
}

Simulator.prototype.refresh = function(index) {

  if (index == "all") {
    var data = {"label": {"data_type": "value", "index": index}, "accessories": []};
    for( var i = 0; i < this.Accessories.length; i++ ) {
      var i_data = {
        "name": this.Accessories[i].name, 
        "service": this.Accessories[i].i_service, 
        "value": this.Accessories[i].i_value
      };
      data.accessories.push(i_data);
    }
  }
  else {
    var i_data = {
      "name": this.Accessories[index].name,
      "service": this.Accessories[index].i_service,
      "value": this.Accessories[index].i_value
    };
    var data = {"label": {"data_type": "value", "index": index}, "accessory": i_data};
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
