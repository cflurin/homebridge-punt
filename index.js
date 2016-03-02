'use strict';

var http = require('http');
var inherits = require('util').inherits;
var util = require('util');

var Utils = require('./lib/utils.js').Utils;
var PuntInit = require('./lib/init.js').PuntInit;
var PuntAccessory = require('./lib/accessory.js').Accessory;
var PuntView = require('./lib/puntview.js').PuntView;
var Simulator = require('./lib/simulator.js').Simulator;
var Monitor = require('./lib/monitor.js').Monitor;

var Accessory, Service, Characteristic, UUIDGen;
var storagePath;

var platform_name = "punt";
var plugin_name = "homebridge-" + platform_name;
var config_name = "config-" + platform_name + ".json";
var github_url = "https://raw.githubusercontent.com/cflurin/" + plugin_name + "/master/package.json";

module.exports = function(homebridge) {
  console.log("homebridge API version: " + homebridge.version);
  
  Accessory = homebridge.platformAccessory;
  
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid; // Universally Unique IDentifier
  
  storagePath = homebridge.user.storagePath();
  
  homebridge.registerPlatform(plugin_name, platform_name, PuntPlatform, true);
}

function PuntPlatform(log, config, api) {

  this.log = log;
  this.accessories_config = {};
  this.accessories = {};
  
  this.p_config = Utils.loadConfig(storagePath, plugin_name, config_name);
  //this.log.debug("PuntPlatform %s", JSON.stringify(this.p_config));
  
  this.gateway = this.p_config.gateway || { "run": false };
  this.puntview = this.p_config.puntview || { "run": false };
  this.simulator = this.p_config.simulator || { "run": false };
  this.monitor = this.p_config.monitor || { "run": false };
  
  this.readConfig();
  
  var plugin_version = Utils.readPluginVersion();
  this.log("%s v%s", plugin_name, plugin_version);

  Utils.read_npmVersion(plugin_name, function(npm_version) {
    if (npm_version > plugin_version) {
      this.log("A new version %s is avaiable", npm_version);
    }
  }.bind(this));
   
  if (api) {
    this.api = api;

    this.api.on('didFinishLaunching', function() {
      this.log("Plugin - DidFinishLaunching");

      this.addAccessories();
      
      setTimeout(function() {
        PuntInit.Label(this.log, this.p_config, this.accessories);
        //this.log.debug("PuntPlatform %s", JSON.stringify(this.accessories));
      }.bind(this),5000);
    }.bind(this));
  }

  if (this.gateway.run) {
    var base_url = "http://" + this.gateway.url + ":" + this.gateway.port;
    this.log("Gateway is running, url %s", base_url);
  } else {
    this.log.error("Gateway is not running, Simulator mode.");
  }

  if (this.puntview.run) {
    this.PuntView = new PuntView(this.log, this.p_config, plugin_name, this.accessories);
    this.PuntView.startServer();
  }

  if (this.simulator.run) {
    this.Simulator = new Simulator(this.log, this.p_config, plugin_name, this.accessories, Characteristic);
    this.Simulator.startServer();
  }
    
  if (this.monitor.run) {
    this.Monitor = new Monitor(this.log, this.p_config, plugin_name, this.accessories);
    this.Monitor.startServer();
  }
}

PuntPlatform.prototype.readConfig = function() {

  var p_accessories = this.p_config.accessories;
  
  for (var k in p_accessories) {
    var name = p_accessories[k].name;
    this.accessories_config[name] = p_accessories[k];
  }
  //this.log.debug("PuntPlatform.readConfig %s", JSON.stringify(this.accessories_config));
}

PuntPlatform.prototype.addAccessories = function() {

  var p_accessories = this.p_config.accessories;
 
  for (var k in p_accessories) {
    var name = p_accessories[k].name;
    var uuid = UUIDGen.generate(name);
    
    if (!this.accessories[uuid]) {
      this.addAccessory(name);
    }
  }
  this.log("Number of Accessories: %s", Object.keys(this.accessories).length);
}

PuntPlatform.prototype.addAccessory = function(name) {

  if (!name) {
    this.log.error("PuntPlatform.addAccessory undefined");
  } else {
    var uuid = UUIDGen.generate(name);

    var newAccessory = new Accessory(name, uuid);
    //this.log.debug("PuntPlatform.addAccessory UUID = %s", newAccessory.UUID);
    
    var i_accessory = new PuntAccessory(this.buildParams(name, uuid));
    i_accessory.addService(newAccessory);
    i_accessory.configureAccessory(newAccessory);
    
    this.accessories[uuid] = i_accessory;
    this.accessories[uuid].hap_accessory = newAccessory;
    this.api.registerPlatformAccessories(plugin_name, platform_name, [newAccessory]);
    //this.log.debug("PuntPlatform.addAccessory %s", name);
  }
}

PuntPlatform.prototype.configureAccessory = function(accessory) {

  var name = accessory.displayName;
  //this.log.debug("PuntPlatform.configureAccessory %s %s", name, accessory.UUID);
  
  if (this.accessories_config[name]) {
    accessory.reachable = true;

    var i_accessory = new PuntAccessory(this.buildParams(name, accessory.UUID));
    i_accessory.configureAccessory(accessory);
    
    this.accessories[accessory.UUID] = i_accessory;
    this.accessories[accessory.UUID].hap_accessory = accessory;
  } else {
    this.removeAccessory(accessory);
  }
}

PuntPlatform.prototype.buildParams = function (name, uuid) {

  var params = {
    "log": this.log,
    "p_config": this.p_config,
    "accessory_config": this.accessories_config[name],
    "uuid": uuid,
    "Service": Service,
    "Characteristic": Characteristic,
    "PuntView": this.PuntView,
    "Simulator": this.Simulator
  }
  //this.log.debug("PuntPlatform.configureAccessories %s", JSON.stringify(params.accessory_config));
  return params;
}

PuntPlatform.prototype.removeAccessory = function(accessory) {

  if (accessory) {
    this.api.unregisterPlatformAccessories(plugin_name, platform_name, [accessory]);
    this.log.debug("PuntPlatform.removeAccessory %s", accessory.displayName);
  } else {
    this.log.error("PuntPlatform.removeAccessory not found");
  }
}
