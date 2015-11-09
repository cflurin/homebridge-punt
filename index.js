/* config.json declaration
  "platforms": [
    {
      "platform" : "punt",
      "name" : "punt"
    }
  ]
*/

'use strict';

var Utils = require('./utils.js').Utils;
var Accessory = require('./accessory.js').Accessory;
var Monitor = require('./monitor.js').Monitor;

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
  
  var plugin_version = Utils.readPluginVersion(plugin_name);
  this.log("%s v%s", plugin_name, plugin_version);
  
  Utils.readGitHubVersion(github_url);
  
  if (this.p_config.monitor.run) {
    this.Monitor = new Monitor(this.log, this.p_config, this.Accessories, plugin_name);
    this.Monitor.startServer();
  }
}

Platform.prototype.accessories = function(callback) {
    
  var accessories = this.p_config.accessories;
  this.log("Reading %s Accessories", accessories.length);
  
  for (var index = 0; index < accessories.length; index++) {
    var i_accessory = new Accessory(this.log, this.p_config, index, Service, Characteristic);
    this.Accessories.push(i_accessory);
  }
  callback(this.Accessories);
}
