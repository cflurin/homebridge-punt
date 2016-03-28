'use strict';

var path = require('path');
var Utils = require('./utils.js').Utils;
var i_count = 0;
  
module.exports = {
  PuntInit: PuntInit
}

function PuntInit() {
}

PuntInit.setValues = function(log, p_config, accessories, reload_name, callback) {

  this.log = log;
  var gateway = p_config.gateway;
    
  //this.log.debug("PuntInit.Label %s", JSON.stringify(accessories));

  for (var k in accessories) {
    //this.log.debug("PuntInit.Label %s %s %s", k, accessories[k].name, JSON.stringify(accessories[k].i_value));
    
    for (var c in accessories[k].i_value) {
      i_count++;
      //this.log.debug("PuntInit.Label first_get %s", i_count);
      
      accessories[k].Gateway.first_get(k, c, function(err, uuid, c, r_value) {
        //this.log.debug("PuntInit.Label.first_get %s %s %s", accessories[uuid].name, c, i_count);
        
        if (accessories[uuid].i_device.type != "") {
          accessories[uuid].save_and_setValue("fhem", c, r_value);
          if (c == Object.keys(accessories[uuid].i_value)[0]) {
            accessories[uuid].Longpoll();
          }
        } else {
          if (accessories[uuid].name == reload_name) {
            accessories[uuid].save_and_setValue("punt", c, false);
          } else {
            accessories[uuid].save_and_setValue("punt", c, "undef");
          }
        }

        i_count--;
        if (i_count == 0) {
          callback();
        }
      }.bind(this));
      //this.log.debug("PuntInit.Label %s %s %s", accessories[k].name, c, i_count);
    }
  }
}
