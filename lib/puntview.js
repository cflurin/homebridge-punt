'use strict';

var util = require('util');
var path = require('path');
var Utils = require('./utils.js').Utils;
var storagePath, plugin_name, config_name, port;
var connection, latest;
var accessories, reload;

var WebSocketServer = require('ws').Server,
  http = require('http'),
  express = require('express'),
  app = express();
  
module.exports = {
  PuntView: PuntView
}

function PuntView(params) {

  this.log = params.log;
  port = params.p_config.puntview.port || {"port": "4040"};
  storagePath = params.storagePath;
  plugin_name = params.plugin_name;
  config_name = params.config_name;
  accessories = params.accessories;
  reload = params.reload;
  
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

    var data = {"type": "info", "spec": 
      {
        "plugin": plugin_name,
        "version": Utils.getPluginVersion(),
        "latest": latest,
        "port": port
      }
    };
    this.sendData(data);
    
    ws.on('open', function open() {
      this.log("PuntView open");
    }.bind(this));
    
    ws.on('close', function close() {
      this.log("PuntView client ip %s disconnected", ws.upgradeReq.connection.remoteAddress);
      connection = false;
    }.bind(this));
    
    ws.on('message', function message(data) {
      //this.log.debug("PuntView received: %s", data);
      var r_data = JSON.parse(data);
      switch (r_data.type) {
        case "request":
          if (r_data.config == "plugin") {
            var p_config = Utils.loadConfig(storagePath, plugin_name, config_name);
            var s_data = {"type": "document", "content": p_config};
            this.sendData(s_data);
          }
          break;
        case "document":
          //this.log.debug("PuntView received: %s", JSON.stringify(r_data.content));
          Utils.saveConfig(storagePath, plugin_name, config_name, r_data.content);
          reload();
          break;
      }
    }.bind(this));
  }.bind(this));
}

PuntView.prototype.get = function(uuid, t_characteristic, callback) {

  this.log("PuntView.get not implemented %s %s", t_characteristic, name);
}

PuntView.prototype.set = function(uuid, t_characteristic, value, callback) {

  this.log("PuntView.set not implemented %s %s %s", t_characteristic, name, value);
}

PuntView.prototype.characteristic_change = function(uuid, objValue) {

  //this.log.debug("PuntView.characteristic_change %s %s", uuid, JSON.stringify(objValue));
  var c = objValue.characteristic.displayName.replace(/\s/g, "");
  
  if (accessories[uuid]) {
    var value = (c == "On") ? Utils.n2b(objValue.newValue) : objValue.newValue;
    accessories[uuid].i_value[c] = value;
    this.refresh(uuid, c);
  }
}

PuntView.prototype.delete_content = function() {

  var data = {"type": "command", "cmd_type": "delete"};
  this.sendData(data);
}

PuntView.prototype.refresh = function(uuid, c) {
  
  var data = {"type": "accessory", "accessories": {} };
  
  if (uuid == "all") {
    this.delete_content();
    
    for (var k in accessories) {
      //this.log.debug("PuntView.refresh %s",name);
      var c = Object.keys(accessories[k].i_value)[0];
      data.accessories[k] = this.extract(k, c);
    }
  }
  else {
    data.accessories[uuid] = this.extract(uuid, c);
  }
  this.sendData(data);
}

PuntView.prototype.extract = function(uuid, c) {

  //this.log.debug("PuntView.extract %s %s", name, c);
  if (accessories[uuid] && accessories[uuid].i_label[c]) {
    var timestamp = accessories[uuid].i_label[c].timestamp;
    var trigger = accessories[uuid].i_label[c].trigger;
    //this.log.debug("PuntView.extract %s %s", JSON.stringify(accessories[uuid].i_label), timestamp);
  }
  
  var a = accessories[uuid];
  
  var i_data = {
    "name": (a.name) ? a.name : "",
    "uuid": uuid,
    "type": (a.i_device.type) ? a.i_device.type : "Simulator",
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
