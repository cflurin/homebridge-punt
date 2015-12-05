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
  var keys, c, value, context;
  
  this.log("PuntInit.initContext %s", Accessories.length);
  
  if (this.gateway.run) {
    //this.log("PuntInit.initContext %s", JSON.stringify(Accessories[0].i_device));

    for (var i = 0; i < Accessories.length; i++ ) {
      if (Accessories[i].i_device.type) {
        keys = Object.keys(Accessories[i].i_value);
        for (var k = 0; k < keys.length; k++) {
          c = keys[k];
          if (Accessories[i].i_device.type) {
            Accessories[i].Gateway.get_init(i, c, function(err, i, c, r_value) {
              value = r_value;
              context = {
                "initiator": "init",
                //"accessory": name, // todo
                //"service": i_service, // todo
                "characteristic": c
              };
              //this.log("PuntInit.initContext %s %s", i, JSON.stringify(context));
              Accessories[i].i_characteristic[c].setValue(value, null, context);
            }.bind(this));
          }
          else {
            context = {
              "initiator": "init",
              "accessory": Accessories[i].name,
              "service": Accessories[i].i_service,
              "characteristic": c
            };
            Accessories[i].i_characteristic[c].setValue(value, null, context);
          }
        }
      }
    }
  }
} 
