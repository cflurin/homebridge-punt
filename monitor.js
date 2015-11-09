'use strict';

var Utils = require('./utils.js').Utils;
//var request = require('request');
var http = require('http');

module.exports = {
  Monitor: Monitor
}

function Monitor(log, p_config, Accessories) {
  this.log = log;
  this.p_config = p_config;
  this.Accessories = Accessories;
  this.port = p_config.monitor.port;
}
  
Monitor.prototype.startServer = function() {

  var Monitor_server = http.createServer(this.handleRequest.bind(this));

  Monitor_server.listen(this.port, function() {
    this.log("Monitor is running on port %s", this.port);
  }.bind(this));
  
  Monitor_server.on('error', function(err) {
    this.log("Monitor: Server error: " + err);
  }.bind(this));
}

Monitor.prototype.handleRequest = function(request, response) {

  //this.log("Monitor: request");
  var res;
  res = '<!DOCTYPE html><html><head><style>'
  res += 'table, th, td {border: 1px solid black; border-collapse: collapse;}';
  res += 'th, td {padding: 2px 10px 2px 10px;}';
  res += '</style></head><body>';
  res += '<p>homebridge-fhem v' + Utils.getPluginVersion() + ', latest v' + Utils.getGitHubVersion();
  res += ', longpoll ' + this.p_config.gateway.longpoll + '</p>';
  res += '<table style="width:100%; font: 15px arial, sans-serif;">';
  res += '<tr><td>nr.</td><td>name</td><td>service</td><td>values</td></tr>';
  
  for( var i = 0; i < this.Accessories.length; i++ ) {
    res += '<tr><td>' + i + '</td><td>'+ this.Accessories[i].name + '</td>';
    res += '<td>' + this.Accessories[i].i_service +'</td>';
    res += '<td>' + JSON.stringify(this.Accessories[i].i_value).replace('{', '').replace('}','') + '</td>' + '</tr>';
  }
  res += '</table>';
  response.write(res);

  response.end('</body></html>');
}
