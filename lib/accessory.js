'use strict';

var Gateway = require('./gateway.js').Gateway;
var PuntView = require('./puntview.js').PuntView;

module.exports = {
  Accessory: Accessory
}

function Accessory(log, p_config, Service, Characteristic, index, PuntView, Simulator) {

  //this.log("p_config: %s", JSON.stringify(p_config));
  this.log = log;
  this.index = index;
  this.PuntView = PuntView;
  this.Simulator = Simulator;
  this.gateway = p_config.gateway;
  
  this.puntview = p_config.puntview || { "run": false };
  this.simulator = p_config.simulator || { "run": false };
    
  this.i_accessory = p_config.accessories[index];
  this.name = this.i_accessory.name;
    
  this.i_device = {};
  this.i_characteristic = {};
  this.i_value = {};
  this.i_service = this.i_accessory.service;
  
  this.service;
    
  if (this.gateway.run) {
    this.Gateway = new Gateway(this.log, p_config, index, this.i_device, this.i_characteristic, this.i_value, Characteristic);
  }
  else {
    if (index == 0) this.log.error("Gateway is not running, Simulator mode.");
  }
  
  if (this.gateway.run && p_config.gateway.longpoll) {
    this.Gateway.Longpoll(index);
  }
  
  if (this.i_service.match(/^Custom/)) {
    this.custom_service(Service, Characteristic);
  }
  else {
    this.predifined_service(Service, Characteristic);
  }
}

