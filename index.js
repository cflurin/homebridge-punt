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
  
  // For platform plugin to be considered as dynamic platform plugin,
  // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
  homebridge.registerPlatform(plugin_name, platform_name, PuntPlatform, true);
}

// Platform constructor
// config may be null
// api may be null if launched from old homebridge version
function PuntPlatform(log, config, api) {
  this.log = log;
  this.Accessories = [];
  
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
    // Save the API object as plugin needs to register new accessory via this object.
    this.api = api;

    // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories
    // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
    // Or start discover new accessories
    this.api.on('didFinishLaunching', function() {
      this.log("Plugin - DidFinishLaunching");
    }.bind(this));
  }
  
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
 
  // todo: use server event 'ready', waiting for homebridge Update
  setTimeout(function() {
    PuntInit.Label(this.log, this.p_config, this.Accessories);
  }.bind(this),5000);
}

// Function invoked when homebridge tries to restore cached accessory
// Developer can configure accessory at here (like setup event handler)
// Update current value
PuntPlatform.prototype.configureAccessory = function(accessory) {
  this.log("Plugin - Configure Accessory: %s", accessory.displayName);

  // set the accessory to reachable if plugin can currently process the accessory
  // otherwise set to false and update the reachability later by invoking 
  // accessory.updateReachability()
  accessory.reachable = true;

  if (accessory.getService(Service.Lightbulb)) {
    accessory.getService(Service.Lightbulb)
    .getCharacteristic(Characteristic.On)
    .on('set', function(value, callback) {
      this.log("Light -> " + value);
      callback();
    }.bind(this));
  }

  this.Accessories.push(accessory);
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

  // - UI Type: Input
  // Can be used to request input from user
  // User response can be retrieved from request.response.inputs next time
  // when configurationRequestHandler being invoked

  // var respDict = {
  //   "type": "Interface",
  //   "interface": "input",
  //   "title": "Login",
  //   "items": [
  //     {
  //       "id": "user",
  //       "title": "Username",
  //       "placeholder": "jappleseed"
  //     }, 
  //     {
  //       "id": "pw",
  //       "title": "Password",
  //       "secure": true
  //     }
  //   ]
  // }

  // - UI Type: List
  // Can be used to ask user to select something from the list
  // User response can be retrieved from request.response.selections next time
  // when configurationRequestHandler being invoked

  // var respDict = {
  //   "type": "Interface",
  //   "interface": "list",
  //   "title": "Select Something",
  //   "allowMultipleSelection": true,
  //   "items": [
  //     "A","B","C"
  //   ]
  // }

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
    // "showNextButton": true,
    // "buttonText": "Login in browser",
    // "actionURL": "https://google.com"
  }

  // Plugin can set context to allow it track setup process
  context.ts = "Hello";

  //invoke callback to update setup UI
  callback(respDict);
}

// add accessory dynamically from outside event
PuntPlatform.prototype.addAccessory = function(accessoryName) {
  this.log("Add Accessory");
  var uuid;

  if (!accessoryName) {
    accessoryName = "Test Accessory"
  }

  uuid = UUIDGen.generate(accessoryName);

  var newAccessory = new Accessory(accessoryName, uuid);

  // Plugin can save context on accessory
  // To help restore accessory in configureAccessory()
  // newAccessory.context.something = "Something"

  newAccessory.addService(Service.Lightbulb, "Test Light")
  .getCharacteristic(Characteristic.On)
  .on('set', function(value, callback) {
    this.log("Light -> " + value);
    callback();
  }.bind(this));

  this.Accessories.push(newAccessory);
  this.api.registerPlatformAccessories("homebridge-samplePlatform", "SamplePlatform", [newAccessory]);
}

PuntPlatform.prototype.updateAccessoriesReachability = function() {
  this.log("Update Reachability");
  for (var index in this.Accessories) {
    var accessory = this.Accessories[index];
    accessory.updateReachability(false);
  }
}

// remove accessory dynamically from outside event
PuntPlatform.prototype.removeAccessory = function() {
  this.log("Remove Accessory");
  this.api.unregisterPlatformAccessories(plugin_name, platform_name, this.Accessories);

  this.Accessories = [];
}

PuntPlatform.prototype.accessories = function(callback) {

  var p_accessories = this.p_config.accessories;
  var p_accessory_names = [];
  for (var index = 0; index < p_accessories.length; index++) {
    if (p_accessory_names.indexOf(p_accessories[index].name) < 0) {
      var i_accessory = new PuntAccessory(this.log, this.p_config, Service, Characteristic, index, this.PuntView, this.Simulator);
      this.Accessories.push(i_accessory);
      p_accessory_names.push(p_accessories[index].name);
    }
    else {
      this.log.error("index.accessories '%s' is already defined, please change the accessory name.", p_accessories[index].name);
      process.exit(1);
    }
  }
  this.log("%s Accessories defined", this.Accessories.length);
  callback(this.Accessories);
}


