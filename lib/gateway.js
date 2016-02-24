'use strict';

var Utils = require('./utils.js').Utils;
var request = require('request');

var Characteristic;
var p_config, base_url, longpoll_running;
var timeoutObj;

module.exports = {
  Gateway: Gateway
}

var reading = {};

reading.ContactSensor = {};
reading.ContactSensor.ContactSensorState = "state";

/*
Accessory Lightbulb: ZWave Aeotec LED Bulb ZW098-C55
The attribute in fhem.cfg has to be added (replace led_bulb with the name of your device):

attr led_bulb userReadings onoff {ReadingsVal("led_bulb","state","") =~/^on|^off/?
ReadingsVal("led_bulb","state",""):ReadingsVal("led_bulb","onoff","")},dim {ReadingsVal("led_bulb","state","") 
=~/^dim/?ReadingsNum("led_bulb","state",""):ReadingsVal("led_bulb","dim","")},rgb 
{ReadingsVal("led_bulb","state","") =~/^rgb/?substr(ReadingsVal("led_bulb","state",""),
4):ReadingsVal("led_bulb","rgb","")} 
*/
reading.Lightbulb = {};
reading.Lightbulb.On = "onoff";
reading.Lightbulb.Hue = "rgb";
reading.Lightbulb.Saturation = "rgb";
reading.Lightbulb.Brightness = "dim";

reading.LightSensor = {};
reading.LightSensor.CurrentAmbientLightLevel = "luminance";

reading.MotionSensor = {};
reading.MotionSensor.MotionDetected = "state";

reading.Outlet = {};
reading.Outlet.On = "state";
//reading.Outlet.OutletInUse = ""; // todo

/*
Accessory SmokeSenor: ZWave FIBARO System FGSD002 Smoke Sensor
The attribute in fhem.cfg has to be added (replace smoke_living with the name of your device):
smoke-alarm {ReadingsVal("smoke_living","alarm","") =~/00/ ? 0 : 1}
*/
reading.SmokeSensor = {};
reading.SmokeSensor.SmokeDetected = "smoke-alarm";

reading.BatteryService = {};
reading.BatteryService.BatteryLevel = "battery";

reading.Switch = {};
reading.Switch.On = "state";

reading.TemperatureSensor = {};
reading.TemperatureSensor.CurrentTemperature = "temperature";

/*
Accessory WindowsCovering: ZWave FIBARO System FGRM-222 Roller Shutter 2
The following attribute in fhem.cfg has to be added (replace bathroom_blind with the name of your device):

dim {ReadingsVal("bathroom_blind","state","")=~/^dim/?ReadingsNum("bathroom_blind","state","")=~/^99/?
100:ReadingsNum("bathroom_blind","state","")=~/^1$/?
0:ReadingsNum("bathroom_blind","state",""):ReadingsVal("bathroom_blind","dim","")},positionSlat 
{ReadingsVal("bathroom_blind","state","")=~/^positionSlat/?
ReadingsNum("bathroom_blind","state",""):ReadingsVal("bathroom_blind","positionSlat","")}
*/

reading.WindowCovering = {};
//reading.WindowCovering.PositionState = ""; // todo
reading.WindowCovering.CurrentPosition = "dim";
reading.WindowCovering.TargetPosition = "dim";
reading.WindowCovering.CurrentHorizontalTiltAngle = "positionSlat";
reading.WindowCovering.TargetHorizontalTiltAngle = "positionSlat";


