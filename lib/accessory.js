'use strict';

var Gateway = require('./gateway.js').Gateway;

Number.prototype.pad = function (len) {
    return (new Array(len+1).join("0") + this).slice(-len);
}

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
  this.global = p_config.global || { "optionCharacteristics": ""}
    
  this.puntview = p_config.puntview || { "run": false };
  this.simulator = p_config.simulator || { "run": false };
    
  this.config_accessory = p_config.accessories[index];
  this.name = this.config_accessory.name;
  this.service_name = this.config_accessory.service;
      
  this.i_device = {};
  this.i_value = {};  
  this.i_label = {};
  this.i_props = {};
  
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
  
  var sc = this.service.getCharacteristic(this.Characteristic[t_characteristic]);
  
  switch (sc.props.format) {
    case "bool":
      if (value == "undef") value = false;
      value = (value == 0 || value == false) ? false : true;
      break;
      
    case "int":
    case "uint8":
    case "uint16":
    case "unit32":
    case "float":
      if (value == "undef") value = 0;
      if (value < sc.props.minValue || value > sc.props.maxalue) {
        this.log.error("Accessory.save_and_setValue %s %s value >%s< outside range [trigger: %s].", this.name, t_characteristic, value, trigger);
      }
      break;

    default:
      // todo string, tlv8, 
      this.log.warn("Accessory.save_and_setValue %s %s %s format unknown [trigger: %s].", this.name, t_characteristic, value, trigger);
  }
  
  this.i_value[t_characteristic] = value;
  this.setLabel(trigger, t_characteristic);

  var context = this.i_label[t_characteristic];
  //context is also used by the hap-server ('get' and 'set' event) - "context": {"keepalive":true, ...
  //this.log("Accessory.save_and_setValue %s %s %s %s %s ", trigger, this.name, t_characteristic, value, JSON.stringify(context));

  if (typeof(context) !== "undefined") {
    sc.setValue(value, null, context);
  }
  else {
    sc.setValue(value);
  }
}

Accessory.prototype.setLabel = function(trigger, t_characteristic) {

  var now = new Date();
  var timestamp = now.getHours().pad(2)+":"+now.getMinutes().pad(2)+":"+now.getSeconds().pad(2);
   // +","+now.getMilliseconds(); 
  
  this.i_label[t_characteristic] = {
    "timestamp": timestamp,
    "trigger": trigger
  };
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
    this.log.error("Accessory.p_service Service '%s' undefined.", this.service_name);
    process.exit(1);
  }
  
  this.service.on('characteristic-change', this.characteristic_change.bind(this));
    
  var c;
  for (var i in this.service.characteristics) {
  
    c = this.service.characteristics[i].displayName.replace(/\s/g, "");
    //this.log("Accessory.p_service %s %s %s", this.name, this.service_name, c);
    
    if (c != "Name") {
      this.allocate(c);
      this.setProps(c);
      this.i_value[c] = "blank";
      this.i_props[c] = this.service.getCharacteristic(this.Characteristic[c]).props;
      this.setControl(c);
      //this.log.debug("Accessory.p_service %s %s %s %s", this.name, this.service_name, c, JSON.stringify(this.i_props));
    }
  }
  
  for (var i in this.service.optionalCharacteristics) {
  
    c = this.service.optionalCharacteristics[i].displayName.replace(/\s/g, "");
    
    if (typeof(this.config_accessory[c]) !== "undefined" || this.global.optionCharacteristics == "all") {
      //this.log.debug("Accessory.p_service %s %s optional %s", this.name, this.service_name, c);
      
      if (c != "Name") {
        this.allocate(c);
        this.setProps(c);
        this.i_value[c] = "blank";
        this.i_props[c] = this.service.getCharacteristic(this.Characteristic[c]).props;
        this.setControl(c);
      }
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

Accessory.prototype.setProps = function(c) {

  if (typeof(this.config_accessory[c]) !== "undefined") {
    if (this.config_accessory[c] != "default") {
      this.service.getCharacteristic(this.Characteristic[c]).setProps(this.config_accessory[c]);
    }
    //this.log.debug("Accessory.setProps %s %s %s", this.name, this.service_name, c, this.config_accessory[c]);
    //this.log("Accessory.setProps %s %s %s", this.name, this.service_name, c, this.Characteristic[c]);
  }
}

// Contols used by jQueryMobile
Accessory.prototype.setControl = function (c) {

  if (this.i_props[c].format == "bool") {
    this.i_props[c].control = "button";
  }
  else if (this.i_props[c].minValue != null) {
    this.i_props[c].control = "slider";
  }
  else if (/Status/.test(c)) {
    this.i_props[c].control = "flipswitch";
    //this.log.debug("%s %s %s", this.name, this.service_name, this.i_props[c].control);
  }
  else if (/Detected/.test(c)) {
    this.i_props[c].control = "flipswitch_d";
  }
  else {
    // todo general selction
    switch (c) {
      case "ChargingState":
      case "ContactSensorState":
      case "LockTargetState":
      case "TargetDoorState":
        this.i_props[c].control = "flipswitch";
        break;
      case "ContactSensorState":
        this.i_props[c].control = "flipswitch_d";
        break;
      case "CurrentDoorState": // 4
      case "LockCurrentState": // 3
      case "PositionState": // 2
      case "SecuritySystemCurrentState":  // 4
      case "SecuritySystemTargetState":  // 3
      case "TargetHeatingCoolingState":  // 3
        // select option 0.. 4 todo 0 .. x
        this.i_props[c].control = "select";
        break;
      default:
        this.i_props[c].control = "undefined";
    }
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
  //self.log.debug("Accessory.set 1 %s %s %s %s %s", this.name, this.service_name, c, value, JSON.stringify(context));
  
  this.i_value[c] = value;
  
  if (typeof(context) !== "undefined" && typeof(context.trigger) === "undefined") {
    this.setLabel("homekit", c);
  }

  if (self.gateway.run) {
    self.Gateway.set(c, value, callback, context);
  }
  else {
    if (self.simulator.run) self.Simulator.set(self.index, c, value, callback, context);
  }
}

Accessory.prototype.characteristic_change = function(objValue) {

  //this.log.debug("Accessory.c_change %s %s", this.name, this.service_name);
  if (this.puntview.run) this.PuntView.characteristic_change(this.index, objValue);
  if (this.simulator.run) this.Simulator.characteristic_change(this.index, objValue);
}

Accessory.prototype.identify = function (callback) {

  this.log.debug("%s identify requested.", this.name);
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
