var menubar = require('menubar')
var ipc = require('ipc')
var path = require('path')
var BrowserWindow = require('browser-window')
var config = require('./config.json')
var forecastApiKey = config.forecast.api_key

var Forecast = require('./forecast')
var weather = new Forecast(forecastApiKey)

var DEFAULT_NUMBER_OF_RESULTS = 7

var globalCoords
var lookupInterval
var settingsWindow

var mb = menubar({
  icon: path.join(__dirname, 'icons', 'icon@1x.png'),
  height: 175,
  width: 550,
  preloadWindow: true
})

ipc.on('window:coords', function (ev, coords) {
  globalCoords = coords
  queryWeatherData()
})

ipc.on('window:open-settings', function () {
  mb.setOption('always-on-top', true)
  settingsWindow = new BrowserWindow({height: 300, width: 300})
  settingsWindow.loadUrl('file://' + __dirname + '/settings.html')
  settingsWindow.on('closed', function () {
    settingsWindow = null
    mb.showWindow()
  })
})

mb.on('ready', function () {
  lookupInterval = setInterval(queryWeatherData, 90000)
})

mb.app.on('window-all-closed', function () {
  clearInterval(lookupInterval)
  mb.app.quit()
})

function queryWeatherData () {
  return weather.get(globalCoords[0], globalCoords[1], function (err, data) {
    if (err) return [] /* i dunno, do something */

    var dataset = getDataset(config.datafield, data)
    return mb.window.webContents.send('app:weather-data', dataset)
  })
}

function getDataset (field, limit, data) {
  var validFields = ['minutely', 'hourly', 'daily']
  if (validFields.indexOf(field) === -1) return out

  if (typeof limit === 'object') {
    data = limit
    limit = DEFAULT_NUMBER_OF_RESULTS
  }

  var everything = data[field]
  var clone = {}

  for (var k in everything) {
    if (k === 'data') clone[k] = []
    else clone[k] = everything[k]
  }

  for (var i = 0; i < limit; i++) {
    clone.data.push(everything.data[i])
  }

  return clone
}