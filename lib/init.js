'use strict';

var path = require('path');
var Utils = require('./utils.js').Utils;
  
module.exports = {
  PuntInit: PuntInit
}

function PuntInit() {
}

PuntInit.Label= function(log, p_config, Accessories) {

  this.log = log;
  this.p_config = p_config;
  this.gateway = p_config.gateway;
  var keys, c;
  
  //this.log("PuntInit.Label %s", JSON.stringify(Accessories[0].i_device));

  for (var i = 0; i < Accessories.length; i++ ) {
    //this.log("PuntInit.Label %s %s %s", i, Accessories[i].name, JSON.stringify(Accessories[i].i_value));
    keys = Object.keys(Accessories[i].i_value);
    for (var k = 0; k < keys.length; k++) {
      c = keys[k];
      //this.log("PuntInit.Label %s %s", i, c);
      if (this.gateway.run && Accessories[i].i_device.type) {
        //this.log.debug("PuntInit.Label %s %s >%s<", i, c, Accessories[i].i_device.type);
        Accessories[i].Gateway.first_get(i, c, function(err, i, c, r_value) {
          //this.log.debug("PuntInit.Label - Gateway.first_get %s %s", i, c );
          Accessories[i].save_and_setValue("fhem", c, r_value);
        }.bind(this));
      }
      else {
        Accessories[i].save_and_setValue("punt", c, "undef");
      }
    }
  }
} 
