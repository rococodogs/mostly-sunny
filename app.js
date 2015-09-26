var menubar = require('menubar')
var ipc = require('ipc')
var path = require('path')
var BrowserWindow = require('browser-window')
var Menu = require('menu')
var config = require('./config.json')
var forecastApiKey = config.forecast.api_key
var debug = require('debug')('mostly-sunny')

var Forecast = require('./forecast')
var weather = new Forecast(forecastApiKey)

var DEFAULT_NUMBER_OF_RESULTS = 7
var LOOKUP_INTERVAL_RATE = 1000 * 60 * 15 // 15 minutes

var suspendedTimestamp = null
var globalCoords
var lookupInterval
var settingsWindow

var mb = menubar({
  icon: path.join(__dirname, 'icons', 'icon@1x.png'),
  height: 175,
  width: 550,
  preloadWindow: true
})

var contextMenu = Menu.buildFromTemplate([
  {
    label: 'Refresh',
    click: function () { queryWeatherData() }
  },
  {
    type: 'separator'  
  },
  {
    label: 'Quit',
    click: function () { mb.app.quit() }
  }
])

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

ipc.on('window:open-menu', function () {
  contextMenu.popup(mb.window)
})

mb.on('ready', function () {
  lookupInterval = setInterval(queryWeatherData, LOOKUP_INTERVAL_RATE)

  // if the app is still running when the computer goes on stand-by, we'll
  // want to automatically resume when it comes back online
  var powerMonitor = require('power-monitor')
  powerMonitor.on('suspend', function () {
    clearInterval(lookupInterval)
    lookupInterval = null
    suspendedTimestamp = Date.now()
  })

  powerMonitor.on('resume', function () {
    var now = Date.now()
    var requeryThreshold = 1000 * 60 * 5 // 5 minute threshold
    var timeSince = now - (suspendedTimestamp || 0)

    debug('resuming after %d minutes', timeSince / 60000)
    if (timeSince > requeryThreshold) queryWeatherData()

    suspendedTimestamp = null

    lookupInterval = setInterval(queryWeatherData, LOOKUP_INTERVAL_RATE)
  })
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