'use strict';

var path = require('path');
var Utils = require('./utils.js').Utils;

var WebSocketServer = require('ws').Server,
  http = require('http'),
  express = require('express'),
  app = express();
  
module.exports = {
  PuntView: PuntView
}

function PuntView(log, p_config, Accessories, plugin_name) {

  this.log = log;
  this.p_config = p_config;
  this.Accessories = Accessories;
  this.port = p_config.puntview.port || {"port": "4040"};
  this.plugin_name = plugin_name;
  this.connection = false;
  this.ws;
  this.latest;
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

PuntView.prototype.set = function(t_characteristic, index, value, gateway) {

  //this.log("Simulator set %s %s", index, value);
  if (t_characteristic == "On") {
    value = (value == 0 || value == false) ? false : true;
  }
  this.Accessories[index].i_value[t_characteristic] = value;
  this.refresh(index);
}

PuntView.prototype.refresh = function(index) {

  if (index == "all") {
    var data = {"label": {"data_type": "accessory", "index": index}, "accessories": []};
    for( var i = 0; i < this.Accessories.length; i++ ) {
      var i_data = {
        "name": this.Accessories[i].name,
        "type": this.Accessories[i].i_device.type,
        "service": this.Accessories[i].i_service, 
        "value": this.Accessories[i].i_value
      };
      data.accessories.push(i_data);
    }
  }
  else {
    var i_data = {
      "name": this.Accessories[index].name,
      "type": this.Accessories[index].i_device.type,
      "service": this.Accessories[index].i_service,
      "value": this.Accessories[index].i_value
    };
    var data = {"label": {"data_type": "accessory", "index": index}, "accessory": i_data};
  }

  this.sendData(data);
}

PuntView.prototype.sendData = function(data) {

  if (this.connection && this.ws.OPEN) {
    var j_data = JSON.stringify(data);
    //this.log("PuntView data %s", j_data);
    
    this.ws.send(j_data, function ack(error) {
      if (error) this.log("PuntView %s", error);
    }.bind(this));
  }
}
