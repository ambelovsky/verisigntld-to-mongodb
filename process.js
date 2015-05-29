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

var fs = require('fs');
var ProgressBar = require('progress');
var mongoose = require('mongoose');

// MongoDB
mongoose.connect(connString);

// Zone data model
var DomainModel = mongoose.model('domain', {
    tld: String,
    name: String
});

/**
* Stores properly formed lines in the database
* @param line String
**/
var storeLine = function(line) {
    if(!checkLine(line)) return;
    if(null !== (line = parseLine(line)))
        new DomainModel(line).save(function (err) {
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
    
    return true;
};

/**
* Parses domain information out of NS lines
* @param line String
* @return { tld, name }
**/
var parseLine = function(line) {
    line = line.split(' NS ')[0];
    
    return {
        tld: tld,
        name: line.toLowerCase()
    };
};

// File stats for progress indicator
var stats = fs.statSync(file);
var fileSizeInBytes = stats["size"];

// progress bar
var green = '\u001b[42m \u001b[0m';
var bar = new ProgressBar('  running |:bar| :percent :ethh :etmm', {
    complete: green,
    incomplete: ' ',
    width: 40,
    total: fileSizeInBytes
});

// Asynchronous file processing
var fileIn = fs.createReadStream('../com.zone');
fileIn.on('readable', function() {
    var chunk = null;
    var lines = [];
    
    while(null !== (chunk = fileIn.read())) {
        var chunkStr = chunk.toString();
        var currLine = lines.length == 0 ? 0 : linex.length - 1;
        
        // detect newline characters and split array elements thusly
        if(chunkStr.indexOf("\n") > -1) {
            var breakParts = chunkStr.split('\n');
          
            for(var i = 0; i < breakParts.length; i++) {
                var ishift = currLine + i;
          
                if(lines.length <= ishift) lines[ishift] = "";
                lines[ishift] += breakParts[i];
            }
        } else lines[currLine] += chunkStr;
        
        // shift lines off the array as we enter them into the database
        // leave the last line alone in case it is still forming
        while(lines.length > 1)
            storeLine(lines.shift());
        
        var etm = ((bar.curr / bar.total * 100) == 100) ? 0 : (new Date - bar.start) * (bar.total / bar.curr - 1);
        etm = etm > 0 ? (etm / 1000 / 60) : 0;
        eth = etm / 60;
        etm = etm % 60;

        bar.tick(chunk.length, {
            'etm': parseInt(etm, 10),
            'eth': parseInt(eth, 10)
        });
    }
    
    // take care of the last line when we know it's done forming
    while(lines.length > 0)
        storeLine(lines.shift());
});
