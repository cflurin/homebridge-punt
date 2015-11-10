Homebridge plugin for Fhem

### Installation

Install homebridge:
```sh
npm install -g homebridge
```
Install homebridge-punt:
```sh
npm install -g homebridge-punt
```

### Configuration
Add the punt-platform in config.json in your home directory inside `.homebridge`.

```sh
{
  "bridge": {
    "name": "Homebridge",
    "username": "CC:22:3D:E3:CE:30",
    "port": 51826,
    "pin": "031-45-154"
  },
  
  "platforms": [
    {
      "platform" : "punt",
      "name" : "punt"
    }
  ],           

  "accessories": []
}
```

Add `config-punt.json` into your directory `.homebridge/plugins/homebridge-punt`.

```sh
{
  "gateway": {
    "name": "fhem",
    "url": "127.0.0.1",
    "port": "8083",
    "auth": {"user": "foo", "password": "bar"},
    "longpoll": true
  },
    
  "monitor": {
    "port": "8081",
    "run": true
  },
  
  "accessories": [
    {
      "name": "alarm_control",
      "service": "Switch"
    },
    {
      "name": "temp_control",
      "service": "Switch"
    },
    {
      "name": "flex_lamp",
      "service": "Outlet"
    },
    {
      "name": "garden_door",
      "service": "ContactSensor"
    },
    {
      "name": "local_weather",
      "service": "TemperatureSensor"
    },
    {
      "name": "led_bulb",
      "service": "Lightbulb"
    },
    {
      "name": "bathroom_blind",
      "service": "WindowCovering",
      "operationmode": "venetian"
    }
  ]
}
```

### Monitor

The Monitor shows the homebridge-punt Version and the Accessory Values, in your browser type:

```sh
http://127.0.0.1:8081
```
You can change the port number in config-punt.json.

### Supported Services

The latest version (work in progress) supports following services (accessories) for the Fhem-Platform:

* Outlet
* Switch
* ContactSensor
* TemperatureSensor
* WindowCovering (please see the comment in accessory.js)
* Lightbulb (please see the comment in accessory.js)