function Gateway(params) {
  
  Characteristic = params.Charactereistic;
  p_config = params.p_config;
  //this.log.debug("p_config %s", JSON.stringify(p_config));
  
  this.log = params.log;
  this.name = params.name;
  this.service_name = params.service_name;
  this.i_device = params.i_device;
  this.i_value = params.i_value;
  
  this.i_device.name = this.name.split(".")[0];  // e.g. multi_living.motion, mult_living.light, multi_living.battery 

  this.eventMap = {};
  this.c_undef = [];
  
  var url = p_config.gateway.url;
  var port = p_config.gateway.port;
  var auth = p_config.gateway.auth;

  longpoll_running = false;
  
  base_url = 'http://' + url + ':' + port;
  
  if (auth) {
    if (auth.sendImmediately == undefined) {
      auth.sendImmediately = false;
    }
    this.request = request.defaults({ "auth": auth, "rejectUnauthorized": false });
  }
  else {
    this.request = request.defaults();
  }
}

Gateway.prototype.identify = function(callback) {
  
  var cmd = 'set ' + this.i_device.name + ' ' + 'on-for-timer 2';
  
  var fhem_url = base_url + '/fhem?cmd=' + cmd + '&XHR=1';    
  //this.log.debug(fhem_url);
      
  this.request({url: fhem_url}, function(err, response, body) {

    if (!err && response.statusCode == 200) {
      callback();
    } 
    else {
      callback(err);
      this.log.error("Gateway.identify %s %s", this.name, err);
      if (response) this.log.error("statusCode: %s Message: %s", response.statusCode, response.statusMessage);
    }
  }.bind(this));
}

Gateway.prototype.set_eventMap = function() {

  this.eventMap.on = "on";
  this.eventMap.off = "off";
  
  this.get_type();
}

Gateway.prototype.get_type = function() {

  //this.log.debug("Gateway.get_type %s", JSON.stringify(this.i_value));

  var cmd = '{InternalVal("' + this.i_device.name + '","TYPE","")}';
  var gateway_url = base_url + '/fhem?cmd=' + cmd + '&XHR=1';
  //this.log.debug("Gateway.get_type gateway_url %s", gateway_url);
  //this.log.debug("Gateway.get_type query %s", this.name);
  
  this.request.get({url: gateway_url}, function(err, response, body) {
    
    if (!err && response.statusCode == 200) {
      var r_value = body.trim();
      this.i_device.type = r_value;
      if (this.i_device.type == "") {
        this.log.debug("Gateway.get_type %s >%s< device undefined", this.name, r_value);
      }
      if (this.i_device.type == "EnOcean") this.get_eventMap();
    } 
    else {
      this.log.error("Gateway.get_type %s %s", this.name, err);
      if (response) this.log.error("statusCode: %s Message: %s", response.statusCode, response.statusMessage);
    }
  }.bind(this));
}

Gateway.prototype.get_eventMap = function() {

  var cmd = '{AttrVal("' + this.i_device.name + '","eventMap","")}';
  var gateway_url = base_url + '/fhem?cmd=' + cmd + '&XHR=1';
  //this.log.debug("get: gateway_url %s", gateway_url);
  
  this.request.get({url: gateway_url}, function(err, response, body) {
    
    if (!err && response.statusCode == 200) {
      var r_value = body.trim();
      //this.log.debug("get_eventMap: %s %s", this.i_device.name, r_value);
      
      if (r_value) {
        var sets = r_value.split(' ');
        for (var p = 0; p < sets.length; p++) {
          var set = sets[p].split(':');
          if (set[1] == 'on' || set[1] == 'off') {
            this.eventMap[set[1]] = set[0];
          }
        }
        //this.log.debug("get_eventMap: %s %s %s", this.i_device.name, this.eventMap.on, this.eventMap.off);
      }
    } 
    else {
      this.log.error("Gateway.get_eventMap %s %s", this.name, err);
      if (response) this.log.error("statusCode: %s Message: %s", response.statusCode, response.statusMessage);
    }
  }.bind(this));
}

Gateway.prototype.first_get = function(uuid, t_characteristic, callback) {

  //if (this.name.split(".").length > 1) this.log.debug("Gateway.first_get %s %s", this.name, t_characteristic);
  
  this.get(t_characteristic, function(err, value) {
    callback(null, uuid, t_characteristic, value);
  });
}

