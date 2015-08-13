'use strict';

(function() {

  var utils = {};

  utils.RATIOS = {
    // DISTANCE
    NM_IN_KM: 1.852000000000000000000000000000000000000000000000000000000000000000000000000,
    KM_IN_NM: 0.539956803000000000000000000000000000000000000000000000000000000000000000000000000,
    // SPEED
    // Knots
    KNOTS_IN_MS: 0.514444000000000000000000000000000000000000000000000000000000000000000000000000,
    KNOTS_IN_MPH: 1.150779000000000000000000000000000000000000000000000000000000000000000000000000,
    KNOTS_IN_KPH: 1.852000000000000000000000000000000000000000000000000000000000000000000000000,
    // MPH
    MPH_IN_MS: 0.44704000000000000000000000000000000000000000000000000000000000000000000000000,
    MPH_IN_KPH: 1.609344000000000000000000000000000000000000000000000000000000000000000000000000,
    MPH_IN_KNOTS: 0.868976000000000000000000000000000000000000000000000000000000000000000000000000,
    // KPH
    KPH_IN_MS: 0.277778000000000000000000000000000000000000000000000000000000000000000000000000,
    KPH_IN_MPH: 0.621371000000000000000000000000000000000000000000000000000000000000000000000000,
    KPH_IN_KNOTS: 0.539957000000000000000000000000000000000000000000000000000000000000000000000000,
    // MS
    MS_IN_KPH: 3.6000000000000000000000000000000000000000000000000000000000000000000000000,
    MS_IN_MPH: 2.236936000000000000000000000000000000000000000000000000000000000000000000000000,
    MS_IN_KNOTS: 1.943844000000000000000000000000000000000000000000000000000000000000000000000000,
  };

  exports.source = function(sentence) {
    return {
      type: 'NMEA0183',
      label: 'signalk-parser-nmea0183',
      sentence: sentence || ''
    };
  };

  exports.transform = function(value, inputFormat, outputFormat) {
    value = exports.float(value);

    inputFormat  = inputFormat.toLowerCase();
    outputFormat = outputFormat.toLowerCase();

    if(inputFormat === outputFormat) {
      return value;
    }

    // KM
    if(inputFormat == 'km') {
      if(outputFormat == 'nm') return value / utils.RATIOS.NM_IN_KM;
    }

    // NM
    if(inputFormat == 'nm') {
      if(outputFormat == 'km') return value / utils.RATIOS.KM_IN_NM;
    }
    
    // KNOTS
    if(inputFormat == 'knots') {
      if(outputFormat == 'kph') return value / utils.RATIOS.KPH_IN_KNOTS;
      if(outputFormat == 'ms') return value / utils.RATIOS.MS_IN_KNOTS;
      if(outputFormat == 'mph') return value / utils.RATIOS.MPH_IN_KNOTS;
    }

    // KPH
    if(inputFormat == 'kph') {
      if(outputFormat == 'knots') return value / utils.RATIOS.KNOTS_IN_KPH;
      if(outputFormat == 'ms') return value / utils.RATIOS.MS_IN_KPH;
      if(outputFormat == 'mph') return value / utils.RATIOS.MPH_IN_KPH;
    }

    // MPH
    if(inputFormat == 'mph') {
      if(outputFormat == 'knots') return value / utils.RATIOS.KNOTS_IN_MPH;
      if(outputFormat == 'ms') return value / utils.RATIOS.MS_IN_MPH;
      if(outputFormat == 'kph') return value / utils.RATIOS.KPH_IN_MPH;
    }

    // MS
    if(inputFormat == 'ms') {
      if(outputFormat == 'knots') return value / utils.RATIOS.KNOTS_IN_MS;
      if(outputFormat == 'mph') return value / utils.RATIOS.MPH_IN_MS;
      if(outputFormat == 'kph') return value / utils.RATIOS.KPH_IN_MS;
    }

    // Just return input if input/output formats are not recognised.
    return value;
  };

  exports.magneticVariaton = function(degrees, pole) {
    pole = pole.toUpperCase();
    degrees = this.float(degrees);

    if(pole == "S" || pole == "W") {
      degrees *= -1;
    }

    return degrees;
  };

  exports.timestamp = function(time, date) {
    /* TIME (UTC) */
    var hours, minutes, seconds, year, month, day;

    if(time) {
      hours = this.int(time.slice(0, 2), true);
      minutes = this.int(time.slice(2, 4), true);
      seconds = this.int(time.slice(-2), true);
    } else {
      var dt = new Date();
      hours = dt.getUTCHours();
      minutes = dt.getUTCMinutes();
      seconds = dt.getUTCSeconds();
    }

    /* DATE (UTC) */
    if(date) {
      var year, month, day;
      day = this.int(date.slice(0, 2), true);
      month = this.int(date.slice(2, 4), true);
      year = this.int(date.slice(-2));

      // HACK copied from jamesp/node-nmea
      if(year < 73) {
        year = this.int("20" + year);
      } else { 
        year = this.int("19" + year);
      }
    } else {
      var dt = new Date();
      year = dt.getUTCFullYear();
      month = dt.getUTCMonth();
      day = dt.getUTCDate();
    }

    /* construct */
    var d = new Date(Date.UTC(year, (month - 1), day, hours, minutes, seconds));
    return d.toISOString();
  };

  exports.coordinate = function(value, pole) {
    // N 5222.3277 should be read as 52°22.3277'
    // E 454.5824 should be read as 4°54.5824'
    //
    // 1. split at .
    // 2. last two characters of split[0] (.slice(-2)) + everything after . (split[1]) are the minutes
    // 3. degrees: split[0][a]
    // 4. minutes: split[0][b] + '.' + split[1]
    //
    // 52°22'19.662'' N -> 52.372128333
    // 4°54'34.944'' E -> 4.909706667
    // S & W should be negative. 

    pole = pole.toUpperCase();

    var split   = value.split('.');
    var degrees = this.float(split[0].slice(0, -2));
    var minsec  = this.float(split[0].slice(-2) + '.' + split[1]);
    var decimal = this.float(degrees + (minsec / 60));

    if (pole == "S" || pole == "W") {
      decimal *= -1;
    }
    
    return exports.float(decimal);
  };

  exports.zero = function(n) {
    if(this.float(n) < 10) {
      return "0" + n;
    } else {
      return "" + n;
    }
  };

  exports.int = function(n) {
    if(("" + n).trim() === '') {
      return 0;
    } else {
      return parseInt(n, 10);
    }
  };

  exports.integer = function(n) {
    return exports.int(n);
  };

  exports.float = function(n) {
    if(("" + n).trim() === '') {
      return 0.0;
    } else {
      return parseFloat(n);
    }
  };

  exports.double = function(n) {
    return exports.float(n);
  };

})();