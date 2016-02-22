'use strict';

var path = require('path');
var Utils = require('./utils.js').Utils;
  
module.exports = {
  PuntInit: PuntInit
}

function PuntInit() {
}

PuntInit.Label= function(log, p_config, accessories) {

  this.log = log;
  var gateway = p_config.gateway;
    
  //this.log.debug("PuntInit.Label %s %s", a_keys.length, JSON.stringify(a_keys));

  for (var k in accessories) {
    var name = accessories[k].name;
    //this.log.debug("PuntInit.Label %s %s %s", i, accessories[name].name, JSON.stringify(accessories[name].i_value));
    
    for (var c in accessories[name].i_value) {
      //this.log.debug("PuntInit.Label %s %s", a_key, c);
      if (gateway.run && accessories[name].i_device.type) {
        //this.log.debug("PuntInit.Label %s %s >%s<", a_key, c, accessories[name].i_device.type);
        accessories[name].Gateway.first_get(name, c, function(err, name, c, r_value) {
          //this.log.debug("PuntInit.Label - Gateway.first_get %s %s", name, c );
          accessories[name].save_and_setValue("fhem", c, r_value);
        }.bind(this));
      }
      else {
        accessories[name].save_and_setValue("punt", c, "undef");
      }
    }
  }
} 
