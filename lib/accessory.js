'use strict';

var Gateway = require('./gateway.js').Gateway;
//var PuntView = require('./puntview.js').PuntView;

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
    
  this.i_accessory = p_config.accessories[index];
  this.name = this.i_accessory.name;
  this.service_name = this.i_accessory.service;
      
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
    this.Gateway = new Gateway(this.log, p_config, Characteristic, this.props);
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
    this.custom_service(Service, Characteristic);
  }
  else {
    this.predifined_service(Service, Characteristic);
  }
}

Accessory.prototype.save_and_setValue = function (trigger, t_characteristic, value) {

  //this.log("Accessory.save_and_setValue %s %s %s", trigger, t_characteristic, value);
  
  // same as the old shim todo test why?
  switch (t_characteristic) {
    case "Hue":
    case "saturation":
    case "Brightness":
      // nothing
    break;
    default:
      this.saveValue(trigger, t_characteristic, value); 
  }
  
  // context is also used by the hap-server ('get' and 'set' event) - "context": {"keepalive":true, ...
  var context = this.i_label[t_characteristic];
  
  this.service.getCharacteristic(this.Characteristic[t_characteristic]).setValue(value, null, context);  
  if (this.puntview.run) this.PuntView.refresh(this.index, t_characteristic);
      
  // test getValue()
  //this.service.getCharacteristic(this.Characteristic[t_characteristic]).getValue(function(err, newValue) {
  //  this.log("Accessory.getValue %s %s %s", err, newValue, JSON.stringify(context));
  //}.bind(this), context);
}

Accessory.prototype.saveValue = function(trigger, t_characteristic, value) {

  var now = new Date();
  var timestamp = now.getHours()+":"+now.getMinutes()+":"+now.getSeconds(); // +","+now.getMilliseconds(); 
  
  this.i_label[t_characteristic] = {
    "timestamp": timestamp,
    "trigger": trigger
  };
  
  if (value != "undef") this.i_value[t_characteristic] = value;
}
 
Accessory.prototype.get_i_value = function (i_value) {
  return this.i_value;
}

Accessory.prototype.set_i_value = function (i_value) {
  this.i_value = i_value;
}

