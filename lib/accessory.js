/*
Accessory WindowsCovering: Wave FIBARO System FGRM-222 Roller Shutter 2
The following attribute in fhem.cfg has to be added (replace bathroom_blind with the name of your device):

dim {ReadingsVal("bathroom_blind","state","")=~/^dim/?ReadingsNum("bathroom_blind","state","")=~/^99/?
100:ReadingsNum("bathroom_blind","state","")=~/^1$/?
0:ReadingsNum("bathroom_blind","state",""):ReadingsVal("bathroom_blind","dim","")},positionSlat 
{ReadingsVal("bathroom_blind","state","")=~/^positionSlat/?
ReadingsNum("bathroom_blind","state",""):ReadingsVal("bathroom_blind","positionSlat","")}
*/

/*
Accessory Lightbulb: ZWave Aeotec LED Bulb ZW098-C55
The attribute in fhem.cfg has to be added (replace led_bulb with the name of your device):

attr led_bulb userReadings onoff {ReadingsVal("led_bulb","state","") =~/^on|^off/?
ReadingsVal("led_bulb","state",""):ReadingsVal("led_bulb","onoff","")},dim {ReadingsVal("led_bulb","state","") 
=~/^dim/?ReadingsNum("led_bulb","state",""):ReadingsVal("led_bulb","dim","")},rgb 
{ReadingsVal("led_bulb","state","") =~/^rgb/?substr(ReadingsVal("led_bulb","state",""),
4):ReadingsVal("led_bulb","rgb","")} 
*/

'use strict';

var Gateway = require('./gateway.js').Gateway;

module.exports = {
  Accessory: Accessory
}

function Accessory(log, p_config, Service, Characteristic, index, PuntView, Simulator) {

  //this.log("p_config: %s", JSON.stringify(p_config));
  this.log = log;
  this.Characteristic = Characteristic;
  this.index = index;
  this.PuntView = PuntView;
  this.Simulator = Simulator;
  this.gateway = p_config.gateway;
  
  this.puntview = p_config.puntview || { "run": false };
  this.simulator = p_config.simulator || { "run": false };
    
  this.config_accessory = p_config.accessories[index];
  this.name = this.config_accessory.name;
  this.service_name = this.config_accessory.service;
      
  this.i_device = {};
  this.i_value = {};
  this.i_label = {};
  
  this.props = {
    "index": this.index,
    "name": this.name,
    "service_name": this.service_name,
    "i_device": this.i_device,
    "i_value": this.i_value,
    "i_label": this.i_label
  };
   
  this.service;
    
  if (this.gateway.run) {
    this.Gateway = new Gateway(this.log, p_config, this.Characteristic, this.props);
  }
  else {
    if (index == 0) this.log.error("Gateway is not running, Simulator mode.");
  }
  
  if (this.gateway.run && p_config.gateway.longpoll) {
    this.Gateway.Longpoll(index, function(trigger, t_characteristic, value) {
      this.save_and_setValue(trigger, t_characteristic, value);
    }.bind(this));
  }
  
  if (this.service_name.match(/^Custom/)) {
    this.custom_service(Service);
  }
  else {
    this.predifined_service(Service);
  }
}

Accessory.prototype.get_i_value = function (i_value) {
  return this.i_value;
}

Accessory.prototype.set_i_value = function (i_value) {
  this.i_value = i_value;
}

Accessory.prototype.save_and_setValue = function (trigger, t_characteristic, value) {

  //this.log.debug("Accessory.save_and_setValue %s %s %s", trigger, t_characteristic, value);
  var now = new Date();
  var timestamp = now.getHours()+":"+now.getMinutes()+":"+now.getSeconds(); // +","+now.getMilliseconds(); 
  
  this.i_label[t_characteristic] = {
    "timestamp": timestamp,
    "trigger": trigger
  };

  if (value == "undef") {
    value = this.i_value[t_characteristic];
  }
  else {
    this.i_value[t_characteristic] = value;
  }
  
  var context = this.i_label[t_characteristic];
  //context is also used by the hap-server ('get' and 'set' event) - "context": {"keepalive":true, ...
  //this.log("Accessory.save_and_setValue %s %s %s %s %s ", trigger, this.name, t_characteristic, value, JSON.stringify(context));

  if (context) {
    this.service.getCharacteristic(this.Characteristic[t_characteristic]).setValue(value, null, context);
  }
  else {
    this.service.getCharacteristic(this.Characteristic[t_characteristic]).setValue(value);
  }
}


