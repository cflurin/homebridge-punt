'use strict';

var util = require('util');
var path = require('path');
var Utils = require('./utils.js').Utils;

var WebSocketServer = require('ws').Server,
  http = require('http'),
  express = require('express'),
  app = express();
  
module.exports = {
  PuntView: PuntView
}

function PuntView(log, p_config, plugin_name, Accessories) {

  this.log = log;
  this.p_config = p_config;
  this.port = p_config.puntview.port || {"port": "4040"};
  this.plugin_name = plugin_name;
  this.gateway = p_config.gateway;
  this.connection = false;
  this.ws;
  this.latest;
  this.Accessories = Accessories;
}

PuntView.prototype.startServer = function() {

  var public_index= path.join(__dirname, '../public/puntview');
  app.use(express.static(public_index));
  var public_dir = path.join(__dirname, '../public');
  app.use(express.static(public_dir));
  
  var server = http.createServer(app);
  server.listen(this.port, function() {
    this.log("PuntView is running on port %s", server.address().port);
  }.bind(this));

  var wss = new WebSocketServer({server: server});
  
  wss.on('connection', function(ws) {
      
    this.ws = ws;
    this.connection = true;
    this.log("PuntView client ip %s connected", ws.upgradeReq.connection.remoteAddress);
    this.latest = Utils.get_npmVersion(this.plugin_name);
    
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
      this.log("PuntView open");
    }.bind(this));
    
    ws.on('close', function close() {
      this.log("PuntView client ip %s disconnected", ws.upgradeReq.connection.remoteAddress);
      this.connection = false;
    }.bind(this));
    
    ws.on('message', function message(data) {
      this.log("PuntView received: %s", data);
      var data = JSON.parse(data);
      //this.setValue(data);
    }.bind(this));
    
  }.bind(this));
}

PuntView.prototype.get = function(t_characteristic, index, callback) {
  this.log("PuntView.get not implemented %s %s", t_characteristic, index);
}

PuntView.prototype.set = function(t_characteristic, index, value, callback) {
  this.log("PuntView.set not implemented %s %s %s", t_characteristic, index, value);
}

PuntView.prototype.characteristic_change = function(index, objValue) {

  //this.log("PuntView.characteristic_change %s %s", index, JSON.stringify(objValue.context));
  var c = objValue.characteristic.displayName.replace(/\s/g, "");
  if (this.Accessories.length > 0) {
    if (!this.gateway.run || !this.Accessories[index].i_device.type) {
      var value = (c == "On") ? Utils.n2b(objValue.newValue) : objValue.newValue;
      this.Accessories[index].i_value[c] = value;
    }
    // todo avoid multi refresh
    this.refresh(index, objValue.context);
  }
}

PuntView.prototype.refresh = function(index, context) {

  if (index == "all") {
    var data = {"label": {"data_type": "accessory", "index": index}, "accessories": []};
    for( var i = 0; i < this.Accessories.length; i++ ) {
      data.accessories.push(this.extract(i, context));
    }
  }
  else {
    var data = {"label": {"data_type": "accessory", "index": index}, "accessory": this.extract(index, context)};
  }
  this.sendData(data);
}

PuntView.prototype.extract = function(index, context) {

  var trigger = (context && context.trigger) ? context.trigger : "";
  var timestamp = (context && context.timestamp) ? context.timestamp : "";
  var i_data = {
    "name": (this.Accessories[index].name) ? this.Accessories[index].name : "",
    "type": (this.Accessories[index].i_device.type) ? this.Accessories[index].i_device.type : "no fhem",
    "service": (this.Accessories[index].i_service) ? this.Accessories[index].i_service : "",
    "value": this.Accessories[index].i_value,
    "trigger": trigger,
    "timestamp": timestamp
  };
  return i_data;
}

PuntView.prototype.sendData = function(data) {

  if (this.connection && this.ws.OPEN) {
    var j_data = JSON.stringify(data);
    //this.log("PuntView.sendData %s", j_data);
    
    this.ws.send(j_data, function ack(error) {
      if (error) this.log("PuntView %s", error);
    }.bind(this));
  }
}
