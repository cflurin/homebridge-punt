'use strict';

var Gateway = require('./gateway.js').Gateway;
var Service, Characteristic, PuntView, Simulator;
var global, gateway, puntview, simulator;
var accessory_config;
var master_accessory;

Number.prototype.pad = function (len) {
    return (new Array(len+1).join("0") + this).slice(-len);
}

module.exports = {
  Accessory: Accessory
}

function Accessory(params) {
     
  this.log = params.log;
 
  //this.log.debug("params.p_config: %s", JSON.stringify(params.p_config));
  
  PuntView = params.PuntView;
  Simulator = params.Simulator;
  Service = params.Service;
  Characteristic = params.Characteristic;
  global = params.p_config.global || { "optionCharacteristics": ""}
  gateway = params.p_config.gateway;
  puntview = params.p_config.puntview || { "run": false };
  simulator = params.p_config.simulator || { "run": false };
  accessory_config =  params.accessory_config;
  
  //this.log.debug("Accessory %s", JSON.stringify(accessory_config));
     
  this.uuid = params.uuid;
  
  this.name = accessory_config.name;
  this.service_name = accessory_config.service;
  
  this.i_device = {};
  this.i_value = {};  
  this.i_label = {};
  this.i_props = {};
  
  this.service;
  
  var g_params = {
    "log": this.log,
    "p_config": params.p_config,
    "Characteristic": Characteristic,
    "name": this.name,
    "service_name": this.service_name,
    "i_device": this.i_device,
    "i_value": this.i_value
  };
       
  if (gateway.run) {
    this.Gateway = new Gateway(g_params);
  }
}

Accessory.prototype.save_and_setValue = function (trigger, t_characteristic, value) {

  var sc = this.service.getCharacteristic(Characteristic[t_characteristic]);
  //this.log.debug("Accessory.save_and_setValue %s %s %s", trigger, t_characteristic, value);
  //this.log.debug("Accessory.save_and_setValue %s", JSON.stringify(sc));
  
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
  //this.log.debug("Accessory.save_and_setValue %s %s %s %s %s ", trigger, this.name, t_characteristic, value, JSON.stringify(context));

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

Accessory.prototype.addService = function(newAccessory) {

  try {
    this.service = new Service[this.service_name](this.name);
  }
  catch (err) {
    this.log.error("Accessory.addService '%s' '%s' undefined.", this.name, this.service_name);
    process.exit(1);
  }
  
  newAccessory.addService(this.service);
}

Accessory.prototype.configureAccessory = function(accessory) {
  
  //this.log.debug("accessory.configureAccessory %s", JSON.stringify(accessory.services));
  this.service = accessory.getService(Service[this.service_name]);
  this.service.on('characteristic-change', this.characteristic_change.bind(this));
 
  // fixme
  accessory.getService(Service.AccessoryInformation).getCharacteristic(Characteristic.Identify)
  .on('set', function(paired, callback) {this.identify(paired, callback)}.bind(this));
    
  var c;
  for (var i in this.service.characteristics) {
  
    c = this.service.characteristics[i].displayName.replace(/\s/g, "");
    //this.log.debug("Accessory.configureAccessory %s %s %s", this.name, this.service_name, c);
    
    if (c != "Name") {
      this.allocate(c);
      this.setProps(c);
      this.i_value[c] = "blank";
      this.i_props[c] = JSON.parse(JSON.stringify(this.service.getCharacteristic(Characteristic[c]).props));
      this.setControl(c);
      //this.log.debug("Accessory.configureAccessory %s %s %s %s", this.name, this.service_name, c, JSON.stringify(this.i_props));
    }
    if (c == "On") {
      this.Gateway.set_eventMap();
    }
  }
  
  for (var i in this.service.optionalCharacteristics) {
  
    c = this.service.optionalCharacteristics[i].displayName.replace(/\s/g, "");
    
    if (typeof(accessory_config[c]) !== "undefined" || global.optionCharacteristics == "all") {
      //this.log.debug("Accessory.configureAccessory %s %s optional %s", this.name, this.service_name, c);
      
      if (c != "Name") {
        this.allocate(c);
        this.setProps(c);
        this.i_value[c] = "blank";
        this.i_props[c] = JSON.parse(JSON.stringify(this.service.getCharacteristic(Characteristic[c]).props));
        this.setControl(c);
      }
    }
  }
   
  if (typeof(master_accessory) === "undefined") {
    master_accessory = accessory.displayName;
    //this.log.debug("Accessory.configureAccessory master_accessory %s", master_accessory);
  }
  
  if (gateway.run && gateway.longpoll) {
    this.Gateway.Longpoll(master_accessory, function(trigger, t_characteristic, value) {
      this.save_and_setValue(trigger, t_characteristic, value);
    }.bind(this));
  }
}

Accessory.prototype.allocate = function(c) {

  var self = this;
  var sc = this.service.getCharacteristic(Characteristic[c]);
  
  sc.on('get', function(callback, context) {self.get(callback, context, this.displayName)});
  if (sc.props.perms.indexOf("pw") > -1) { 
    //this.log.debug("Accessory.allocate 'set' event %s %s", this.name, c);
    sc.on('set', function(value, callback, context) {self.set(value, callback, context, this.displayName)});
  }
}

Accessory.prototype.setProps = function(c) {

  if (typeof(accessory_config[c]) !== "undefined") {
    if (accessory_config[c] != "default") {
      this.service.getCharacteristic(Characteristic[c]).setProps(accessory_config[c]);
    }
    //this.log.debug("Accessory.setProps %s %s %s", this.name, this.service_name, c, accessory_config[c]);
    //this.log.debug("Accessory.setProps %s %s %s", this.name, this.service_name, c, Characteristic[c]);
  }
}

// Controls used by jQueryMobile
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
  else if (/Detected/.test(c)) { // exception ObstructionDetected, MotionDetected (BOOL)
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
        // select option 0 .. 4 todo 0 .. x
        this.i_props[c].control = "select";
        break;
      default:
        this.i_props[c].control = "undefined";
    }
  }
}

Accessory.prototype.get = function(callback, context, displayName) {
  
  var c = displayName.replace(/\s/g, "");
  //this.log.debug("Accessory.get %s", c);
  
  if (gateway.run) {
    this.Gateway.get(c, callback, context);
  }
  else {
    if (simulator.run) Simulator.get(this.uuid, c, callback, context);
  }
}

Accessory.prototype.set = function(value, callback, context, displayName) {

  var c = displayName.replace(/\s/g, "");
  //this.log.debug("Accessory.set 1 %s %s %s %s %s", this.name, this.service_name, c, value, JSON.stringify(context));
  
  this.i_value[c] = value;
  
  if (typeof(context) !== "undefined" && typeof(context.trigger) === "undefined") {
    this.setLabel("homekit", c);
  }

  if (gateway.run) {
    this.Gateway.set(c, value, callback, context);
  }
  else {
    if (simulator.run) Simulator.set(this.uuid, c, value, callback, context);
  }
}

Accessory.prototype.characteristic_change = function(objValue) {

  //this.log.debug("Accessory.c_change %s %s", this.name, this.service_name);
  if (puntview.run) PuntView.characteristic_change(this.uuid, objValue);
  if (simulator.run) Simulator.characteristic_change(this.uuid, objValue);
}

Accessory.prototype.identify = function (paired, callback) {

  this.log.debug("Accessory.identify %s", this.name);
  if (gateway.run && "On" in this.i_value) {
    this.Gateway.identify(callback);
  }
  else {
    // todo if (simulator.run) Simulator.identify(callback);
    // fixme
    // callback();
  }
}

