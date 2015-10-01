var menubar = require('menubar')
var ipc = require('ipc')
var path = require('path')
var BrowserWindow = require('browser-window')
var Menu = require('menu')
var fs = require('fs')
var Forecast = require('./forecast')
var menuTemplate = require(__dirname + '/menu-opts')

var weatherClient

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
    label: 'Mostly Sunny home',
    click: function () {
      require('shell').openExternal('https://github.com/malantonio/mostly-sunny')
    }
  },
  { type: 'separator' },
  {
    label: 'Refresh',
    click: function () { queryWeatherData() }
  },
  { type: 'separator' },
  {
    label: 'Settings',
    submenu: [
      {
        label: 'Reset Forecast API Key',
        click: resetApiKey
      },
      { type: 'separator' },
      {
        label: 'Temperature Units',
        enabled: false
      },
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
        label: 'Time Style',
        enabled: false
      },
      {
        label: '11:45pm',
        type: 'radio',
        checked: !settings.twenty_four_hours,
        click: function () {
          convertTime(false)
        }
      },
      {
        label: '23:45',
        type: 'radio',
        checked: settings.twenty_four_hours,
        click: function () {
          convertTime(true)
        }
      }
    ]
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
  queryWeatherData(globalCoords)
})

ipc.on('window:open-menu', function () {
  contextMenu.popup(mb.window)
})

mb.on('ready', function () {
  var menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)

  mb.window.webContents.send('app:ready')
})

mb.app.on('before-quit', function () {
  clearInterval(lookupInterval)
})

function init () {
  mb.window.webContents.send('app:has-api-key')

  lookupInterval = setInterval(queryWeatherData, LOOKUP_INTERVAL_RATE)

  // if the app is still running when the computer goes on stand-by, we'll
  // want to automatically resume when it comes back online
  var powerMonitor = require('power-monitor')
  powerMonitor.on('suspend', function () {
    clearInterval(lookupInterval)
    lookupInterval = null
    suspendedTimestamp = Date.now()
  })

  // wait 10 seconds to reconnect to internet before querying data
  // + setting up interval
  powerMonitor.on('resume', function () {
    setTimeout(function restart() {
      var now = Date.now()
      var requeryThreshold = 1000 * 60 * 5 // 5 minute threshold
      var timeSince = now - (suspendedTimestamp || 0)
      if (timeSince > requeryThreshold) queryWeatherData()

      suspendedTimestamp = null

      lookupInterval = setInterval(queryWeatherData, LOOKUP_INTERVAL_RATE)
    }, 10000)
  })
}

function queryWeatherData (coords) {
  if (!coords) coords = globalCoords
  var weatherClient = new Forecast(settings.forecast_api_key)
  return weatherClient.get(coords[0], coords[1], function (err, data) {
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

    var timeString = buildTimeString(point.time, settings.twenty_four_hours)

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

function convertTemp (toCelsius) {
  var wasCelsius = settings.is_celsius
  if (wasCelsius === toCelsius) return

  var conversion = toCelsius ? ftoc : ctof

  latestDataset.data = latestDataset.data.map(function (set) {
    set.temperature = cleanTemp(conversion(set.temperature))
    set.unit = toCelsius ? 'Celsius' : 'Fahrenheit'
    set.unit_abbr = toCelsius ? 'C' : 'F'
    return set
  })

  mb.window.webContents.send('app:weather-data', latestDataset)

  settings.is_celsius = !settings.is_celsius
  saveSettings()
}

function updateToFahrenheit () { return convertTemp(false) }
function updateToCelsius () { return convertTemp(true) }

function convertTime (toTwentyFour) {
  var wasTwentyFour = settings.twenty_four_hours
  if (wasTwentyFour === toTwentyFour) return

  latestDataset.data = latestDataset.data.map(function (set) {
    set['time'] = buildTimeString(set['time_raw'], toTwentyFour)
    return set
  })

  mb.window.webContents.send('app:weather-data', latestDataset)

  settings.twenty_four_hours = !settings.twenty_four_hours
  saveSettings()
}

function buildTimeString (ts, twentyFourHours) {
  if (twentyFourHours === void 0) twentyFourHours = settings.twenty_four_hours

  var date = new Date(Number(ts + '000'))
  var hours = date.getHours()
  var ampm = hours < 12 ? 'am' : 'pm'

  if (!twentyFourHours) {
    var d = hours % 12
    if (d === 0) d = 12
    hours = d
  }

  var minutes = date.getMinutes()
  if (minutes < 10) minutes = '0' + minutes
  
  var timeString = hours + ':' + minutes
  if (!twentyFourHours) timeString += ampm

  return timeString
}

function resetApiKey () {
  settings.forecast_api_key = null
  saveSettings()
  mb.window.reload()
}

function saveSettings () {
  fs.writeFileSync(__dirname + '/local/settings.json', JSON.stringify(settings))
}