Gateway.prototype.get = function(t_characteristic, callback, context) {

  //this.log.debug("Gateway.get %s %s", this.name, t_characteristic);
  
  if (this.i_device.type == "") {
    this.callback(this.i_value[t_characteristic], t_characteristic, callback);
    return;
  }
  
  if (typeof(reading[this.service_name]) === "undefined" || 
    (reading[this.service_name] && typeof(reading[this.service_name][t_characteristic]) === "undefined")) {
    // preliminary
    if (this.c_undef.indexOf(t_characteristic) < 0) {
      //this.log.debug("<preliminary> %s %s %s", this.name, this.service_name, t_characteristic);
      this.c_undef.push(t_characteristic);
    }
    this.callback(this.i_value[t_characteristic], t_characteristic, callback);
    return;
  }
    
  if (this.i_value[t_characteristic] != "blank" && p_config.gateway.longpoll) {
    //this.log.debug("Gateway.get cache %s %s >%s<", this.name, t_characteristic, this.i_value[t_characteristic]);
    this.callback(this.i_value[t_characteristic], t_characteristic, callback);
  }
  else {
    //this.log.debug("Gateway.get query %s %s >%s<", this.name, t_characteristic, this.i_value[t_characteristic]);
    
    var cmd = '{ReadingsVal("' + this.i_device.name + '","' + reading[this.service_name][t_characteristic] + '","")}';
    var gateway_url = base_url + '/fhem?cmd=' + cmd + '&XHR=1';
    
    this.request.get({url: gateway_url}, function(err, response, body) {
      
      if (!err && response.statusCode == 200) {
        var r_value = body.trim();
        var p_value = this.parsing(t_characteristic, r_value);
        //this.log.debug("Gateway.get respond %s %s >%s<", this.name, t_characteristic, p_value)
        this.callback(p_value, t_characteristic, callback);
      } 
      else {
        this.log.error("Gateway.get %s %s", this.name, err);
        if (response) this.log.error("statusCode: %s Message: %s", response.statusCode, response.statusMessage);
        callback(err);
      }
    }.bind(this));
  }
}

Gateway.prototype.callback = function(value, t_characteristic, callback) {

  if (value == "blank") {
    //this.log.debug("Gateway.callback %s %s %s", this.name, t_characteristic, value);
    
    // preliminary
    switch (t_characteristic) {
      case "StatusActive":
      case "OutletInUse":
        value = true;
        break;
        
      case "HoldPosition":
        value = false;
        break;
        
      case "PositionState":
        value = Characteristic.PositionState.STOPPED;
        break;
        
      case "StatusFault":
      case "StatusJammed":
      case "StatusLowBattery":
      case "StatusTampered":
        value = 0; // The value property must be 0 or 1  
        break;
        
      default:
      value = 0
    }
    //this.log.debug("Gateway.callback %s %s %s", this.name, t_characteristic, value);
  }
  if (value != this.i_value[t_characteristic]) this.i_value[t_characteristic] = value;
  callback(null, value);
}

