![](icons/logo-transparent.png)

# mostly sunny

it's an [electron][electron]-based weather app. super work-in-progress. works on OS X for sure, probably works alright on windows?

```bash
git clone https://github.com/malantonio/mostly-sunny
cd mostly-sunny
cp config.sample.json config.json
```

add your [forecast.io api key][forecast_api] in the appropriate field in `config.json`

```bash
npm install
npm start
```

`npm run pack` will build the OS X app.

## shout-outs

* [weathericons.io][weathericons]
* [maxogden/menubar][menubar]
* [make8bitart.com][8bitart]


[electron]:     https://electron.atom.io
[forecast_api]: https://developer.forecast.io/

[weathericons]: https://erikflowers.github.io/weather-icons/
[menubar]:      https://github.com/maxogden/menubar
[8bitart]:      http://make8bitart.com