Accessory.prototype.predifined_service = function(Service, Characteristic) {

  try {
    this.service = new Service[this.i_service](this.name);
  }
  catch (err) {
    this.log.error("Service '%s' undefined.", this.i_service);
    process.exit(1);
  }

  this.i_characteristic.service = this.i_service;
  //this.log("name: %s service: %s", this.name, this.i_characteristic.service);
  
  switch (this.i_service) {
  
    case "ContactSensor":
      this.i_characteristic.ContactSensorState = this.service
        .getCharacteristic(Characteristic.ContactSensorState)
        .on('get', function(callback) {this.get("ContactSensorState", callback)}.bind(this));
      this.i_value.ContactSensorState = Characteristic.ContactSensorState.CONTACT_DETECTED;
      break;
      
    case "Lightbulb":
      /*
      Accessory: ZWave Aeotec LED Bulb ZW098-C55
      The attribute in fhem.cfg has to be added (replace led_bulb with the name of your device):

      attr led_bulb userReadings onoff {ReadingsVal("led_bulb","state","") =~/^on|^off/?
      ReadingsVal("led_bulb","state",""):ReadingsVal("led_bulb","onoff","")},dim {ReadingsVal("led_bulb","state","") 
      =~/^dim/?ReadingsNum("led_bulb","state",""):ReadingsVal("led_bulb","dim","")},rgb 
      {ReadingsVal("led_bulb","state","") =~/^rgb/?substr(ReadingsVal("led_bulb","state",""),
      4):ReadingsVal("led_bulb","rgb","")} 
      */
         
      this.i_characteristic.On = this.service
        .getCharacteristic(Characteristic.On)
        .on('get', function(callback) {this.get("On", callback)}.bind(this)) 
        .on('set', function(value, callback) {this.set("On", value, callback)}.bind(this));
      this.i_value.On = false;
      
      this.i_characteristic.Brightness = this.service
        .addCharacteristic(Characteristic.Brightness)
        .on('get', function(callback) {this.get("Brightness", callback)}.bind(this)) 
        .on('set', function(value, callback) {this.set("Brightness", value, callback)}.bind(this));
      this.i_value.Brightness = 0;  // 0 .. 100
        
      var color_light = true; // todo detect dimmable, color light
      
      if (color_light) {
        this.i_characteristic.Saturation = this.service
          .addCharacteristic(Characteristic.Saturation)
          .on('get', function(callback) {this.get("Saturation", callback)}.bind(this))
          .on('set', function(value, callback) {this.set("Saturation", value, callback)}.bind(this));
        this.i_value.Saturation = 0; // 0 .. 100
        
        this.i_characteristic.Hue = this.service
          .addCharacteristic(Characteristic.Hue)
          .on('get', function(callback) {this.get("Hue", callback)}.bind(this))
          .on('set', function(value, callback) {this.set("Hue", value, callback)}.bind(this));
        this.i_value.Hue = 0; // 0 .. 360
      }
      break;

    case "Outlet":
      this.i_characteristic.On = this.service
        .getCharacteristic(Characteristic.On)
        .on('get', function(callback) {this.get("On", callback)}.bind(this)) 
        .on('set', function(value, callback) {this.set("On", value, callback)}.bind(this));
      this.i_value.On = false;
      
      this.i_characteristic.OutletInUse = this.service
        .getCharacteristic(Characteristic.OutletInUse)
        .on('get', function(callback) {this.get("OutletInUse", callback)}.bind(this));
      this.i_value.OutletInUse = true;
      break;
      
    case "Switch":
      this.i_characteristic.On = this.service
        .getCharacteristic(Characteristic.On)
        .on('get', function(callback) {this.get("On", callback)}.bind(this))
        .on('set', function(value, callback) {this.set("On", value, callback)}.bind(this));
      this.i_value.On = false;
      break;
      
    case "TemperatureSensor":
      this.i_characteristic.CurrentTemperature = this.service
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', function(callback) {this.get("CurrentTemperature", callback)}.bind(this));
      this.i_characteristic.CurrentTemperature.setProps({ maxValue: 80, minValue: -20 });
      this.i_value.CurrentTemperature = 0;
      break;
    
    case "WindowCovering":
      /*
      Accessory: ZWave FIBARO System FGRM-222 Roller Shutter 2
      The following attribute in fhem.cfg has to be added (replace bathroom_blind with the name of your device):
      
      dim {ReadingsVal("bathroom_blind","state","")=~/^dim/?ReadingsNum("bathroom_blind","state","")=~/^99/?100:ReadingsNum("bathroom_blind","state","")=~/^1$/?0:ReadingsNum("bathroom_blind","state",""):ReadingsVal("bathroom_blind","dim","")},positionSlat {ReadingsVal("bathroom_blind","state","")=~/^positionSlat/?ReadingsNum("bathroom_blind","state",""):ReadingsVal("bathroom_blind","positionSlat","")}
      */
      
      // Required Characteristics
      this.i_characteristic.CurrentPosition = this.service
        .getCharacteristic(Characteristic.CurrentPosition)
        .on('get', function(callback) {this.get("CurrentPosition", callback)}.bind(this))
      this.i_characteristic.CurrentPosition.setProps( { minStep: 5 });
      this.i_value.CurrentPosition = 0;

      this.i_characteristic.TargetPosition = this.service
        .getCharacteristic(Characteristic.TargetPosition)
        .on('get', function(callback) {this.get("TargetPosition", callback)}.bind(this))
        .on('set', function(value, callback) {this.set("TargetPosition", value, callback)}.bind(this));
      this.i_characteristic.TargetPosition.setProps( { minStep: 5 });
      this.i_value.TargetPosition = 0;
        
      this.i_characteristic.PositionState = this.service
        .getCharacteristic(Characteristic.PositionState)
        .on('get', function(callback) {this.get("PositionState", callback)}.bind(this));
      this.i_value.PositionState = Characteristic.PositionState.STOPPED;

      // Optional Characteristics
      var operationmode = this.i_accessory.operationmode || "roller";
      if (operationmode == "venetian") {

        this.i_characteristic.CurrentHorizontalTiltAngle = this.service
          .addCharacteristic(Characteristic.CurrentHorizontalTiltAngle)
          .on('get', function(callback) {this.get("CurrentHorizontalTiltAngle", callback)}.bind(this))
        this.i_characteristic.CurrentHorizontalTiltAngle.setProps({ minValue: 0, minStep: 5 });
        this.i_value.CurrentHorizontalTiltAngle = 0;

        this.i_characteristic.TargetHorizontalTiltAngle = this.service
          .addCharacteristic(Characteristic.TargetHorizontalTiltAngle)
          .on('get', function(callback) {this.get("TargetHorizontalTiltAngle", callback)}.bind(this))
          .on('set', function(value, callback) {this.set("TargetHorizontalTiltAngle", value, callback)}.bind(this))
        this.i_characteristic.TargetHorizontalTiltAngle.setProps({ minValue: 0, minStep: 5 });
        this.i_value.TargetHorizontalTiltAngle = 0;
      }
      break;
      
    case "Service X":
      // add more services here > see HomeKitTypes.js
      // ...
      break;
      
    default:
  }
}

Accessory.prototype.custom_service = function(Service, Characteristic) {

  // todo
  this.log.error("custom_service: '%s' not implemented yet.", this.i_service);
  process.exit(1);
}

Accessory.prototype.get = function(t_characteristic, callback) {
  //this.log("Accessory.get %s %s", t_characteristic);
  if (this.gateway.run) this.Gateway.get(t_characteristic, callback);
  if (this.simulator.run) this.Simulator.get(t_characteristic, this.index, this.gateway, callback);
  if (this.puntview.run) this.PuntView.get(t_characteristic, this.index, callback);
}

Accessory.prototype.set = function(t_characteristic, value, callback) {
  //this.log("Accessory.set %s %s", t_characteristic, value);
  if (this.gateway.run) this.Gateway.set(t_characteristic, value, callback);
  if (this.simulator.run) this.Simulator.set(t_characteristic, this.index, value, this.gateway, callback);
  if (this.puntview.run) this.PuntView.set(t_characteristic, this.index, value, callback);
}

Accessory.prototype.getServices = function() {
  return [this.service];
}
