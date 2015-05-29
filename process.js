/***
* Extracts domain names from verisign TLD zone files.
* By default, entries are committed to a MongoDB instance.
*
* Author: Aaron Belovsky (ambelovsky@gmail.com)
* License: MIT
***/

/*** CONFIGURATION ***/
var tld = "com";
var file = "../com.zone";
var connString = 'mongodb://localhost/zone';

// lines beginning with these characters are parts of the zone file we don't want
var evilChars = [' ', "\t", 'COM. ', '@', '$', ';'];

/*** NO ADDITIONAL CONFIGURATION BELOW THIS LINE ***/

// dedupe for arrays
var uniqueArrayFilter = function(value, index, self) {
    return self.indexOf(value) === index;
}

// includes
var fs = require('fs');
var ProgressBar = require('progress');
var mongoose = require('mongoose')
  , Schema = mongoose.Schema;

var lines = [];

// MongoDB
mongoose.connect(connString);

// Zone data model
var DomainSchema = new Schema({
    tld: String,
    name: String
}).index({ name: 1, tid: 1 }, { unique: true, dropDups: true });
var DomainModel = mongoose.model('domain', DomainSchema);

/**
* Stores properly formed lines in the database
* @param line String
**/
var storeLine = function(line) {
    new DomainModel({
        tld: tld,
        name: line.toLowerCase()
    }).save(function (err) {
        // if the error is a duplicate entry error, move on to next record
        if(err && err.code === 11000) return;
        
        // if the error is unknown, print it out to the console
        if(err) console.error(err);
    });
}

/**
* Checks that a line is properly formatted
* @param line String
**/
var checkLine = function(line) {
    if(line.length < 1) return false;
    
    for(var i = 0; i < evilChars.length; i++) {
        var char = evilChars[i];
        if(line.indexOf(char) === 0) return false;
    }
  
    dotTest = line.split(' ')[0];
    if(dotTest.indexOf('.') > -1) return false;
    
    return true;
};

/**
* Parses domain information out of NS lines
* @param line String
* @return line String
**/
var parseLine = function(line) {
    line = line.split(' NS ')[0];
    return line.split(' ')[0];
};

// File stats for progress indicator
var stats = fs.statSync(file);
var fileSizeInBytes = stats["size"];
var dupesDetected = 0;
var linesProcessed = 0;

// progress bar
var green = '\u001b[42m \u001b[0m';
var bar = new ProgressBar('  running |:bar| :percent :ethh :etmm (:dupes/:lines dedupes)', {
    complete: green,
    incomplete: ' ',
    width: 40,
    total: fileSizeInBytes
});

/**
* Processes lines read from the zonefile
**/
var processLines = function(lines, last) {
    last = !last ? 1 : 0;
    cleanLines = [];
  
    // parse all lines
    lines.forEach(function(line) {
        if(!line) return;
        if(!checkLine(line)) return;
        if(null !== (parsedLine = parseLine(line)))
            cleanLines.unshift(parsedLine);
    });
    lines = cleanLines;

    // dedupe
    var startingLen = lines.length;
    linesProcessed += startingLen;
    var unformedLine = lines.pop();
    lines = lines.filter(uniqueArrayFilter);
    lines.push(unformedLine);
    dupesDetected += startingLen - lines.length;
  
    // shift lines off the array as we enter them into the database
    // leave the last line alone in case it is still forming
    while(lines.length > last) {
        storeLine(lines.shift());
    }
  
    return lines;
};

// Asynchronous file processing
var fileIn = fs.createReadStream('../com.zone');
fileIn.on('readable', function() {
    var chunk = null;
    
    while(null !== (chunk = fileIn.read())) {
        var chunkStr = chunk.toString();
        var currLine = lines.length == 0 ? 0 : lines.length - 1;
        
        // detect newline characters and split array elements thusly
        if(chunkStr.indexOf("\n") > -1) {
            var breakParts = chunkStr.split('\n');
          
            for(var i = 0; i < breakParts.length; i++) {
                var ishift = currLine + i;
          
                if(lines.length <= ishift) lines[ishift] = "";
                lines[ishift] += breakParts[i];
            }
        } else lines[currLine] += chunkStr;
        
        // update progress indicator
        var etm = ((bar.curr / bar.total * 100) == 100) ? 0 : (new Date - bar.start) * (bar.total / bar.curr - 1);
        etm = etm > 0 ? (etm / 1000 / 60) : 0;
        eth = etm / 60;
        etm = etm % 60;

        bar.tick(chunk.length, {
            'etm': parseInt(etm, 10),
            'eth': parseInt(eth, 10),
            'dupes': dupesDetected,
            'lines': linesProcessed
        });
        
        // process lines
        lines = processLines(lines);
    }
    
    // take care of the last line when we know it's done forming
    processLines(lines, true);
});
