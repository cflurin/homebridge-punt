'use strict';

var Utils = require('./utils.js').Utils;
var request = require('request');

module.exports = {
  Gateway: Gateway
}

var reading = {};

reading.ContactSensor = {};
reading.ContactSensor.ContactSensorState = "state";

reading.Lightbulb = {};
reading.Lightbulb.On = "onoff";
reading.Lightbulb.Hue = "rgb";
reading.Lightbulb.Saturation = "rgb";
reading.Lightbulb.Brightness = "dim";

reading.Outlet = {};
reading.Outlet.On = "state";
reading.Outlet.OutletInUse = "default"; // no request

reading.Switch = {};
reading.Switch.On = "state";

reading.TemperatureSensor = {};
reading.TemperatureSensor.CurrentTemperature = "temperature";

reading.WindowCovering = {};
reading.WindowCovering.PositionState = "default"; // no request
reading.WindowCovering.CurrentPosition = "dim";
reading.WindowCovering.TargetPosition = "dim";
reading.WindowCovering.CurrentHorizontalTiltAngle = "positionSlat";
reading.WindowCovering.TargetHorizontalTiltAngle = "positionSlat";

function Gateway(log, p_config, Charactereistic, props) {
 
  this.log = log;
  this.p_config = p_config;
  this.Characteristic = Charactereistic;

  this.index = props.index;
  this.name = props.name;
  this.i_device = props.i_device;
  this.i_characteristic = props.i_characteristic;
  this.i_value = props.i_value;
  this.setValue = props.setValue;

  this.timeoutObj;
    
  //this.log("p_config %s", JSON.stringify(p_config));
  this.gateway_name = p_config.gateway.name;
  var url = p_config.gateway.url;
  var port = p_config.gateway.port;
  var auth = p_config.gateway.auth;

  this.base_url = 'http://' + url + ':' + port;
  if (this.index == 0) this.log("Gateway is running, address %s", this.base_url);
  
  if (auth) {
    if (auth.sendImmediately == undefined) {
      auth.sendImmediately = false;
    }
    this.request = request.defaults({ "auth": auth, "rejectUnauthorized": false });
  }
  else {
    this.request = request.defaults();
  }
  
  this.longpoll_running = false;
  
  //this.type = "";
  this.eventMap = {};
  this.eventMap.on = "on";
  this.eventMap.off = "off";
  
  this.get_type(function(err, type) {
    // nothing
  });
}

Gateway.prototype.get_type = function(callback) {

  var cmd = '{InternalVal("' + this.name + '","TYPE","")}';
  var gateway_url = this.base_url + '/fhem?cmd=' + cmd + '&XHR=1';
  //this.log("Gateway.get gateway_url %s", gateway_url);
  
  this.request.get({url: gateway_url}, function(err, response, body) {
    
    if (!err && response.statusCode == 200) {
      var r_value = body.trim();
      this.i_device.type = r_value;
      //this.log("Gateway.type: %s %s", this.name, this.i_device.type);
      if (this.i_device.type == "EnOcean") this.get_eventMap();
      callback(null,this.i_device.type);
    } 
    else {
      this.log.error(err);
      if (response) this.log.error("statusCode: %s Message: %s", response.statusCode, response.statusMessage);
      callback(err);
    }
  }.bind(this));
}

Gateway.prototype.get_eventMap = function() {

  var cmd = '{AttrVal("' + this.name + '","eventMap","")}';
  var gateway_url = this.base_url + '/fhem?cmd=' + cmd + '&XHR=1';
  //this.log("get: gateway_url %s", gateway_url);
  
  this.request.get({url: gateway_url}, function(err, response, body) {
    
    if (!err && response.statusCode == 200) {
      var r_value = body.trim();
      //this.log("get_eventMap: %s %s", this.name, r_value);
      
      if (r_value) {
        var sets = r_value.split(' ');
        for (var p = 0; p < sets.length; p++) {
          var set = sets[p].split(':');
          if (set[1] == 'on' || set[1] == 'off') {
            this.eventMap[set[1]] = set[0];
          }
        }
        //this.log("get_eventMap: %s %s %s", this.name, this.eventMap.on, this.eventMap.off);
      }
    } 
    else {
      this.log.error(err);
      if (response) this.log.error("statusCode: %s Message: %s", response.statusCode, response.statusMessage);
    }
  }.bind(this));
}

Gateway.prototype.first_get = function(index, t_characteristic, callback) {

  this.get(t_characteristic, function(err, value) {
    callback(null, index, t_characteristic, value);
  });
}

