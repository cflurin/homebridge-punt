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
  UUIDGen = homebridge.hap.uuid;
  
  storagePath = homebridge.user.storagePath();
  
  homebridge.registerPlatform(plugin_name, platform_name, PuntPlatform, true);
}

function PuntPlatform(log, config, api) {
  this.log = log;
  this.accessories_config = {};
  this.accessories = {};
  
  this.p_config = Utils.loadConfig(storagePath, plugin_name, config_name);
  //this.log.debug("p_config %s", JSON.stringify(this.p_config));
  
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
  
  this.requestServer = http.createServer(function(request, response) {
    if (request.url === "/add") {
      this.addAccessory();
      response.writeHead(204);
      response.end();
    }

    if (request.url == "/reachability") {
      this.updateAccessoriesReachability();
      response.writeHead(204);
      response.end();
    }

    if (request.url == "/remove") {
      this.removeAccessory();
      response.writeHead(204);
      response.end();
    }
  }.bind(this));

  this.requestServer.listen(18081, function() {
    this.log("Server Listening...");
  }.bind(this));
  
  if (api) {
    this.api = api;

    // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories
    // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
    // Or start discover new accessories
    this.api.on('didFinishLaunching', function() {
      this.log("Plugin - DidFinishLaunching");

      this.addAccessories();
      
      setTimeout(function() {
        PuntInit.Label(this.log, this.p_config, this.accessories);
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
  //this.log.debug("index.readConfig %s", JSON.stringify(this.accessories_config));
}

PuntPlatform.prototype.addAccessories = function() {
  var p_accessories = this.p_config.accessories;
 
  for (var k in p_accessories) {
    var name = p_accessories[k].name;
    var a_keys = Object.keys(this.accessories);
    
    if (a_keys.indexOf(name) < 0) {
      this.addAccessory(name);
    }
  }
  this.log.debug("Number of Accessories: %s", Object.keys(this.accessories).length);
  //this.log.debug("index.addAccessories %s", JSON.stringify(this.accessories));
}

// add accessory dynamically from outside event
PuntPlatform.prototype.addAccessory = function(name) {
  this.log.debug("Add Accessory");
  var uuid;
   
  uuid = UUIDGen.generate(name);

  var newAccessory = new Accessory(name, uuid);
  this.log.debug("index.addAccessory UUID = %s", newAccessory.UUID);
  
  var i_accessory = new PuntAccessory(this.buildParams(name));
  i_accessory.addService(newAccessory);
  i_accessory.configureAccessory(newAccessory);
  
  this.accessories[name] = i_accessory;
  this.api.registerPlatformAccessories(plugin_name, platform_name, [newAccessory]);
}

// Function invoked when homebridge tries to restore cached accessory
// Developer can configure accessory at here (like setup event handler)
// Update current value
PuntPlatform.prototype.configureAccessory = function(accessory) {
  
  var name = accessory.displayName;
  this.log.debug("index.configureAccessory %s %s", name, accessory.UUID);
    
  // set the accessory to reachable if plugin can currently process the accessory
  // otherwise set to false and update the reachability later by invoking 
  // accessory.updateReachability()
  accessory.reachable = true;

  var i_accessory = new PuntAccessory(this.buildParams(name));
  i_accessory.configureAccessory(accessory);
  
  this.accessories[name] = i_accessory;
}

PuntPlatform.prototype.buildParams = function (name) {
  var params = {
    "log": this.log,
    "p_config": this.p_config,
    "accessory_config": this.accessories_config[name],
    "Service": Service,
    "Characteristic": Characteristic,
    "PuntView": this.PuntView,
    "Simulator": this.Simulator
  }
  //this.log.debug("index.configureAccessories %s", JSON.stringify(params.accessory_config));
  return params;
}

// remove accessory dynamically from outside event
PuntPlatform.prototype.removeAccessory = function() {
  this.log("index.remove Accessory");
  this.api.unregisterPlatformAccessories(plugin_name, platform_name, this.accessories);

  this.accessories = {};
}

PuntPlatform.prototype.updateAccessoriesReachability = function() {
  this.log("Update Reachability: todo ...");
  // todo ...
}

//Handler will be invoked when user try to config your plugin
//Callback can be cached and invoke when nessary
PuntPlatform.prototype.configurationRequestHandler = function(context, request, callback) {
  this.log("Context: ", JSON.stringify(context));
  this.log("Request: ", JSON.stringify(request));

  // Check the request response
  if (request && request.response && request.response.inputs && request.response.inputs.name) {
    this.addAccessory(request.response.inputs.name);

    // Invoke callback with config will let homebridge save the new config into config.json
    // Callback = function(response, type, replace, config)
    // set "type" to platform if the plugin is trying to modify platforms section
    // set "replace" to true will let homebridge replace existing config in config.json
    // "config" is the data platform trying to save
    callback(null, "platform", true, {"platform":"PuntPlatform", "TEST":"asafas"});
    return;
  }
  
  // ...
  // ...
  
  // - UI Type: Instruction
  // Can be used to ask user to do something (other than text input)
  // Hero image is base64 encoded image data. Not really sure the maximum length HomeKit allows.

  var respDict = {
    "type": "Interface",
    "interface": "instruction",
    "title": "Almost There",
    "detail": "Please press the button on the bridge to finish the setup.",
    "heroImage": "",
    "showActivityIndicator": true,
    "showNextButton": true,
    "buttonText": "Login in browser",
    "actionURL": "https://google.com"
  }

  // Plugin can set context to allow it track setup process
  context.ts = "Hello";

  //invoke callback to update setup UI
  callback(respDict);
}
