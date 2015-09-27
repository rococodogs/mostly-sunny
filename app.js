var menubar = require('menubar')
var ipc = require('ipc')
var path = require('path')
var BrowserWindow = require('browser-window')
var Menu = require('menu')
var config = require('./config.json')
var forecastApiKey = config.forecast.api_key

var Forecast = require('./forecast')
var weather = new Forecast(forecastApiKey)

var DEFAULT_NUMBER_OF_RESULTS = 7
var LOOKUP_INTERVAL_RATE = 1000 * 60 * 15 // 15 minutes

var suspendedTimestamp = null
var globalCoords
var latestDataset
var lookupInterval
var settingsWindow
var settings

try { settings = require(__dirname + '/local/settings.json') }
catch (e) {
  settings = require(__dirname + '/default-settings.json')
  saveSettings()
}

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

    var dataset = latestDataset = getDataset(config.datafield, data)
    return mb.window.webContents.send('app:weather-data', dataset)
  })
}

function getDataset (field, data, limit) {
  var clean = {data: []}
  var validFields = ['minutely', 'hourly', 'daily']
  if (validFields.indexOf(field) === -1) return clean

  if (limit === void 0) limit = DEFAULT_NUMBER_OF_RESULTS

  // get the specific field we're pulling from
  var everything = data[field]

  // munge-a-lunge
  for (var i = 0; i < limit; i++) {
    var point = everything.data[i]
    var updated = {}

    // js needs microseconds on the timestamp
    var timestamp = new Date(Number(point.time + '000'))
    var hours = timestamp.getHours()
    var ampm = hours < 12 ? 'am' : 'pm'

    if (!settings.twenty_four_hours) {
      var d = hours % 12
      if (d === 0) d = 12
      hours = d
    }

    var minutes = timestamp.getMinutes()
    if (minutes < 10) minutes = '0' + minutes
    
    var timeString = hours + ':' + minutes
    if (!settings.twenty_four_hours) timeString += ampm

    updated['time'] = timeString
    updated['time_raw'] = point.time

    var tempRaw = point.temperature
    if (settings.temp_unit === 'c') tempRaw = ftoc(tempRaw)

    var tempWholeNumber = Math.floor(tempRaw)
    var round = (tempRaw - tempWholeNumber) >= .5 ? Math.ceil : Math.floor
    var temp = round(tempRaw)
    
    updated['temperature'] = temp

    updated['summary'] = point.summary
    updated['icon'] = point.icon

    clean.data.push(updated)
  }

  clean['last_update'] = Date.now()
  return clean
}

// Forecast only provides Fahrenheit temps
function ftoc (temp) { return (temp - 32) / 1.8 }

function handleSetApiKey () {
  var opts = {
    type: 'question',
    title: 'Forecast.io API Key',
    message: 'Enter your Forecast.io API key'
  }

  var cb = function callback (response) {
    console.log(response)
  }

  require('dialog').showMessageBox(mb.window, opts, cb)
}

function saveSettings () {
  require('fs').writeFileSync(__dirname + '/local/settings.json', JSON.stringify(settings))
}
