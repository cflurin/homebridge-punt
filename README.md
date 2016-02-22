# homebridge-punt
Homebridge-punt is a Plugin for Homebridge. The Plugin incorporates a Fhem-Gateway and a Simulator.

**New: Plugin-2. To use with homebridge Plugin-2 branch**


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
      "name": "flex_lamp",
      "service": "Outlet"
    },
    {
      "name": "garden_door",
      "service": "ContactSensor"
    },
    {
      "name": "local_weather",
      "service": "TemperatureSensor",
      "CurrentTemperature": { "minValue": -20, "maxValue": 60 }
    },
    {
      "name": "smoke_living",
      "service": "SmokeSensor",    
      "StatusLowBattery": "default"
    },
    {
      "name": "led_bulb",
      "service": "Lightbulb",
      "Brightness": "default",
      "Hue": "default",
      "Saturation": "default"
    },
    {
      "name": "bathroom_blind",
      "service": "WindowCovering",
      "CurrentPosition": { "minStep": 5 },
      "TargetPosition": { "minStep": 5 },
      "CurrentHorizontalTiltAngle": { "minValue": 0, "minStep": 5 },
      "TargetHorizontalTiltAngle": { "minValue": 0, "minStep": 5 }
    }
  ]
}
```

To add an optional Characteristic define the Characteristic with "default" for the default values.
However, the default values can be changed:

```
{ "minValue": 0, "maxValue": 100, "minStep": 10 }
```

[HomeKitTypes.js](https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js) describes all the predifined Services and Characteristcs.

To define Multifunctions Sensors like Fibaro FGMS-001 with different services add a suffix to the accessory name separated by ".":

```
{
  "accessories": [
    {
      "name": "multi_living.temp",
      "service": "TemperatureSensor"
    },
    {
      "name": "multi_living.light",
      "service": "LightSensor",
      "CurrentAmbientLightLevel": { "minValue": 0, "minStep": 1 }
    },
    {
      "name": "multi_living.motion",
      "service": "MotionSensor"
    },
    {
      "name": "multi_living.battery",
      "service": "BatteryService"
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

![Simulator](https://cloud.githubusercontent.com/assets/5056710/12063267/00550f8a-afac-11e5-9609-58e834ec277d.jpg)

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