Gateway.prototype.parsing = function(t_characteristic, r_value) {
  
  var p_value;
  
  switch (t_characteristic) {
    case "On":
      //this.log.debug("get: %s r_value %s ", this.name, r_value);
      p_value = (r_value == 0 || r_value == this.eventMap.off) ? false : true;
      this.i_value[t_characteristic] = p_value;
      break;
      
    case "OutletInUse":
      //this.log.debug("get: %s r_value %s ", this.name, r_value);
      p_value = true;
      this.i_value[t_characteristic] = p_value;
      break;
      
    case "ContactSensorState":
      p_value = (r_value == "closed") ? Characteristic.ContactSensorState.CONTACT_DETECTED : Characteristic.ContactSensorState.CONTACT_DETECTED;
      this.i_value[t_characteristic] = p_value;
      break;
      
    case "CurrentAmbientLightLevel":
      p_value = parseFloat(r_value.match(/[+-]?\d*\.?\d+/));
      //this.log.debug("Gateway.parsing %s %s %s", this.name, t_characteristic, p_value);
      this.i_value[t_characteristic] = p_value;
      break;
      
    case "MotionDetected":
      //this.log.debug("Gateway.parsing %s %s %s", this.name, t_characteristic, r_value);
      p_value = (r_value == "closed") ? false : true;
      this.i_value[t_characteristic] = p_value;
      break;
      
    case "CurrentPosition":
    case "TargetPosition":
    case "CurrentHorizontalTiltAngle":  
    case "TargetHorizontalTiltAngle":
    case "Brightness":
      p_value = parseInt(r_value);
      this.i_value[t_characteristic] = p_value;
      //this.log.debug("Gatewy.parsing %s %s >%s<", this.name, t_characteristic, r_value);
      break;
      
    case "CurrentTemperature":
      p_value = parseFloat(r_value);
      this.i_value[t_characteristic] = p_value;
      //this.log.debug("get: (%s) %s %s",t_characteristic, this.name, r_value);
      break;
      
    case "Hue":
      var rgb = r_value.split(" ");
      var hsv = Utils.rgb2hsv(rgb[0],rgb[1],rgb[2]);
      
      this.i_value.Hue = parseInt( hsv[0] * 360 );
      this.i_value.Saturation = parseInt( hsv[1] * 100 );
      this.i_value.Brightness = parseInt( hsv[2] * 100 );
      //this.log.debug("get: (%s) h: %s s: %s v: %s", t_characteristic, this.i_value.Hue, this.i_value.Saturation, this.i_value.Brightness);
      //this.log.debug("get: %s %s %s", this.name, t_characteristic, this.i_value.Hue);
      p_value = this.i_value.Hue;
      break;
      
    case "PositionState":
      //this.log.debug("get: %s r_value %s ", this.name, r_value);
      p_value = Characteristic.PositionState.STOPPED;
      this.i_value[t_characteristic] = p_value;
      break;
      
    case "Saturation":
      var rgb = r_value.split(" ");
      var hsv = Utils.rgb2hsv(rgb[0],rgb[1],rgb[2]);
      
      this.i_value.Hue = parseInt( hsv[0] * 360 );
      this.i_value.Saturation = parseInt( hsv[1] * 100 );
      this.i_value.Brightness = parseInt( hsv[2] * 100 );
      //this.log.debug("get: (%s) h: %s s: %s v: %s", t_characteristic, this.i_value.Hue, this.i_value.Saturation, this.i_value.Brightness);
      //this.log.debug("get: %s %s %s", this.name, t_characteristic, this.i_value.Saturation);
      p_value = this.i_value.Saturation;
      break;
    
    case "SmokeDetected":
      //this.log.debug("Gateway.parsing %s %s >%s<", this.name, t_characteristic, r_value);

      p_value = (r_value == 0) ?
        Characteristic.SmokeDetected.SMOKE_NOT_DETECTED : Characteristic.SmokeDetected.SMOKE_DETECTED;
      this.i_value[t_characteristic] = p_value;
      break;
      
    case "BatteryLevel":
      p_value = parseInt(r_value);
      this.i_value[t_characteristic] = p_value;
      break;
      
    default: // todo: error handling
      p_value = r_value;
      this.log.error("Gateway.parsing %s %s not found", this.name, t_characteristic);
  }
  return p_value;
}