Gateway.prototype.get = function(t_characteristic, callback, context) {

  //this.log("Gateway.get %s %s %s", t_characteristic, this.name, this.i_device.type);
 
  if (context) {
    if (context.characteristic) t_characteristic = context.characteristic;
    //this.log("Gateway.get %s %s %s", this.name, this.i_device.type, JSON.stringify(context));
  }

  if (!this.i_device.type) {
    callback(null, this.i_value[t_characteristic]);
    return;
  }
  //this.log("Gateway.get.step2 %s", t_characteristic);

  if (reading[this.i_characteristic.service][t_characteristic] == "default") {
    callback(null, this.i_value[t_characteristic]);
    return;
  }
  
  if (this.i_value[t_characteristic] && this.p_config.gateway.longpoll) {
    callback(null, this.i_value[t_characteristic]);
  }
  else {
    //this.log("Gateway.get reading %s %s", t_characteristic, reading[this.i_characteristic.service][t_characteristic]);
    var cmd = '{ReadingsVal("' + this.name + '","' + reading[this.i_characteristic.service][t_characteristic] + '","")}';
    var gateway_url = this.base_url + '/fhem?cmd=' + cmd + '&XHR=1';
    //this.log("get: gateway_url %s", gateway_url);
    
    this.request.get({url: gateway_url}, function(err, response, body) {
      
      if (!err && response.statusCode == 200) {
        var r_value = body.trim();
        var p_value = this.parsing(t_characteristic, r_value);
        callback(null, p_value);
      } 
      else {
        callback(err);
        this.log.error(err);
        if(response) this.log.error("statusCode: %s Message: %s", response.statusCode, response.statusMessage);
      }
    }.bind(this));
  }
}

Gateway.prototype.set = function(t_characteristic, value, callback, context) {
  
  //this.log("%s set %s %s", this.gateway_name, this.name, value);
  if (!this.i_device.type || (context && (context.trigger == "init" || context.trigger == "fhem"))) {
    callback();
    return;
  }
  
  /* todo test with simulator
  if (value == this.i_value[t_characteristic]) {
    callback();
    return;
  }
  */
  
  /* todo remove
  if (t_characteristic == "On") {
    value = (value == 0 || value == false) ? false : true;
  }
  */
  if (t_characteristic == "On") {value = Utils.n2b(value); }
  
  var setting = this.setting(t_characteristic, value);
  
  if (setting.inst_callback) callback();
  if (setting.ret_flag) return;
    
  var gateway_url = this.base_url + '/fhem?cmd=' + setting.cmd + '&XHR=1';    
  //this.log(gateway_url);
      
  if(this.timeoutObj) {
    clearTimeout(this.timeoutObj);
  }
    
  this.timeoutObj = setTimeout(function() { 
    this.request({url: gateway_url}, function(err, response, body) {

      if (!err && response.statusCode == 200) {
        //this.log("set: %s %s %s", this.name, t_characteristic, value);
        this.i_value[t_characteristic] = value;
        if (!setting.inst_callback) callback();
      }
      else {
        if (!setting.inst_callback) callback(err);
        this.log.error(err);
        if(response) this.log.error("statusCode: %s Message: %s", response.statusCode, response.statusMessage);
      }
    }.bind(this));
  }.bind(this), setting.delay);
}

Gateway.prototype.Longpoll = function(index) {

  //this.log("Longpoll: %s", this.name);
  if (this.longpoll_running) return;
  this.longpoll_running = true;

  var since = "null";
  var query = "/fhem.pl?XHR=1" + 
    "&inform=type=status;filter=" + 
    this.name + ";since=" + since + 
    ";fmt=JSON&timestamp=" + Date.now();
    
  var url = encodeURI( this.base_url + query );
  //this.log("starting longpoll: " + url );
  
  var offset = 0;
  var datastr = "";
  
  setTimeout(function() { 
    this.request.get( { url: url } ).on( 'data', function(data) {
      //this.log( 'data: >'+ data + '<');
      if( !data ) 
        return;

      datastr += data;

      for(;;) {
        var nIndex = datastr.indexOf("\n", offset);
        if(nIndex < 0) 
          break; // exit for-loop
        var dataset = datastr.substr(offset, nIndex-offset);
        offset = nIndex + 1;
        if(!dataset.length) continue;
        
        var dataobj = JSON.parse(dataset);
        //this.log("poll: dataset %s ", dataset);
        this.poll_parsing(dataobj);
      }
      
      datastr = datastr.substr(offset);
      offset = 0;
    }.bind(this)).on( 'end', function() {
      if (index == 0) this.log("longpoll: %s ended", this.name) ;

      this.longpoll_running = false;
      setTimeout(function(){this.Longpoll(index)}.bind(this), 2000);

    }.bind(this)).on( 'error', function(err) {
      if (index == 0) this.log.error( "longpoll: %s %s", this.name, err);

      this.longpoll_running = false;
      setTimeout(function(){this.Longpoll(index)}.bind(this), 5000);
    }.bind(this) );
  }.bind(this),1000);
}

