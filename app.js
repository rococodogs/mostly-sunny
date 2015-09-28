var menubar = require('menubar')
var ipc = require('ipc')
var path = require('path')
var BrowserWindow = require('browser-window')
var Menu = require('menu')
var Forecast = require('./forecast')
var weather

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
  { type: 'separator' },
  {
    label: 'Fahrenheit',
    type: 'radio',
    checked: !settings.is_celsius,
    click: updateToFahrenheit
  },
  {
    label: 'Celsius',
    type: 'radio',
    click: updateToCelsius,
    checked: settings.is_celsius
  },
  { type: 'separator' },
  {
    label: 'Quit',
    click: function () { mb.app.quit() }
  }
])

ipc.on('window:check-api-key', function (ev) {
  if (!settings.forecast_api_key) {
    mb.window.webContents.send('app:needs-api-key')
  } else init()
})

ipc.on('window:api-key-submit', function (ev, key) {
  settings.forecast_api_key = key
  saveSettings()
  mb.window.reload()
})

ipc.on('window:coords', function (ev, coords) {
  globalCoords = coords
  queryWeatherData()
})

ipc.on('window:open-menu', function () {
  contextMenu.popup(mb.window)
})

mb.app.on('before-quit', function () {
  clearInterval(lookupInterval)
})

function init () {
  mb.window.webContents.send('app:has-api-key')
  weather = new Forecast(settings.forecast_api_key)

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
}

function queryWeatherData () {
  return weather.get(globalCoords[0], globalCoords[1], function (err, data) {
    if (err) return [] /* i dunno, do something */

    var dataset = latestDataset = getDataset(settings.data_field, data)
    return mb.window.webContents.send('app:weather-data', dataset)
  })
}

function getDataset (field, data, limit) {
  var clean = {data: []}
  var validFields = ['minutely', 'hourly', 'daily']
  if (validFields.indexOf(field) === -1) return clean

  if (limit === void 0) limit = DEFAULT_NUMBER_OF_RESULTS

  // only copy the top-level fields
  for (var k in data) {
    if (validFields.indexOf(k) > -1) continue
    else clean[k] = data[k]
  }

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

    var temp = point.temperature
    if (settings.is_celsius) temp = ftoc(temp)
    updated['temperature'] = cleanTemp(temp)

    updated['summary'] = point.summary
    updated['icon'] = point.icon

    updated['unit'] = settings.is_celsius ? 'Celsius' : 'Fahrenheit'
    updated['unit_abbr'] = settings.is_celsius ? 'C' : 'F'

    clean.data.push(updated)
  }

  clean['summary'] = data.currently.summary
  clean['last_update'] = Date.now()

  return clean
}

// Forecast only provides Fahrenheit temps
function ftoc (temp) { return (temp - 32) / 1.8 }
function ctof (temp) { return (temp * 1.8) + 32 }

function cleanTemp (tempRaw) {
  var tempWholeNumber = Math.floor(tempRaw)
  var round = (tempRaw - tempWholeNumber) >= .5 ? Math.ceil : Math.floor
  return round(tempRaw)
}

function convertTemp (to_celsius) {
  var wasCelsius = settings.is_celsius
  if (wasCelsius === to_celsius) return

  var data = latestDataset.data
  var conversion = to_celsius ? ftoc : ctof

  var updated = data.map(function (set) {
    set.temperature = cleanTemp(conversion(set.temperature))
    set.unit = to_celsius ? 'Celsius' : 'Fahrenheit'
    set.unit_abbr = to_celsius ? 'C' : 'F'
    return set
  })

  latestDataset.data = data
  mb.window.webContents.send('app:weather-data', latestDataset)

  settings.is_celsius = !settings.is_celsius
  saveSettings()
}

function updateToFahrenheit () { return convertTemp(false) }
function updateToCelsius () { return convertTemp(true) }

function saveSettings () {
  require('fs').writeFileSync(__dirname + '/local/settings.json', JSON.stringify(settings))
}
