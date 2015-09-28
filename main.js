var ipc = require('ipc')
var shell = require('shell')

// elements
var header = document.querySelector('header')
var debugStatus = document.querySelector('.debug-status')
var debugLatLong = document.querySelector('.debug-latlong')
var tableBody = document.querySelector('.weather-table tbody')
var menuButton = document.querySelector('.menu-button')
var apiKeyInput = document.querySelector('.api-key-input-box')
var apiKeyInputLinks = document.querySelectorAll('.api-key-text a')

Array.prototype.forEach.call(apiKeyInputLinks, function (link) {
  link.addEventListener('click', function (ev) {
    var href = ev.target.href
    ev.preventDefault()

    if (href) shell.openExternal(href)
  })
})

ipc.send('window:check-api-key')

ipc.on('app:has-api-key', function () {
  apiKeyInput.style.display = 'none'
  tableBody.innerHTML = '' // or loading?
  debugStatus.innerText = 'Getting location'
  getCoords()
})

ipc.on('app:needs-api-key', function () {})

menuButton.addEventListener('click', function () {
  ipc.send('window:open-menu')
})

ipc.on('app:get-coords', getCoords)

ipc.on('app:weather-data', function (set) {
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
                + '<span class="weather-temp">' + dataset.temperature + '&deg; '
                + dataset.unit_abbr + '</span>'
  tableBody.appendChild(td)
}

function handleApiKeySubmit () {
  var key = document.querySelector('.api-key-input').value
  if (!key) return

  ipc.send('window:api-key-submit', key)
}