/*
* Data Handling
*/

Gateway.prototype.setting = function(t_characteristic, value) {
   
  var state = "";
  var cmd = 'set ' + this.name + ' ';
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
      if(value == 100) value = 99; 
      //break;
      
    case "TargetHorizontalTiltAngle":
      //callback();
      inst_callback = true;
      cmd += reading[this.i_characteristic.service][t_characteristic] + ' ' + value;
      delay = 1000;
      break;
      
    case "Brightness":
      //callback();
      inst_callback = true;
      cmd += reading[this.i_characteristic.service][t_characteristic] + ' ' + value;
      delay = 1000;
      break;
      
    case "Hue":
      this.i_value.Hue = value;
      var rgb_value = Utils.hsv2rgb(this.i_value.Hue / 360, this.i_value.Saturation / 100, this.i_value.Brightness / 100);
      cmd += reading[this.i_characteristic.service][t_characteristic] + ' ' + rgb_value;
      //this.log("set: (%s) h: %s s: %s v: %s", t_characteristic, this.i_value.Hue, this.i_value.Saturation, this.i_value.Brightness);
      //this.log("set: cmd= %s ", cmd);
      break;
      
    case "Saturation":
      this.i_value[t_characteristic] = value;
      inst_callback = true;
      ret_flag = true;
      //callback();
      break;
      
    default:
      this.log.error("set: characteristic error %s dim %s", this.name, value);
  }
  return {cmd: cmd, delay: delay, inst_callback: inst_callback, ret_flag: ret_flag};
}

Gateway.prototype.parsing = function(t_characteristic, r_value) {
  
  var p_value;
  
  switch (t_characteristic) {
    case "On":
      //this.log("get: %s r_value %s ", this.name, r_value);
      p_value = (r_value == 0 || r_value == this.eventMap.off) ? false : true;
      this.i_value[t_characteristic] = p_value;
      break;
      
    case "OutletInUse":
      //this.log("get: %s r_value %s ", this.name, r_value);
      p_value = true;
      this.i_value[t_characteristic] = p_value;
      break;
      
    case "ContactSensorState":
      p_value = (r_value == "closed") ? this.Characteristic.ContactSensorState.CONTACT_DETECTED : this.Characteristic.ContactSensorState.CONTACT_DETECTED;
      this.i_value[t_characteristic] = p_value;
      break;

    case "CurrentPosition":
    case "TargetPosition":
    case "CurrentHorizontalTiltAngle":  
    case "TargetHorizontalTiltAngle":
    case "Brightness":
      p_value = parseInt(r_value);
      this.i_value[t_characteristic] = p_value;
      //this.log("get: (%s) %s %s", t_characteristic, this.name, r_value);
      break;
      
    case "CurrentTemperature":
      p_value = parseFloat(r_value);
      this.i_value[t_characteristic] = p_value;
      //this.log("get: (%s) %s %s",t_characteristic, this.name, r_value);
      break;
      
    case "Hue":
      var rgb = r_value.split(" ");
      var hsv = Utils.rgb2hsv(rgb[0],rgb[1],rgb[2]);
      
      this.i_value.Hue = parseInt( hsv[0] * 360 );
      this.i_value.Saturation = parseInt( hsv[1] * 100 );
      this.i_value.Brightness = parseInt( hsv[2] * 100 );
      //this.log("get: (%s) h: %s s: %s v: %s", t_characteristic, this.i_value.Hue, this.i_value.Saturation, this.i_value.Brightness);
      //this.log("get: %s %s %s", this.name, t_characteristic, this.i_value.Hue);
      p_value = this.i_value.Hue;
      break;
      
    case "PositionState":
      //this.log("get: %s r_value %s ", this.name, r_value);
      p_value = this.Characteristic.PositionState.STOPPED;
      this.i_value[t_characteristic] = p_value;
      break;
      
    case "Saturation":
      var rgb = r_value.split(" ");
      var hsv = Utils.rgb2hsv(rgb[0],rgb[1],rgb[2]);
      
      this.i_value.Hue = parseInt( hsv[0] * 360 );
      this.i_value.Saturation = parseInt( hsv[1] * 100 );
      this.i_value.Brightness = parseInt( hsv[2] * 100 );
      //this.log("get: (%s) h: %s s: %s v: %s", t_characteristic, this.i_value.Hue, this.i_value.Saturation, this.i_value.Brightness);
      //this.log("get: %s %s %s", this.name, t_characteristic, this.i_value.Saturation);
      p_value = this.i_value.Saturation;
      break;
      
    default: // todo: error handling
      p_value = r_value;
      this.log.error("Gateway.get: name %s, charactereistic %s not found", this.name, t_characteristic);
  }
  
  /* todo
  var context = {
    "trigger": "gateway_get",
    "timestamp":   new Date().toISOString()
  };
  this.i_characteristic[t_characteristic].setValue(r_value, null, context);
  this.log("gateway.parsing %s %s %s", this.name, t_characteristic, JSON.stringify(context));
  */
  return p_value;
}

