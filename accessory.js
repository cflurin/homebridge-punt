/* config.json example
{
  "gateway": {
    "name": "punt",
    "url": "127.0.0.1",
    "port": "8083",
    "auth": {"user": "foo", "password": "bar"},
    "longpoll": true
  },
    
  "monitor": {
    "port": "8081",
    "run": true
  },
      
  "accessories": [
    {
      "name": "alarm_control",
      "service": "Switch"
    },
    {
      "name": "temp_control",
      "service": "Switch"
    },
    {
      "name": "flex_lamp",
      "service": "Outlet"
    },
    {
      "name": "temp_office",
      "service": "TemperatureSensor"
    },
    {
      "name": "led_bulb",
      "service": "Lightbulb"
    },
    {
      "name": "bathroom_blind",
      "service": "WindowCovering",
      "operationmode": "venetian"
    }
  ]
}
*/

'use strict';

var Gateway = require('./gateway.js').Gateway;

module.exports = {
  Accessory: Accessory
}

function Accessory(log, p_config, index, Service, Characteristic) {

  //this.log("p_config: %s", JSON.stringify(p_config));
  this.log = log;
  this.i_accessory = p_config.accessories[index];
  this.name = this.i_accessory.name;
  this.i_service = this.i_accessory.service;
  
  //this.log("name: %s service: %s", this.name, this.i_service);
  this.operationmode = this.i_accessory["operationmode"] || "roller";
  
  this.service;
  this.i_device = {};
  this.i_characteristic = {};
  this.i_value = {};
 
  this.Gateway = new Gateway(this.log, p_config, index, this.i_device, this.i_characteristic, this.i_value, Characteristic);
  
  if (this.i_service.match(/^Custom/)) {
    this.custom_service(Service, Characteristic);
  }
  else {
    this.predifined_service(Service, Characteristic);
  }
    
  if(p_config.gateway.longpoll) {
    this.Gateway.Longpoll(index);
  }
}


Accessory.prototype.custom_service = function(Service, Characteristic) {

  // todo
  this.log.error("custom_service: '%s' not implemented yet.", this.i_service);
  process.exit(1);
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
        .on('get', function(callback) {this.Gateway.get("ContactSensorState", callback)}.bind(this));
      //this.i_value.ContactSensorState = Characteristic.ContactSensorState.CONTACT_DETECTED;
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
        .on('get', function(callback) {this.Gateway.get("On", callback)}.bind(this)) 
        .on('set', function(value, callback) {this.Gateway.set("On", value, callback)}.bind(this));
      //this.i_value.On = false;
    
      this.i_characteristic.Brightness = this.service
        .addCharacteristic(Characteristic.Brightness)
        .on('get', function(callback) {this.Gateway.get("Brightness", callback)}.bind(this)) 
        .on('set', function(value, callback) {this.Gateway.set("Brightness", value, callback)}.bind(this));
      //this.i_value.Brightness = 0;  // 0 .. 100
        
      this.i_characteristic.Hue = this.service
        .addCharacteristic(Characteristic.Hue)
        .on('get', function(callback) {this.Gateway.get("Hue", callback)}.bind(this))
        .on('set', function(value, callback) {this.Gateway.set("Hue", value, callback)}.bind(this));
      //this.i_value.Hue = 0; // 0 .. 360
        
      this.i_characteristic.Saturation = this.service
        .addCharacteristic(Characteristic.Saturation)
        .on('get', function(callback) {this.Gateway.get("Saturation", callback)}.bind(this))
        .on('set', function(value, callback) {this.Gateway.set("Saturation", value, callback)}.bind(this));
      //this.i_value.Saturation = 0; // 0 .. 100
      break;
      
    case "Outlet":
      this.i_characteristic.OutletInUse = this.service
        .getCharacteristic(Characteristic.OutletInUse)
        .on('get', function(callback) {this.Gateway.get("OutletInUse", callback)}.bind(this));
      //this.i_value.OutletInUse = true;
      
      this.i_characteristic.On = this.service
        .getCharacteristic(Characteristic.On)
        .on('get', function(callback) {this.Gateway.get("On", callback)}.bind(this)) 
        .on('set', function(value, callback) {this.Gateway.set("On", value, callback)}.bind(this));
      //this.i_value.On = false;
      break;
      
    case "Switch":
      this.i_characteristic.On = this.service
        .getCharacteristic(Characteristic.On)
        .on('get', function(callback) {this.Gateway.get("On", callback)}.bind(this)) 
        .on('set', function(value, callback) {this.Gateway.set("On", value, callback)}.bind(this));
      //this.i_value.On = false;
      break;
      
    case "TemperatureSensor":
      this.i_characteristic.CurrentTemperature = this.service
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', function(callback) {this.Gateway.get("CurrentTemperature", callback)}.bind(this))
      //this.i_value.CurrentTemperature = 0;
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
        .on('get', function(callback) {this.Gateway.get("CurrentPosition", callback)}.bind(this))
      this.i_characteristic.CurrentPosition.setProps( { minStep: 5 });
      //this.i_value.CurrentPosition = 0;

      this.i_characteristic.TargetPosition = this.service
        .getCharacteristic(Characteristic.TargetPosition)
        .on('get', function(callback) {this.Gateway.get("TargetPosition", callback)}.bind(this))
        .on('set', function(value, callback) {this.Gateway.set("TargetPosition", value, callback)}.bind(this));
      this.i_characteristic.TargetPosition.setProps( { minStep: 5 });
      //this.i_value.TargetPosition = 0;
        
      this.i_characteristic.PositionState = this.service
        .getCharacteristic(Characteristic.PositionState)
        .on('get', function(callback) {this.Gateway.get("PositionState", callback)}.bind(this));
      //this.i_value.PositionState = Characteristic.PositionState.STOPPED;

      // Optional Characteristics
      if (this.operationmode == "venetian") {

        this.i_characteristic.CurrentHorizontalTiltAngle = this.service
          .addCharacteristic(Characteristic.CurrentHorizontalTiltAngle)
          .on('get', function(callback) {this.Gateway.get("CurrentHorizontalTiltAngle", callback)}.bind(this))
        this.i_characteristic.CurrentHorizontalTiltAngle.setProps({ minValue: 0, minStep: 5 });
        //this.i_value.CurrentHorizontalTiltAngle = 0;

        this.i_characteristic.TargetHorizontalTiltAngle = this.service
          .addCharacteristic(Characteristic.TargetHorizontalTiltAngle)
          .on('get', function(callback) {this.Gateway.get("TargetHorizontalTiltAngle", callback)}.bind(this))
          .on('set', function(value, callback) {this.Gateway.set("TargetHorizontalTiltAngle", value, callback)}.bind(this))
        this.i_characteristic.TargetHorizontalTiltAngle.setProps({ minValue: 0, minStep: 5 });
        //this.i_value.TargetHorizontalTiltAngle = 0;
      }
      break;
      
    case "Service X":
      // add more services here > see HomeKitTypes.js
      // ...
      break;
      
    default:
  }
}


Accessory.prototype.getServices = function() {
  return [this.service];
}
