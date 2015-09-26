var ipc = require('ipc')
var config = require('./get-config.js')

// elements
var header = document.querySelector('header')
var debugStatus = document.querySelector('.debug-status')
var debugLatLong = document.querySelector('.debug-latlong')
var tableBody = document.querySelector('.weather-table tbody')
var menuButton = document.querySelector('.menu-button')

menuButton.addEventListener('click', function () {
  ipc.send('window:open-menu')
})

ipc.on('app:get-coords', function () {
  console.log('window got `get-coords` message')
  getCoords()
})

ipc.on('app:weather-data', function (set) {
  console.log('window received `weather-data`')
  if (set.data.length === 0) console.log('nothing in this bundle!')
  header.innerText = set.summary

  clearTable()
  set.data.forEach(fillTable)
})

debugStatus.innerText = 'Getting location'
getCoords()

function getCoords () {
  navigator.geolocation.getCurrentPosition(function (pos) {
    debugStatus.innerText = ''
    debugLatLong.innerText = pos.coords.latitude + ',' + pos.coords.longitude
    ipc.send('window:coords', [pos.coords.latitude, pos.coords.longitude])
  })  
}

function clearTable () {
  while (tableBody.firstChild) tableBody.removeChild(tableBody.firstChild)
}

function fillTable (dataset) {
  var td = document.createElement('td')
  var time = new Date(Number(dataset.time + '000'))

  var hours = time.getHours()

  if (!config.twentyFourHours) {
    var d = hours % 12
    if (d === 0) d = 12
    hours = d
  }

  var minutes = time.getMinutes()
  if (minutes < 10) minutes = '0' + minutes
  
  var timeString = hours + ':' + minutes
  if (!config.twentyFourHours) {
    timeString += time.getHours() < 12 ? 'am' : 'pm'
  }

  var tempRaw = dataset.temperature
  var tempWholeNumber = Math.floor(tempRaw)
  var round = (tempRaw - tempWholeNumber) >= .5 ? Math.ceil : Math.floor
  var temp = round(tempRaw)

  td.innerHTML += '<span class="weather-time">' + timeString + '</span>'
                + '<i class="weather-icon wi wi-forecast-io-' + dataset.icon + '" '
                + 'title="' + dataset.summary +'"></i>'
                + '<span class="weather-temp">' + temp + '&deg;</span>'
  tableBody.appendChild(td)
}