Gateway.prototype.set = function(t_characteristic, value, callback, context) {
  
  //this.log.debug("Gateway.set %s %s %s",this.name, t_characteristic, value);
  
  if (this.i_device.type == "") {
    this.log.debug("Gateway.set %s %s %s - type undefined", this.name, t_characteristic, value);
    callback();
    return;
  }
  
  if (typeof(context) !== "undefined" && typeof(context.trigger) !== "undefined" && context.trigger.match(/fhem/g)) {
    //this.log.debug("Gateway.set %s %s %s - fhem", this.name, t_characteristic, value);
    callback();
    return;
  }
  
  if (typeof(reading[this.service_name]) === "undefined") {
    if (this.c_undef.indexOf(t_characteristic) < 0) {
      this.c_undef.push(t_characteristic);
      this.log.debug("Gateway.set %s %s %s - service undefined ", this.name, t_characteristic, value);
    }
    callback();
    return;  
  }
  if (typeof(reading[this.service_name][t_characteristic]) === "undefined") {
    if (this.c_undef.indexOf(t_characteristic) < 0) {
      this.c_undef.push(t_characteristic);
      this.log.debug("Gateway.set %s %s %s - characteristic undefined", this.name, t_characteristic, value);
    }
    callback();
    return;  
  }
  
  if (t_characteristic == "On") {value = Utils.n2b(value); }

  var setting = this.setting(t_characteristic, value);
  
  if (setting.inst_callback) callback();
  if (setting.ret_flag) return;
    
  var gateway_url = base_url + '/fhem?cmd=' + setting.cmd + '&XHR=1';    
  //this.log.debug(gateway_url);
      
  if (timeoutObj) {
    clearTimeout(timeoutObj);
  }
    
  timeoutObj = setTimeout(function() { 
    this.request({url: gateway_url}, function(err, response, body) {

      if (!err && response.statusCode == 200) {
        //this.log.debug("set: %s %s %s", this.name, t_characteristic, value);
        if (!setting.inst_callback) callback();
      }
      else {
        this.log.error("Gateway.set %s %s", this.name, err);
        if (response) this.log.error("statusCode: %s Message: %s", response.statusCode, response.statusMessage);
        if (!setting.inst_callback) callback(err);
      }
    }.bind(this));
  }.bind(this), setting.delay);
}

Gateway.prototype.setting = function(t_characteristic, value) {
   
  var state = "";
  var cmd = 'set ' + this.i_device.name + ' ';
  var delay = 0;
  var inst_callback = false;
  var ret_flag = false;
   
  switch (t_characteristic) {
    case "On":
      state = (value == 0 || value == false) ? 'off' : 'on';
      cmd += state;
      break;
      
    case "TargetPosition":
      // special case: Fibaro FGRM-222
      if (value == 100) value = 99; 
      //break;
      
    case "TargetHorizontalTiltAngle":
      //callback();
      inst_callback = true;
      cmd += reading[this.service_name][t_characteristic] + ' ' + value;
      delay = 1000;
      break;
      
    case "Brightness":
      //callback();
      inst_callback = true;
      cmd += reading[this.service_name][t_characteristic] + ' ' + value;
      delay = 1000;
      break;
      
    case "Hue":
      this.i_value.Hue = value;
      var rgb_value = Utils.hsv2rgb(this.i_value.Hue / 360, this.i_value.Saturation / 100, this.i_value.Brightness / 100);
      cmd += reading[this.service_name][t_characteristic] + ' ' + rgb_value;
      //this.log.debug("set: (%s) h: %s s: %s v: %s", t_characteristic, this.i_value.Hue, this.i_value.Saturation, this.i_value.Brightness);
      //this.log.debug("set: cmd= %s ", cmd);
      break;
      
    case "Saturation":
      this.i_value[t_characteristic] = value;
      inst_callback = true;
      ret_flag = true;
      //callback();
      break;
      
    default:
      this.log.error("Gateway.set %s characteristic %s not implemented", this.name, t_characteristic);
  }
  return {cmd: cmd, delay: delay, inst_callback: inst_callback, ret_flag: ret_flag};
}

