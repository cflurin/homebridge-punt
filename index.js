'use strict';

var Utils = require('./lib/utils.js').Utils;
var Accessory = require('./lib/accessory.js').Accessory;
var Monitor = require('./lib/monitor.js').Monitor;
var Simulator = require('./lib/simulator.js').Simulator;

var Service, Characteristic;
var storagePath;
var name = "punt";
var plugin_name = "homebridge-" + name;
var config_name = "config-" + name + ".json";
var github_url = "https://raw.githubusercontent.com/cflurin/" + plugin_name + "/master/package.json";


module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  storagePath = homebridge.user.storagePath();
  
  homebridge.registerPlatform(plugin_name, name, Platform);
}

function Platform(log, config) {
  this.log = log;
  this.Accessories = [];
  this.p_config = Utils.loadConfig(storagePath, plugin_name, config_name);
  //this.log("p_config %s", JSON.stringify(p_config));

  this.monitor = this.p_config.monitor || { "run": true };
  //this.monitor_run = this.monitor.run;
  
  this.simulator = this.p_config.simulator || { "run": true };
  //this.log("this.simulator.run %s", this.simulator.run);

  var plugin_version = Utils.readPluginVersion();
  this.log("%s v%s", plugin_name, plugin_version);

  Utils.read_npmVersion(plugin_name, function(npm_version) {
    if (npm_version > plugin_version) {
      this.log("A new version %s is avaiable", npm_version);
    }
  }.bind(this));

  if (this.monitor.run) {
    this.Monitor = new Monitor(this.log, this.p_config, this.Accessories, plugin_name);
    this.Monitor.startServer();
  }

  if (this.simulator.run) {
    this.Simulator = new Simulator(this.log, this.p_config, this.Accessories, plugin_name);
    this.Simulator.startServer();
  }
}

Platform.prototype.accessories = function(callback) {
    
  var accessories = this.p_config.accessories;
  this.log("Reading %s Accessories", accessories.length);
  
  for (var index = 0; index < accessories.length; index++) {
    var i_accessory = new Accessory(this.log, this.p_config, index, Service, Characteristic, this.Simulator);
    this.Accessories.push(i_accessory);
  }
  callback(this.Accessories);
}
