# homebridge-punt
Homebridge-punt is a Plugin for Homebridge. The Plugin incorporates a Fhem-Gateway and a Simulator.

**Note: this is a work in progress.**

### Installation

If you're new to Homebridge, please first read the Homebridge [documentation](https://www.npmjs.com/package/homebridge).
You should have a look at the [Wiki](https://github.com/cflurin/homebridge-punt/wiki/Running-Homebridge-on-a-Raspberry-Pi) if you're running on a Raspberry.

Install homebridge:
```sh
sudo npm install -g homebridge
```
Install homebridge-punt:
```sh
sudo npm install -g homebridge-punt
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
    "run": true,
    "longpoll": true
  },
  
  "puntview": {
    "run": true,
    "port": "4040"
  },
  
  "simulator": {
    "run": true,
    "port": "4080"
  },
  
  "monitor": {
    "run": true,
    "port": "8081"
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

### puntView

puntView is a WUI (web-based user interface) that displays the Accessory Services and Characteristics in real-time. 

Type the puntView-address in your browser:

```sh
http://127.0.0.1:4040
```

Change the port number in config-punt.json if neccessary.

### Simulator

![Simulator](https://cloud.githubusercontent.com/assets/5056710/11633953/4398a55a-9d0e-11e5-9487-92371447514f.jpg)
Deactivate the gateway ("run": false) to run the simulator without connecting to the Fhem-Server. However, the simulator can run simultaneously with the gateway.

Type the Simulator-address in your browser:

```sh
http://127.0.0.1:4080
```

### Monitor

The Monitor is still supported but `puntView` is recommended.

```sh
http://127.0.0.1:8081
```

### Supported Services

The latest version (work in progress) supports:

* Outlet
* Switch
* ContactSensor
* TemperatureSensor
* WindowCovering (please see the comment in accessory.js for the fhem configuration)
* Lightbulb (please see the comment in accessory.js for the fhem configuration)