Accessory.prototype.predifined_service = function(Service, Characteristic) {

  try {
    this.service = new Service[this.service_name](this.name);
  }
  catch (err) {
    this.log.error("Service '%s' undefined.", this.service_name);
    process.exit(1);
  }

  var c;
  switch (this.service_name) {
  
    case "ContactSensor":
      c = "ContactSensorState";
      this.service
        .on('characteristic-change', function(objValue) {this.characteristic_change("ContactSensorState", objValue)}.bind(this))
        .getCharacteristic(Characteristic[c])
        .on('get', function(callback, context, displayName) {this.get("ContactSensorState", callback, context, displayName)}.bind(this));
      this.i_value[c] = Characteristic[c].CONTACT_DETECTED;
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
        
      c = "On";
      this.service
        .on('characteristic-change', function(objValue) {this.characteristic_change("On", objValue)}.bind(this))
        .getCharacteristic(Characteristic[c])
        .on('get', function(callback, context, displayName) {this.get("On", callback, context, displayName)}.bind(this)) 
        .on('set', function(value, callback, context, displayName) {this.set("On", value, callback, context, displayName)}.bind(this));
      this.i_value[c] = false;
      
      c = "Brightness";
      this.service
        .on('characteristic-change', function(objValue) {this.characteristic_change("Brightness", objValue)}.bind(this))
        .addCharacteristic(Characteristic[c])
        .on('get', function(callback, context, displayName) {this.get("Brightness", callback, context, displayName)}.bind(this)) 
        .on('set', function(value, callback, context, displayName) {this.set("Brightness", value, callback, context, displayName)}.bind(this));
      this.i_value[c] = 0;  // 0 .. 100
      
      var color_light = true; // todo detect dimmable, color light
      
      if (color_light) {
        c = "Saturation";
        this.service
          .on('characteristic-change', function(objValue) {this.characteristic_change("Saturation", objValue)}.bind(this))
          .addCharacteristic(Characteristic[c])
          .on('get', function(callback, context, displayName) {this.get("Saturation", callback, context, displayName)}.bind(this))
          .on('set', function(value, callback, context, displayName) {this.set("Saturation", value, callback, context, displayName)}.bind(this));
        this.i_value[c] = 0; // 0 .. 100
        
        c = "Hue";
        this.service
          .on('characteristic-change', function(objValue) {this.characteristic_change("Hue", objValue)}.bind(this))
          .addCharacteristic(Characteristic[c])
          .on('get', function(callback, context, displayName) {this.get("Hue", callback, context, displayName)}.bind(this))
          .on('set', function(value, callback, context, displayName) {this.set("Hue", value, callback, context, displayName)}.bind(this));
        this.i_value[c] = 0; // 0 .. 360
      }
      break;

    case "Outlet":
      c = "On";
      this.service
        .on('characteristic-change', function(objValue) {this.characteristic_change("On", objValue)}.bind(this))
        .getCharacteristic(Characteristic[c])
        .on('get', function(callback, context, displayName) {this.get("On", callback, context, displayName)}.bind(this)) 
        .on('set', function(value, callback, context, displayName) {this.set("On", value, callback, context, displayName)}.bind(this));
      this.i_value[c] = false;
      
      c = "OutletInUse";
      this.service
        .on('characteristic-change', function(objValue) {this.characteristic_change("OutletInUse", objValue)}.bind(this))
        .getCharacteristic(Characteristic[c])
        .on('get', function(callback, context, displayName) {this.get("OutletInUse", callback, context, displayName)}.bind(this));
      this.i_value[c] = true;
      break;
      
    case "Switch":
      c = "On";
      this.service
        .on('characteristic-change', function(objValue) {this.characteristic_change("On", objValue)}.bind(this))
        .getCharacteristic(Characteristic[c])
        .on('get', function(callback, context, displayName) {this.get("On", callback, context, displayName)}.bind(this))
        .on('set', function(value, callback, context, displayName) {this.set("On", value, callback, context, displayName)}.bind(this));
      this.i_value[c] = false;
      break;
      
    case "TemperatureSensor":
      c = "CurrentTemperature";
      this.service
        .on('characteristic-change', function(objValue) {this.characteristic_change("CurrentTemperature", objValue)}.bind(this))
        .getCharacteristic(Characteristic[c])
        .on('get', function(callback, context, displayName) {this.get("CurrentTemperature", callback, context, displayName)}.bind(this));
      this.service.getCharacteristic(this.Characteristic[c]).setProps({ maxValue: 80, minValue: -20 });
      this.i_value[c] = 0;
      break;
    
    case "WindowCovering":
      /*
      Accessory: ZWave FIBARO System FGRM-222 Roller Shutter 2
      The following attribute in fhem.cfg has to be added (replace bathroom_blind with the name of your device):
      
      dim {ReadingsVal("bathroom_blind","state","")=~/^dim/?ReadingsNum("bathroom_blind","state","")=~/^99/?100:ReadingsNum("bathroom_blind","state","")=~/^1$/?0:ReadingsNum("bathroom_blind","state",""):ReadingsVal("bathroom_blind","dim","")},positionSlat {ReadingsVal("bathroom_blind","state","")=~/^positionSlat/?ReadingsNum("bathroom_blind","state",""):ReadingsVal("bathroom_blind","positionSlat","")}
      */
      
      // Required Characteristics
      c = "CurrentPosition";
      this.service
        .on('characteristic-change', function(objValue) {this.characteristic_change("CurrentPosition", objValue)}.bind(this))
        .getCharacteristic(Characteristic[c])
        .on('get', function(callback, context, displayName) {this.get("CurrentPosition", callback, context, displayName)}.bind(this));
      this.service.getCharacteristic(this.Characteristic[c]).setProps({ minStep: 5 });
      this.i_value[c] = 0;
      
      c = "TargetPosition";
      this.service
        .on('characteristic-change', function(objValue) {this.characteristic_change("TargetPosition", objValue)}.bind(this))
        .getCharacteristic(Characteristic[c])
        .on('get', function(callback, context, displayName) {this.get("TargetPosition", callback, context, displayName)}.bind(this))
        .on('set', function(value, callback, context, displayName) {this.set("TargetPosition", value, callback, context, displayName)}.bind(this));
      this.service.getCharacteristic(this.Characteristic[c]).setProps({ minStep: 5 });
      this.i_value[c] = 0;
      
      c = "PositionState";
      this.service
        .on('characteristic-change', function(objValue) {this.characteristic_change("PositionState", objValue)}.bind(this))
        .getCharacteristic(Characteristic[c])
        .on('get', function(callback, context, displayName) {this.get("PositionState", callback, context, displayName)}.bind(this));
      this.i_value[c] = Characteristic[c].STOPPED;
      
      // Optional Characteristics
      var operationmode = this.i_accessory.operationmode || "roller";
      if (operationmode == "venetian") {
        
        c = "CurrentHorizontalTiltAngle";
        this.service
          .on('characteristic-change', function(objValue) {this.characteristic_change("CurrentHorizontalTiltAngle", objValue)}.bind(this))
          .addCharacteristic(Characteristic[c])
          .on('get', function(callback, context, displayName) {this.get("CurrentHorizontalTiltAngle", callback, context, displayName)}.bind(this));
        this.service.getCharacteristic(this.Characteristic[c]).setProps({ minValue: 0, minStep: 5 });
        this.i_value[c] = 0;
        
        c = "TargetHorizontalTiltAngle";
        this.service
          .on('characteristic-change', function(objValue) {this.characteristic_change("TargetHorizontalTiltAngle", objValue)}.bind(this))
          .addCharacteristic(Characteristic[c])
          .on('get', function(callback, context, displayName) {this.get("TargetHorizontalTiltAngle", callback, context, displayName)}.bind(this))
          .on('set', function(value, callback, context, displayName) {this.set("TargetHorizontalTiltAngle", value, callback, context, displayName)}.bind(this));
        this.service.getCharacteristic(this.Characteristic[c]).setProps({ minValue: 0, minStep: 5 });
        this.i_value[c] = 0;
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
  this.log.error("custom_service: '%s' not implemented yet.", this.service_name);
  process.exit(1);
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

Accessory.prototype.get = function(t_characteristic, callback, context, displayName) {
  //var logmsg = (context) ? JSON.stringify(context).substring(0, 70) : "no context";
  //this.log("Accessory.get %s %s", this.index, logmsg);
  //this.log("\nAccessory.get displayName %s %s", this.name, displayName.replace(/\s/g, ""));

  if (this.gateway.run) {
    this.Gateway.get(t_characteristic, callback, context);
  }
  else {
    if (this.simulator.run) this.Simulator.get(this.index, t_characteristic, callback, context);
  }
}

Accessory.prototype.set = function(t_characteristic, value, callback, context, displayName) {
 
  //var logmsg = (context) ? JSON.stringify(context).substring(0, 70) : "no context";
  //this.log("Accessory.set %s %s", this.index, logmsg);
  //this.log("\nAccessory.set displayName %s %s", this.name, displayName.replace(/\s/g, ""));
  
  if (this.gateway.run) {
    this.Gateway.set(t_characteristic, value, callback, context);
  }
  else {
    if (this.simulator.run) this.Simulator.set(this.index, t_characteristic, value, callback, context);
  }
  // todo: this.saveValue("homekit", t_characteristic, "undef");
}

Accessory.prototype.characteristic_change = function(t_characteristic, objValue) {
  //this.log("Accessory.c_change %s %s", this.name, JSON.stringify(objValue));
  //this.log("Accessory.c_change %s %s", this.name, objValue.characteristic.displayName.replace(/\s/g, ""));

  if (this.puntview.run) this.PuntView.characteristic_change(this.index, t_characteristic, objValue);
  if (this.simulator.run) this.Simulator.characteristic_change(this.index, t_characteristic, objValue);
}

Accessory.prototype.getServices = function() {
  return [this.service];
}