Accessory.prototype.custom_service = function(Service) {
  // todo
  this.log.error("custom_service: '%s' not implemented yet.", this.service_name);
  process.exit(1);
}

Accessory.prototype.predifined_service = function(Service) {

  try {
    this.service = new Service[this.service_name](this.name);
  }
  catch (err) {
    this.log.error("Service '%s' undefined.", this.service_name);
    process.exit(1);
  }
  
  this.service.on('characteristic-change', this.characteristic_change.bind(this));
    
  var c;
  for (var i in this.service.characteristics) {
    c = this.service.characteristics[i].displayName.replace(/\s/g, "")
    //this.log("Accessory.p_service %s %s %s", this.name, this.service_name, c);
    
    if (c != "Name") {
      this.allocate(c);
      this.setValue(c);
      this.setProps(c);
    }
  }
  
  for (var i in this.service.optionalCharacteristics) {
    c = this.service.optionalCharacteristics[i].displayName.replace(/\s/g, "");
    //this.log("Accessory.p_service %s %s optional %s", this.name, this.service_name, c);
    
    if (c != "Name") {
      this.allocate(c);
      this.setValue(c);
      this.setProps(c);
    }
  }
}

Accessory.prototype.allocate = function(c) {

  var self = this;
  var sc = this.service.getCharacteristic(this.Characteristic[c]);
  
  sc.on('get', function(callback, context) {self.get(callback, context, this.displayName, self)});
  if (sc.props.perms.indexOf("pw") > -1) { 
    //this.log("Accessory.allocate 'set' event %s %s", this.name, c);
    sc.on('set', function(value, callback, context) {self.set(value, callback, context, this.displayName, self)});
  }
}

Accessory.prototype.setValue = function(c) {

  this.i_value[c] = 0; // todo read config-punt.json
}

Accessory.prototype.setProps = function(c) {

  //this.log("Accessory.setProps %s %s %s", this.name, this.service_name, c, JSON.stringify(this.config_accessory));
  if (this.config_accessory[c]) {
    this.log.debug("Accessory.setProps %s %s %s", this.name, this.service_name, c, this.config_accessory[c]);
    this.service.getCharacteristic(this.Characteristic[c]).setProps(this.config_accessory[c]);
  }
}

Accessory.prototype.get = function(callback, context, displayName, self) {
  
  var c = displayName.replace(/\s/g, "");
  //self.log("Accessory.get %s", c);
  if (self.gateway.run) {
    self.Gateway.get(c, callback, context);
  }
  else {
    if (self.simulator.run) self.Simulator.get(self.index, c, callback, context);
  }
}

Accessory.prototype.set = function(value, callback, context, displayName, self) {

  var c = displayName.replace(/\s/g, "");
  //self.log("Accessory.set %s", c);  
  if (self.gateway.run) {
    self.Gateway.set(c, value, callback, context);
  }
  else {
    if (self.simulator.run) self.Simulator.set(self.index, c, value, callback, context);
  }
}

Accessory.prototype.characteristic_change = function(objValue) {

  if (this.puntview.run) this.PuntView.characteristic_change(this.index, objValue);
  if (this.simulator.run) this.Simulator.characteristic_change(this.index, objValue);
}

Accessory.prototype.identify = function (callback) {

  this.log("%s identify requested.", this.name);
  if (this.gateway.run && "On" in this.i_value) {
    this.Gateway.identify(callback);
  }
  else {
    // todo if (this.simulator.run) this.Simulator.identify(callback);
    callback();
  }
}

Accessory.prototype.getServices = function() {
  return [this.service];
}