Gateway.prototype.Longpoll = function(master_accessory, save_and_setValue) {

  //this.log.debug("Longpoll: %s", this.name);
  if (longpoll_running) return;
  longpoll_running = true;

  var since = "null";
  var query = "/fhem.pl?XHR=1" + 
    "&inform=type=status;filter=" + 
    this.i_device.name + ";since=" + since + 
    ";fmt=JSON&timestamp=" + Date.now();
    
  var url = encodeURI( base_url + query );
  //this.log.debug("starting longpoll: " + url );
  
  var offset = 0;
  var datastr = "";
  
  setTimeout(function() { 
    this.request.get( { url: url } ).on( 'data', function(data) {
      //this.log.debug( 'data: >'+ data + '<');
      if (!data) 
        return;

      datastr += data;

      for(;;) {
        var nIndex = datastr.indexOf("\n", offset);
        if (nIndex < 0) 
          break; // exit for-loop
        var dataset = datastr.substr(offset, nIndex-offset);
        offset = nIndex + 1;
        if (!dataset.length) continue;
        
        var dataobj = JSON.parse(dataset);
        //this.log.debug("poll: dataset %s ", dataset);
        this.poll_parsing(dataobj, save_and_setValue);
      }
      
      datastr = datastr.substr(offset);
      offset = 0;
    }.bind(this)).on( 'end', function() {
      if (this.name == master_accessory) this.log("longpoll: %s ended", this.i_device.name) ;

      longpoll_running = false;
      setTimeout(function() {this.Longpoll(master_accessory, save_and_setValue)}.bind(this), 2000);

    }.bind(this)).on( 'error', function(err) {
      if (this.name == master_accessory) this.log.error( "longpoll: %s %s", this.i_device.name, err);

      longpoll_running = false;
      setTimeout(function() {this.Longpoll(master_accessory, save_and_setValue)}.bind(this), 5000);
    }.bind(this) );
  }.bind(this),1000);
}

