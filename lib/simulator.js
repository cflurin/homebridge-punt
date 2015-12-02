'use strict';

var path = require('path');
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
  this.connection = false;
  this.ws;
}

Simulator.prototype.startServer = function() {

  var public_index = path.join(__dirname, '../public/simulator');
  app.use(express.static(public_index));
  var public_dir = path.join(__dirname, '../public');
  //this.log("dir %s", public_dir);
  app.use(express.static(public_dir));


  var server = http.createServer(app);
  server.listen(this.port, function() {
    this.log("Simulator is running on port %s", server.address().port);
  }.bind(this));

  var wss = new WebSocketServer({server: server});
  
  wss.on('connection', function(ws) {
      
    this.ws = ws;
    this.connection = true;
    this.log("Simulator client ip %s connected", ws.upgradeReq.connection.remoteAddress);
    
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
    
    ws.on('close', function close() {
      this.log("Simulator client ip %s disconnected", ws.upgradeReq.connection.remoteAddress);
      this.connection = false;
    }.bind(this));
    
    ws.on('message', function message(data) {
      //this.log("Simulator received: %s", data);
      var data = JSON.parse(data);
      this.setValue(data);
    }.bind(this));
    
  }.bind(this));
}

Simulator.prototype.setValue = function(data) {

  var t_characteristic = data.characteristic;
  var index = data.index;
  //this.log("Simulator received: %s %s %s %s", this.Accessories[index].module.name, index, t_characteristic, data.value);
  
  switch(t_characteristic) {
    case "On":
      if (value !=  this.Accessories[index].i_value[t_characteristic]) {
        this.Accessories[index].i_value[t_characteristic] = data.value;
        this.Accessories[index].i_characteristic[t_characteristic].setValue(data.value);
      }
      break;
    case "OutletInUse":
      if (value !=  this.Accessories[index].i_value[t_characteristic]) {
        this.Accessories[index].i_value[t_characteristic] = data.value;      
        this.Accessories[index].i_characteristic[t_characteristic].setValue(data.value);
      }
      break;
    case "CurrentTemperature":
      var value = parseFloat(data.value);
      if (value !=  this.Accessories[index].i_value[t_characteristic]) {
        this.Accessories[index].i_value[t_characteristic] = value;
        this.Accessories[index].i_characteristic[t_characteristic].setValue(value);
      }
      break;
    case "CurrentPosition":
    case "PositionState":
    case "Brightness":
    case "Hue":
    case "Saturation":
    case "TargetPosition":
    case "ContactSensorState":
    case "CurrentHorizontalTiltAngle":
    case "TargetHorizontalTiltAngle":
      var value = parseInt(data.value);
      if (value !=  this.Accessories[index].i_value[t_characteristic]) {
        this.Accessories[index].i_value[t_characteristic] = value;
        this.Accessories[index].i_characteristic[t_characteristic].setValue(value);
      }
      break;
    default:
      this.log("Simulator t_characteristic undefined %s %s %s", t_characteristic, index, data.value);
  }
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
    var data = {"label": {"data_type": "accessory", "index": index}, "accessories": []};
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
    var data = {"label": {"data_type": "accessory", "index": index}, "accessory": i_data};
  }

  this.sendData(data);
}

Simulator.prototype.sendData = function(data) {

  if (this.connection && this.ws.OPEN) {
    var j_data = JSON.stringify(data);
    //this.log("Simulator data %s", j_data);
    
    this.ws.send(j_data, function ack(error) {
      if (error) this.log("Simulator %s", error);
    }.bind(this));
  }
}
