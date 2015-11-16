# homebridge-punt
Homebridge Plugin for Fhem.

If you are new to Homebridge, please first read the Homebridge [documentation](https://www.npmjs.com/package/homebridge).

### Installation

Install homebridge:
```sh
npm install -g homebridge
```
Install homebridge-punt:
```sh
npm install -g homebridge-punt
```

You may have to use `sudo` depending on your system.

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
    "run": true,
    "longpoll": true
  },
    
  "simulator": {
    "run": true,
    "port": "4080"
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

### Simulator

Homebridge-punt has a integrated simulator. To run homebridge-punt in simulator mode without connection to the Fhem-Server, set "gateway": {"run": false}. However the simulator can run simultaneously with the gateway.

**Note:** The actual version supports only the service `Switch`, more services coming soon.

```sh
http://127.0.0.1:4080
```

### Monitor

The Monitor shows the homebridge-punt Version and the Accessory Values, in your browser type:

```sh
http://127.0.0.1:8081
```
Change the port number in config-punt.json if neccessary.

### Supported Services

The latest version (work in progress) supports:

* Outlet
* Switch
* ContactSensor
* TemperatureSensor
* WindowCovering (please see the comment in accessory.js)
* Lightbulb (please see the comment in accessory.js)
