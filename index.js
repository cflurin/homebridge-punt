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
var storagePath, p_config;
var cachedAccessories = 0;

var platform_name = "punt";
var plugin_name = "homebridge-" + platform_name;
var config_name = "config-" + platform_name + ".json";
var github_url = "https://raw.githubusercontent.com/cflurin/" + plugin_name + "/master/package.json";
var reload_name = "reload";

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
  this.hap_accessories = [];
  
  this.readConfig();
    
  this.gateway = p_config.gateway || { "run": false };
  this.puntview = p_config.puntview || { "run": false };
  this.simulator = p_config.simulator || { "run": false };
  this.monitor = p_config.monitor || { "run": false };
  
  var plugin_version = Utils.readPluginVersion();
  this.log("%s v%s", plugin_name, plugin_version);

  Utils.read_npmVersion(plugin_name, function(npm_version) {
    if (npm_version > plugin_version) {
      this.log("A new version %s is avaiable", npm_version);
    }
  }.bind(this));

  if (this.gateway.run) {
    var base_url = "http://" + this.gateway.url + ":" + this.gateway.port;
    this.log("Gateway is running, url %s", base_url);
  } else {
    this.log.error("Gateway is not running, Simulator mode.");
  }

  if (this.puntview.run) {
    var params = {
      "log": this.log,
      "p_config": p_config,
      "storagePath": storagePath,
      "plugin_name": plugin_name,
      "config_name": config_name,
      "accessories": this.accessories,
      "reload": this.reload.bind(this)
    }
    //this.PuntView = new PuntView(this.log, p_config, storagePath, plugin_name, config_name, this.accessories);
    this.PuntView = new PuntView(params);
  }

  if (this.simulator.run) {
    this.Simulator = new Simulator(this.log, p_config, plugin_name, this.accessories, Characteristic);
  }

  if (this.monitor.run) {
    this.Monitor = new Monitor(this.log, p_config, plugin_name, this.accessories);
  }

  if (api) {
    this.api = api;

    this.api.on('didFinishLaunching', function() {
      this.log("Plugin - DidFinishLaunching");
     
      this.addAccessories();
        
      this.log.debug("Number of chaced Accessories: %s", cachedAccessories);
      this.log("Number of Accessories: %s", Object.keys(this.accessories).length);

      PuntInit.setValues(this.log, p_config, this.accessories, reload_name, function() {
        this.log.debug("PuntPlatform init done");
        if (this.puntview.run) {
          this.PuntView.startServer();
        }       
        if (this.simulator.run) {
          this.Simulator.startServer();
        }
        if (this.monitor.run) {
          this.Monitor.startServer();
        }
      }.bind(this));
    }.bind(this));
    //this.log.debug("PuntPlatform %s", JSON.stringify(this.accessories));
  }
}

PuntPlatform.prototype.readConfig = function() {

  p_config = Utils.loadConfig(storagePath, plugin_name, config_name);
  //this.log.debug("PuntPlatform %s", JSON.stringify(p_config));
  
  var p_accessories = p_config.accessories;
  
  for (var k in p_accessories) {
    var name = p_accessories[k].name;
    this.accessories_config[name] = p_accessories[k];
  }
  //this.log.debug("PuntPlatform.readConfig %s", JSON.stringify(this.accessories_config));
}

PuntPlatform.prototype.addAccessories = function() {

  var p_accessories = p_config.accessories;
 
  for (var k in p_accessories) {
    var name = p_accessories[k].name;
    var uuid = UUIDGen.generate(name);
    
    if (!this.accessories[uuid]) {
      this.addAccessory(name);
    }
  }
}

PuntPlatform.prototype.addAccessory = function(name) {

  if (!name) {
    this.log.error("PuntPlatform.addAccessory undefined");
  } else {
    var uuid = UUIDGen.generate(name);
    
    var newAccessory = new Accessory(name, uuid);
    newsAccessory.reachable = true;
    //this.log.debug("PuntPlatform.addAccessory UUID = %s", newAccessory.UUID);
    
    var i_accessory = new PuntAccessory(this.buildParams(name, uuid));
    i_accessory.addService(newAccessory);
    i_accessory.configureAccessory(newAccessory);
    
    this.accessories[uuid] = i_accessory;
    this.hap_accessories.push(newAccessory);
    this.api.registerPlatformAccessories(plugin_name, platform_name, [newAccessory]);
    //this.log.debug("PuntPlatform.addAccessory %s", name);
  }
}

PuntPlatform.prototype.configureAccessory = function(accessory) {

  cachedAccessories++;
  var name = accessory.displayName;
  var uuid = accessory.UUID;
  
  if (this.accessories[uuid]) {
    this.log.error("PuntPlatform.configureAccessory %s UUID %s already used.", name, uuid);
    process.exit(1);
  }
  
  if (this.accessories_config[name]) {
    this.log.debug("PuntPlatform.configureAccessory %s", name);
    accessory.reachable = true;

    var i_accessory = new PuntAccessory(this.buildParams(name, uuid));
    i_accessory.configureAccessory(accessory);
    
    this.accessories[uuid] = i_accessory;
    this.hap_accessories.push(accessory);
  } else {
    this.log.debug("PuntPlatform.configureAccessory unregister %s", name);
    this.api.unregisterPlatformAccessories(plugin_name, platform_name, [accessory]);
  }
}

PuntPlatform.prototype.buildParams = function (name, uuid) {

  var params = {
    "log": this.log,
    "p_config": p_config,
    "accessory_config": this.accessories_config[name],
    "uuid": uuid,
    "Service": Service,
    "Characteristic": Characteristic,
    "PuntView": this.PuntView,
    "Simulator": this.Simulator,
    "reload": this.reload.bind(this),
    "reload_name": reload_name
  }
  //this.log.debug("PuntPlatform.configureAccessories %s", JSON.stringify(params.accessory_config));
  return params;
}

PuntPlatform.prototype.reload = function() {
 
  this.log("PuntPlatform.reload ...");
  this.api.unregisterPlatformAccessories(plugin_name, platform_name, this.hap_accessories);
  this.hap_accessories = [];
      
  for (var k in this.accessories) {
    delete this.accessories[k];
  }
  
  this.readConfig();
  this.addAccessories();
  
  PuntInit.setValues(this.log, p_config, this.accessories, reload_name, function() {
    this.log.debug("PuntPlatform.reload init done");
    
    if (this.puntview.run) {
      this.PuntView.refresh("all");
    }
    
    if (this.simulator.run) {
      this.Simulator.refresh("all");
    }
  }.bind(this));
}
