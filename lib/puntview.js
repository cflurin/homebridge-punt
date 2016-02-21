'use strict';

var util = require('util');
var path = require('path');
var Utils = require('./utils.js').Utils;
var port, plugin_name;
var connection, latest;
var accessories;

var WebSocketServer = require('ws').Server,
  http = require('http'),
  express = require('express'),
  app = express();
  
module.exports = {
  PuntView: PuntView
}

function PuntView(log, p_config, _plugin_name, _accessories) {

  this.log = log;
  port = p_config.puntview.port || {"port": "4040"};
  plugin_name = _plugin_name;
  accessories = _accessories;
  this.ws;
  connection = false;
}

PuntView.prototype.startServer = function() {

  var public_index = path.join(__dirname, '../public/puntview');
  app.use(express.static(public_index));
  var public_dir = path.join(__dirname, '../public');
  app.use(express.static(public_dir));
  
  var server = http.createServer(app);
  server.listen(port, function() {
    this.log("PuntView is running on port %s", server.address().port);
  }.bind(this));

  var wss = new WebSocketServer({server: server});
  
  wss.on('connection', function(ws) {
  
    this.ws = ws;
    connection = true;
    this.log("PuntView client ip %s connected", ws.upgradeReq.connection.remoteAddress);
    latest = Utils.get_npmVersion(plugin_name);
    
    this.refresh("all");

    this.data = {"label":
      {
        "data_type": "info",
        "plugin": plugin_name,
        "version": Utils.getPluginVersion(),
        "latest": latest,
        "port": port
      }
    };
    this.sendData(this.data);
    
    ws.on('open', function open() {
      this.log("PuntView open");
    }.bind(this));
    
    ws.on('close', function close() {
      this.log("PuntView client ip %s disconnected", ws.upgradeReq.connection.remoteAddress);
      connection = false;
    }.bind(this));
    
    ws.on('message', function message(data) {
      this.log("PuntView received: %s", data);
      var data = JSON.parse(data);
      //this.setValue(data);
    }.bind(this));
    
  }.bind(this));
}

PuntView.prototype.get = function(name, t_characteristic, callback) {
  this.log("PuntView.get not implemented %s %s", t_characteristic, name);
}

PuntView.prototype.set = function(name, t_characteristic, value, callback) {
  this.log("PuntView.set not implemented %s %s %s", t_characteristic, name, value);
}

PuntView.prototype.characteristic_change = function(name, objValue) {

  //this.log.debug("PuntView.characteristic_change %s %s", name, JSON.stringify(objValue.context));
  var c = objValue.characteristic.displayName.replace(/\s/g, "");
  
  if (accessories) {
    var value = (c == "On") ? Utils.n2b(objValue.newValue) : objValue.newValue;
    accessories[name].i_value[c] = value;
    this.refresh(name, c);
  }
}

PuntView.prototype.refresh = function(name, c) {

  var data = {"label": {"data_type": "accessory", "name": name}, "accessories": {} };
  
  if (name == "all") {
    var keys, c;
    var a_keys = Object.keys(accessories);

    for (var i in a_keys) {
      name = a_keys[i];
      keys = Object.keys(accessories[name].i_value);
      c = keys[0];
      data.accessories[name] = this.extract(name,c);
    }
  }
  else {
    data.accessories[name] = this.extract(name,c);
  }
  this.sendData(data);
}

PuntView.prototype.extract = function(name, c) {

  //this.log.debug("PuntView.extract %s %s", name, c);
  if (accessories[name] && accessories[name].i_label[c]) {
    var timestamp = accessories[name].i_label[c].timestamp;
    var trigger = accessories[name].i_label[c].trigger;
    //this.log.debug("PuntView.extract %s %s", JSON.stringify(accessories[name].i_label), timestamp);
  }
  
  var a = accessories[name];
  
  var i_data = {
    "name": (a.name) ? a.name : "",
    "type": (a.i_device.type) ? a.i_device.type : "simulator",
    "service": (a.service_name) ? a.service_name : "",
    "value": a.i_value,
    "trigger": trigger,
    "timestamp": timestamp
  };
  return i_data;
}

PuntView.prototype.sendData = function(data) {

  if (connection && this.ws.OPEN) {
    var j_data = JSON.stringify(data);
    //this.log.debug("PuntView.sendData %s", j_data);
    
    this.ws.send(j_data, function ack(error) {
      if (error) this.log("PuntView %s", error);
    }.bind(this));
  }
}
