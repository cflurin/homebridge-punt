'use strict';

var path = require('path');
var Utils = require('./utils.js').Utils;
  
module.exports = {
  PuntInit: PuntInit
}

function PuntInit() {
}

PuntInit.initContext = function(log, p_config, Accessories) {

  this.log = log;
  this.p_config = p_config;
  this.gateway = p_config.gateway;
  var keys, c;
  
  //this.log("PuntInit.initContext %s", Accessories.length);
  
  if (this.gateway.run) {
    //this.log("PuntInit.initContext %s", JSON.stringify(Accessories[0].i_device));

    for (var i = 0; i < Accessories.length; i++ ) {
      keys = Object.keys(Accessories[i].i_value);
      for (var k = 0; k < keys.length; k++) {
        c = keys[k];
        this.log("PuntInit.initContext %s %s", i, c);
        if (Accessories[i].i_device.type) {
          Accessories[i].Gateway.first_get(i, c, function(err, i, c, r_value) {
            //this.log("PuntInit.initContext %s %s", i, c);
            Accessories[i].save_and_setValue(r_value, c, "fhem init");
          }.bind(this));
        }
        else {
          Accessories[i].save_and_setValue(Accessories[i].i_value[c], c, "default init");
        }
      }
    }
  }
} 