Gateway.prototype.poll_parsing = function (dataobj, save_and_setValue) {

  //this.log.debug("Gateway.poll_parsing %s, %s", dataobj[0], dataobj[1]);
  var expression = this.service_name + dataobj[0];
  var r_value, c;  
  
  switch (expression) {
  
    case  ("Outlet" + this.i_device.name):
    case  ("Switch" + this.i_device.name):
      c = "On";
      r_value = (dataobj[1] == 'off') ? false : true;
      if (r_value != this.i_value[c]) {
        //this.log.debug("Gateway.poll_parsing %s %s %s %s", this.i_device.name, c, r_value, this.i_value[c]);
        save_and_setValue("fhem", c, r_value);
      }
      break;
      
    case  ("ContactSensor" + this.i_device.name + '-' + reading.ContactSensor.ContactSensorState):
      c = "ContactSensorState";
      r_value = (dataobj[1] == 'closed') ? Characteristic[c].CONTACT_DETECTED : Characteristic[c].CONTACT_DETECTED;
      save_and_setValue("fhem", c, r_value);
      break;
          
    case ("MotionSensor" + this.i_device.name + '-' + reading.MotionSensor.MotionDetected):
      c = "MotionDetected";
      r_value = (dataobj[1] == "closed") ? false : true;
      //this.log.debug("Gateway.poll_parsing %s %s %s", this.i_device.name, c, r_value);
      save_and_setValue("fhem", c, r_value);
      break;
      
    case ("Lightbulb" + this.i_device.name + '-' + reading.Lightbulb.On):
      c = "On";
      r_value = (dataobj[1] == 'off') ? false : true;   
      //this.log.debug("poll: %s onoff %s", this.i_device.name, r_value);
      if (r_value != this.i_value[c]) { 
        save_and_setValue("fhem", c, r_value);
      }
      break;
      
    case ("Lightbulb" + this.i_device.name + '-' + reading.Lightbulb.Brightness):
      c = "Brightness";
      r_value = parseInt(dataobj[1].match(/\d+/));
      if (r_value != this.i_value[c]) {
        //this.log.debug("Gateway.poll_parsing %s dim %s", this.i_device.name, r_value);
        save_and_setValue("fhem", c, r_value);
      }
      break;

    case ("Lightbulb" + this.i_device.name + '-' + reading.Lightbulb.Hue):
      c = "Hue";
      r_value = dataobj[1].split(" ");
      //this.log.debug("poll: %s rgb %s", this.i_device.name, r_value);
      var rgb = dataobj[1].split(" ");      
      var hsv = Utils.rgb2hsv(rgb[0],rgb[1],rgb[2]);
            
      var h = parseInt( hsv[0] * 360 );
      //var s = parseInt( hsv[1] * 100 );
      //var v = parseInt( hsv[2] * 100 );
      
      if (h != this.i_value[c]) {
        //this.log.debug("Gateway.poll_parsing %s h %s", this.i_device.name, h);
        save_and_setValue("fhem", c, h);
      }
      
      /*
      c = "Saturation";
      if (s != this.i_value[c]) {
        //this.log.debug("Gateway.poll_parsing Saturation %s s %s", this.i_device.name, s);
        save_and_setValue("fhem", c, s);
      }
      */
      break;
      
    case ("LightSensor"  + this.i_device.name + '-' + reading.LightSensor.CurrentAmbientLightLevel):
      c = "CurrentAmbientLightLevel";
      r_value = parseFloat(dataobj[1].match(/[+-]?\d*\.?\d+/));
      //this.log.debug("Gateway.poll_parsing %s %s %s %s", this.i_device.name, c, r_value, this.i_value[c]);
      save_and_setValue("fhem", c, r_value);
      break;
    
    case ("TemperatureSensor" + this.i_device.name + '-' + reading.TemperatureSensor.CurrentTemperature):
      c = "CurrentTemperature";
      r_value = parseFloat(dataobj[1].match(/[+-]?\d*\.?\d+/));
      save_and_setValue("fhem", c, r_value);
      break;
              
    case ("WindowCovering" + this.i_device.name + '-' + reading.WindowCovering.CurrentPosition):
      c = "CurrentPosition";
      r_value = parseInt(dataobj[1]);
      if (r_value != this.i_value[c]) {
        //this.log.debug("poll: %s CurrentPosition %s", this.i_device.name, r_value);
        save_and_setValue("fhem", c, r_value);
      }
      c = "TargetPosition";      
      if (r_value != this.i_value[c]) {
        //this.log.debug("poll: %s TargetPosition %s", this.i_device.name, r_value);
        save_and_setValue("fhem", c, r_value);
      }
      break;
      
    case ("WindowCovering" + this.i_device.name + '-' + reading.WindowCovering.CurrentHorizontalTiltAngle):
      c = "CurrentHorizontalTiltAngle";
      r_value = parseInt(dataobj[1]);
      if (r_value != this.i_value[c]) {
        //this.log.debug("poll: CurrentHorizontalTiltAngle %s ", r_value);
        save_and_setValue("fhem", c, r_value);
      }
      c = "TargetHorizontalTiltAngle";
      // simplified: TargetHorizontalTiltAngle = CurrentHorizontalTiltAngle
      if (r_value != this.i_value[c]) {
        //this.log.debug("poll: TargetHorizontalTiltAngle %s", r_value);
        save_and_setValue("fhem", c, r_value);
      }
      break;
      
    case ("SmokeSensor" + this.i_device.name + '-' + reading.SmokeSensor.SmokeDetected):
      c = "SmokeDetected";
      r_value = (dataobj[1] == 0) ? 
        Characteristic.SmokeDetected.SMOKE_NOT_DETECTED : Characteristic.SmokeDetected.SMOKE_DETECTED;
      save_and_setValue("fhem", c, r_value);

      break;
      
    default:
      //this.log.debug("poll: not used %s", dataobj[0]);
  } 
}
