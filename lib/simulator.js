'use strict';

var util = require('util');
var path = require('path');
var Utils = require('./utils.js').Utils;

var WebSocketServer = require('ws').Server,
  http = require('http'),
  express = require('express'),
  app = express();
  
module.exports = {
  Simulator: Simulator
}

function Simulator(log, p_config, plugin_name, Accessories) {

  this.log = log;
  this.p_config = p_config;
  this.port = p_config.simulator.port || {"port": "4080"};
  this.plugin_name = plugin_name;
  this.gateway = p_config.gateway;
  this.puntview = p_config.puntview || { "run": false };
  this.connection = false;
  this.ws;
  this.latest;
  this.Accessories = Accessories;
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
    this.latest = Utils.get_npmVersion(this.plugin_name);
    //this.log("Simulator.startServer %s", util.inspect(this.Accessories[0], {depth: 2}));

    this.refresh("all");
    
    this.data = {"label":
      {
        "data_type": "info",
        "plugin": this.plugin_name,
        "version": Utils.getPluginVersion(),
        "latest": this.latest,
        "port": this.port
      }
    };
    this.sendData(this.data);
            
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

  var value;
  var t_characteristic = data.characteristic;
  var index = data.index;
  //this.log("Simulator.onmessage: %s %s %s %s", this.Accessories[index].name, index, t_characteristic, data.value);

  switch(t_characteristic) {
    case "On":
    case "OutletInUse":
      value = data.value;
      break;
    case "CurrentTemperature":
      value = parseFloat(data.value);
      break;
    case "CurrentPosition":
    case "PositionState":
    case "Brightness":
    case "Hue":
    case "Saturation":
    case "SmokeDetected":
    case "TargetPosition":
    case "ContactSensorState":
    case "CurrentHorizontalTiltAngle":
    case "TargetHorizontalTiltAngle":
      value = parseInt(data.value);
      break;
    default:
      value = "undef";
      this.log("Simulator t_characteristic undefined %s %s %s", t_characteristic, index, data.value);
  }
  
  if (value != "undef" && value !=  this.Accessories[index].i_value[t_characteristic]) {
    this.Accessories[index].save_and_setValue("simulator", t_characteristic, value);
  }
}

Simulator.prototype.get = function(index, t_characteristic, callback, context) {

  //this.log("Simulator.get %s %s", t_characteristic, index);
  if (!this.gateway.run) {
    callback(null, this.Accessories[index].i_value[t_characteristic]);
  }
}

Simulator.prototype.set = function(index, t_characteristic, value, callback, context) {

  //this.log("Simulator.set %s %s %s", t_characteristic, index, value);
  if (!this.gateway.run) {
    this.Accessories[index].i_value[t_characteristic] = value;
    callback();
  }
}

Simulator.prototype.characteristic_change = function(index, objValue) {

  //this.log("Simulator.characteristic_change %s %s %s", index, JSON.stringify(objValue));
  var c = objValue.characteristic.displayName.replace(/\s/g, "");

  var value = objValue.newValue;
  
  if (this.Accessories.length > 0) {
    value = (c == "On") ? Utils.n2b(value) : value;
    this.Accessories[index].i_value[c] = value;
    //this.log("Simulator.c_change %s %s %s %s", index, this.Accessories[index].name, c, value);
    this.refresh(index, c);
  }
}

Simulator.prototype.refresh = function(index, c) {

  if (index == "all") {
    var data = {"label": {"data_type": "accessory", "index": index}, "accessories": []};
    for( var i = 0; i < this.Accessories.length; i++ ) {
      data.accessories.push(this.extract(i, c));
    }
  }
  else {
    var data = {"label": {"data_type": "accessory", "index": index}, "accessory": this.extract(index, c)};
  }
  this.sendData(data);
}

Simulator.prototype.extract = function(index, c) {
  // todo t_charachteristic
  var i_data = {
    "name": this.Accessories[index].name,
    "type": this.Accessories[index].i_device.type,
    "service": this.Accessories[index].service_name,
    "value": this.Accessories[index].i_value
  };
  return i_data;
}

Simulator.prototype.sendData = function(data) {

  if (this.connection && this.ws.OPEN) {
    var j_data = JSON.stringify(data);
    //this.log("Simulator.sendData %s", j_data);
    
    this.ws.send(j_data, function ack(error) {
      if (error) this.log("Simulator %s", error);
    }.bind(this));
  }
}
