'use strict'

var https = require('https')
var BASE_URL = 'https://api.forecast.io/forecast'

module.exports = Forecast

function Forecast (key) {
  this.key = key
}

Forecast.prototype.get = function getWeather (latitude, longitude, time, callback) {
  if (typeof time === 'function') {
    callback = time
    time = null
  }

  var params = [latitude, longitude]
  if (time) params.push(time)

  var url = BASE_URL + '/' + this.key + '/' + params.join(',')

  https.get(url, function (res) {
    var body = ''

    res.setEncoding('utf-8')
    res.on('data', function (data) { body += data })
    res.on('end', function () { 
      var parsed = JSON.parse(body)
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
