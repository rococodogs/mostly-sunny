var ipc = require('ipc')

// elements
var header = document.querySelector('header')
var debugStatus = document.querySelector('.debug-status')
var debugLatLong = document.querySelector('.debug-latlong')
var tableBody = document.querySelector('.weather-table tbody')
var menuButton = document.querySelector('.menu-button')

debugStatus.innerText = 'Getting location'
getCoords()

menuButton.addEventListener('click', function () {
  ipc.send('window:open-menu')
})

ipc.on('app:get-coords', getCoords)

ipc.on('app:weather-data', function (set) {
  console.log('window received `weather-data`')
  if (set.data.length === 0) console.log('nothing in this bundle!')
  header.innerText = set.summary

  clearTable()
  set.data.forEach(fillTable)
})

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

  td.innerHTML += '<span class="weather-time">' + dataset.time + '</span>'
                + '<i class="weather-icon wi wi-forecast-io-' + dataset.icon + '" '
                + 'title="' + dataset.summary +'"></i>'
                + '<span class="weather-temp">' + dataset.temperature + '&deg;</span>'
  tableBody.appendChild(td)
}
