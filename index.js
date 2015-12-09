'use strict';

var inherits = require('util').inherits;

var Utils = require('./lib/utils.js').Utils;
var PuntInit = require('./lib/init.js').PuntInit;
var Accessory = require('./lib/accessory.js').Accessory;
var PuntView = require('./lib/puntview.js').PuntView;
var Simulator = require('./lib/simulator.js').Simulator;
var Monitor = require('./lib/monitor.js').Monitor;

var Service, Characteristic, storagePath;

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
  //this.log("p_config %s", JSON.stringify(this.p_config));

  this.puntview = this.p_config.puntview || { "run": false };
  this.simulator = this.p_config.simulator || { "run": false };
  this.monitor = this.p_config.monitor || { "run": false };

  var plugin_version = Utils.readPluginVersion();
  this.log("%s v%s", plugin_name, plugin_version);

  Utils.read_npmVersion(plugin_name, function(npm_version) {
    if (npm_version > plugin_version) {
      this.log("A new version %s is avaiable", npm_version);
    }
  }.bind(this));
  
  if (this.puntview.run) {
    this.PuntView = new PuntView(this.log, this.p_config, plugin_name, this.Accessories);
    this.PuntView.startServer();
  }

  if (this.simulator.run) {
    this.Simulator = new Simulator(this.log, this.p_config, plugin_name, this.Accessories);
    this.Simulator.startServer();
  }
    
  if (this.monitor.run) {
    this.Monitor = new Monitor(this.log, this.p_config, plugin_name, this.Accessories);
    this.Monitor.startServer();
  }
  
  // todo without timer
  setTimeout(function() {
    PuntInit.initContext(this.log, this.p_config, this.Accessories);
  }.bind(this),1000);
}

Platform.prototype.accessories = function(callback) {

  var accessories = this.p_config.accessories;
  for (var index = 0; index < accessories.length; index++) {
    var i_accessory = new Accessory(this.log, this.p_config, Service, Characteristic, index, this.PuntView, this.Simulator);
    this.Accessories.push(i_accessory);
  }
  //this.log("%s Accessories defined", this.Accessories.length);
  callback(this.Accessories);
  
}
