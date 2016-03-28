'use strict';

var util = require('util');
var path = require('path');
var Utils = require('./utils.js').Utils;
var port, plugin_name, gateway;
var connection, latest;
var accessories;
var Characteristic;

var WebSocketServer = require('ws').Server,
  http = require('http'),
  express = require('express'),
  app = express();
  
module.exports = {
  Simulator: Simulator
}

function Simulator(log, p_config, _plugin_name, _accessories, _Characteristic) {

  this.log = log;
  port = p_config.simulator.port || {"port": "4080"};
  gateway = p_config.gateway;
  plugin_name = _plugin_name;
  accessories = _accessories;
  Characteristic = _Characteristic;
  this.ws;
  connection = false;
}

Simulator.prototype.startServer = function() {
 
  var public_index = path.join(__dirname, '../public/simulator');
  app.use(express.static(public_index));
  var public_dir = path.join(__dirname, '../public');
  app.use(express.static(public_dir));

  var server = http.createServer(app);
  server.listen(port, function() {
    this.log("Simulator is running on port %s", server.address().port);
  }.bind(this));

  var wss = new WebSocketServer({server: server});
  
  wss.on('connection', function(ws) {
  
    this.ws = ws;
    connection = true;
    this.log("Simulator client ip %s connected", ws.upgradeReq.connection.remoteAddress);
    latest = Utils.get_npmVersion(plugin_name);

    this.refresh("all");
    
    this.data = {"type": "info", "spec":
      {
        "plugin": plugin_name,
        "version": Utils.getPluginVersion(),
        "latest": latest,
        "port": port
      }
    };
    this.sendData(this.data);
            
    ws.on('open', function open() {
      this.log("Simulator open");
    }.bind(this));
    
    ws.on('close', function close() {
      this.log("Simulator client ip %s disconnected", ws.upgradeReq.connection.remoteAddress);
      connection = false;
    }.bind(this));
    
    ws.on('message', function message(data) {
      //this.log.debug("Simulator received: %s", data);
      var data = JSON.parse(data);
      this.setValue(data);
    }.bind(this));
    
  }.bind(this));
}

Simulator.prototype.setValue = function(data) {

  var value;
  var t_characteristic = data.characteristic;
  var uuid = data.uuid;
  var name = accessories[uuid].name;
  //this.log.debug("Simulator.onmessage: %s %s %s", name, t_characteristic, data.value);
  var sc = accessories[uuid].service.getCharacteristic(Characteristic[t_characteristic]);
  //this.log.debug("Simulator.onmessage: %s %s", name, JSON.stringify(sc));
  
  if( typeof(sc) !== "undefined") {
    switch (sc.props.format) {
      case "bool":
        value = (data.value == 0 || data.value == false) ? false : true;
        //value = data.value;
        break;
        
      case "int":
      case "uint8":
      case "uint16":
      case "unit32":
        value = parseInt(data.value);
        break;
        
      case "float":
        value = parseFloat(data.value);
        break;
        
      default:
        // string, tlv8, 
        value = undefined;
        this.log.warn("Simulator.setValue %s %s %s %s", name, t_characteristic, data.value, JSON.stringify(sc.props));
    }
  
    if (typeof(value) !== "undefined") { // && value !=  accessories[uuid].i_value[t_characteristic]) {
      //this.log.debug("Simulator.setValue %s %s %s", name t_characteristic, data.value);
      accessories[uuid].save_and_setValue("simulator", t_characteristic, value);
    }
  }
  else {
    this.log.warn("Simulator.setValue %s %s undefined, refresh the Browser", name, t_characteristic);
  }
}

Simulator.prototype.get = function(uuid, t_characteristic, callback, context) {

  //this.log.debug("Simulator.get %s %s", t_characteristic, name);
  if (!gateway.run) {
    callback(null, accessories[uuid].i_value[t_characteristic]);
  }
}

Simulator.prototype.set = function(uuid, t_characteristic, value, callback, context) {

  //this.log.debug("Simulator.set %s %s %s", t_characteristic, name, value);
  if (!gateway.run) {
    //accessories[uuid].i_value[t_characteristic] = value;
    callback();
  }
}

Simulator.prototype.characteristic_change = function(uuid, objValue) {

  //this.log.debug("Simulator.characteristic_change %s %s %s", name, JSON.stringify(objValue));
  var c = objValue.characteristic.displayName.replace(/\s/g, "");

  var value = objValue.newValue;
  
  if (accessories[uuid]) {
    value = (c == "On") ? Utils.n2b(value) : value;
    accessories[uuid].i_value[c] = value;
    //this.log.debug("Simulator.c_change %s %s %s %s", name, accessories[uuid].name, c, value);
    this.refresh(uuid, c);
  }
}

Simulator.prototype.delete_content = function() {

  var data = {"type": "command", "cmd_type": "delete"};
  this.sendData(data);
}

Simulator.prototype.refresh = function(uuid, c) {

  var data = {"type": "accessory", "accessories": {}};
  
  if (uuid == "all") {
    this.delete_content();
    
    for (var k in accessories) {
      var c = Object.keys(accessories[k].i_value)[0];
      data.accessories[k] = this.extract(k, c);
    }
  }
  else {
    data.accessories[uuid] = this.extract(uuid, c);
  }
  this.sendData(data);
}

Simulator.prototype.extract = function(uuid, c) {

  var a = accessories[uuid];
  
  var i_data = {
    "name": a.name,
    "uuid": uuid,
    "type": a.i_device.type,
    "service_name": a.service_name,
    "value": a.i_value,
    "props": a.i_props
  };
  //this.log.debug("Simulator.extract %s %s %s", name, a.name, JSON.stringify(a.i_props));
  return i_data;
}

Simulator.prototype.sendData = function(data) {

  if (connection && this.ws.OPEN) {
    var j_data = JSON.stringify(data);
    //this.log.debug("Simulator.sendData %s", j_data);
    
    this.ws.send(j_data, function ack(error) {
      if (error) this.log("Simulator %s", error);
    }.bind(this));
  }
}