Gateway.prototype.poll_parsing = function (dataobj) {

  //this.log('dataobj: ' + dataobj[0] + ', ' + dataobj[1]);
  var expression = this.i_characteristic.service + dataobj[0];
  var r_value, c;  
  
  switch (expression) {
  
    case  ("Outlet" + this.name):
    case  ("Switch" + this.name):
      c = "On";
      r_value = (dataobj[1] == 'off') ? false : true;
      if(r_value != this.i_value[c]) { 
        //this.log("poll: %s On %s", this.name, r_value);
        this.setValue(r_value, c, "fhem");
      }
      break;
      
    case  ("ContactSensor" + this.name + '-' + reading.ContactSensor.ContactSensorState):
      c = "ContactSensorState";
      r_value = (dataobj[1] == 'closed') ? this.Characteristic[c].CONTACT_DETECTED : this.Characteristic[c].CONTACT_DETECTED;
      this.setValue(r_value, c, "fhem");
      break;
      
    case ("Lightbulb" + this.name + '-' + reading.Lightbulb.On):
      c = "On";
      r_value = (dataobj[1] == 'off') ? false : true;   
      //this.log("poll: %s onoff %s", this.name, r_value);
      if(r_value != this.i_value[c]) { 
        this.setValue(r_value, c, "fhem");
      }
      break;
      
    case ("Lightbulb" + this.name + '-' + reading.Lightbulb.Brightness):
      c = "Brightness";
      r_value = parseInt(dataobj[1].match(/\d+/));
      if(r_value != this.i_value[c]) {
        this.i_characteristic[c].setValue(r_value);
        //this.log("poll: %s dim %s", this.name, r_value);
      }
      break;

    case ("Lightbulb" + this.name + '-' + reading.Lightbulb.Hue):
      c = "Hue";
      r_value = dataobj[1].split(" ");
      //this.log("poll: %s rgb %s", this.name, r_value);
      var rgb = dataobj[1].split(" ");      
      var hsv = Utils.rgb2hsv(rgb[0],rgb[1],rgb[2]);
      this.i_value.Hue = parseInt( hsv[0] * 360 );
      this.i_value.Saturation = parseInt( hsv[1] * 100 );
      this.i_value.Brightness = parseInt( hsv[2] * 100 );
      //this.log("poll: h %s s %s v", this.i_value.Hue, this.i_value.Saturation, this.i_value.Brightness);
      this.i_characteristic[c].setValue(this.i_value[c]);
      
      c = "Saturation";
      this.i_characteristic[c].setValue(this.i_value[c]);
      //this.i_characteristic.Brightness.setValue(this.i_value.Brightness); 
      break;
    
    case ("TemperatureSensor" + this.name + '-' + reading.TemperatureSensor.CurrentTemperature):
      c = "CurrentTemperature";
      r_value = parseFloat(dataobj[1].match(/[+-]?\d*\.?\d+/));
      this.setValue(r_value, c, "fhem");
      break;
              
    case ("WindowCovering" + this.name + '-' + reading.WindowCovering.CurrentPosition):
      c = "CurrentPosition";
      r_value = parseInt(dataobj[1]);
      if(r_value != this.i_value[c]) {
        //this.log("poll: %s CurrentPosition %s", this.name, r_value);
        this.setValue(r_value, c, "fhem");
      }
      c = "TargetPosition";      
      if(r_value != this.i_value[c]) {
        //this.log("poll: %s TargetPosition %s", this.name, r_value);
        this.setValue(r_value, c, "fhem");
      }
      break;
      
    case ("WindowCovering" + this.name + '-' + reading.WindowCovering.CurrentHorizontalTiltAngle):
      c = "CurrentHorizontalTiltAngle";
      r_value = parseInt(dataobj[1]);
      if(r_value != this.i_value[c]) {
        //this.log("poll: CurrentHorizontalTiltAngle %s ", r_value);
        this.setValue(r_value, c, "fhem");
      }
      c = "TargetHorizontalTiltAngle";
      // simplified: TargetHorizontalTiltAngle = CurrentHorizontalTiltAngle
      if(r_value != this.i_value[c]) {
        //this.log("poll: TargetHorizontalTiltAngle %s", r_value);
        this.setValue(r_value, c, "fhem");
      }
      break;
      
    default:
      //this.log("poll: not used %s", dataobj[0]);
  } 
}