'use strict'

const https = require('https')
const BASE_URL = 'https://api.forecast.io/forecast'

module.exports = Forecast

function Forecast (key) {
  this.key = key
}

Forecast.prototype.get = function getWeather (latitude, longitude, time, callback) {
  if (typeof time === 'function') {
    callback = time
    time = null
  }

  let params = [latitude, longitude]
  if (time) params.push(time)

  let url = BASE_URL + '/' + this.key + '/' + params.join(',')

  https.get(url, function (res) {
    let body = ''

    res.setEncoding('utf-8')
    res.on('data', function (data) { body += data })
    res.on('end', function () { 
      let parsed = JSON.parse(body)
      if (parsed.error) {
        var err = new Error(parsed.error) 
        err.code = parsed.code
        return callback(err, null)
      } else {
        return callback(null, parsed)
      }
    })
  })
}
