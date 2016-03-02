'use strict';

var util = require('util');
var Utils = require('./utils.js').Utils;
var http = require('http');

module.exports = {
  Monitor: Monitor
}

function Monitor(log, p_config, plugin_name, accessories) {
  this.log = log;
  this.p_config = p_config;
  this.port = p_config.monitor.port;
  this.plugin_name = plugin_name;
  this.accessories = accessories;
}

Monitor.prototype.startServer = function() {

  var Monitor_server = http.createServer(this.handleRequest.bind(this));

  Monitor_server.listen(this.port, function() {
    this.log("Monitor is running on port %s", this.port);
  }.bind(this));
  
  Monitor_server.on('error', function(err) {
    this.log("Monitor: Port %s Server %s ", this.port, err);
  }.bind(this));
}

Monitor.prototype.handleRequest = function(request, response) {

  //this.log("Monitor: request");
  var res;
  res = '<!DOCTYPE html><html><head><style>'
  res += 'table, th, td {border: 1px solid black; border-collapse: collapse;}';
  res += 'th, td {font: 14px arial, sans-serif; padding: 2px 10px 2px 10px;}';
  res += '</style></head><body>';
  
  res += '<table style="width:98%; margin-left:auto;margin-right:auto">';
  res += '<tr><td colspan="5" style="font-size: 150%; font-weight: bold;">'+this.plugin_name+' v'+Utils.getPluginVersion()+', latest v'+Utils.get_npmVersion(this.plugin_name);
  res += ', longpoll '+this.p_config.gateway.longpoll+'</td></tr>';
  res += '<tr><td>nr.</td><td>name</td><td>type</td><td>service</td><td>values</td></tr>';

  var a_keys = Object.keys(this.accessories);

  for (var i in a_keys) {
    var name = a_keys[i];
    res += '<tr><td>' + i + '</td><td>'+ this.accessories[name].name + '</td>';
    if (this.accessories[name].i_device.type) {
      res += '<td>' + this.accessories[name].i_device.type +'</td>';
    } else {
      res += '<td></td>';
    }
    res += '<td>' + this.accessories[name].service_name +'</td>';
    res += '<td>' + JSON.stringify(this.accessories[name].i_value).replace('{', '').replace('}','') + '</td>' + '</tr>';
  }
  res += '</table>';
  response.write(res);

  response.end('</body></html>');
}
