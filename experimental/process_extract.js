'strict mode';

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
var dataDir = "data";
var smallFile = "com.zone";

// buffer overflow at (full) # of lines
var full = 5000;

// lines beginning with these characters are parts of the zone file we don't want
var evilChars = [' ', "\t", 'COM. ', '@', '$', ';', '-'];
var evilAnywhere = ['.', '@', ' ', '+', '=', '/', ':'];

/*** NO ADDITIONAL CONFIGURATION BELOW THIS LINE ***/

// includes
var fs = require('fs');
var ProgressBar = require('progress');

// app vars
var lines = [];
var sortedLines = {};

/**
* Sorts properly formed lines into alphabatized keys
* @param line String
**/
var sortLine = function(line) {
  if(!line) return;
  
  if(!sortedLines.hasOwnProperty(line[0]))
      sortedLines[line[0]] = [];
  sortedLines[line[0]].push(line + "\n");
}

/**
* Commits alphabatized lines to the filesystem
**/
var commitLines = function() {
    for(var key in sortedLines) {
        var filePath = "./" + dataDir + "/" + key + "." + smallFile;
      
        var data = "";
        while(sortedLines[key].length > 0) data += sortedLines[key].shift();
      
        fs.writeFile(filePath, data, { flag: 'a' }, function(err) {
          if(err) console.error(err);
        });
    }
    
    sortedLines = {};
}

/**
* Checks that a line is properly formatted
* @param line String
**/
var checkLine = function(line) {
    if(line.length < 1) return false;
    
    for(var char in evilChars)
      if(line.indexOf(evilChars[char]) === 0) return false;
  
    var firstPart = line.split(' ')[0];
    for(var char in evilAnywhere)
      if(firstPart.indexOf(evilAnywhere[char]) > -1) return false;
    
    return true;
};

/**
* Parses domain information out of NS lines
* @param line String
* @return line String
**/
var parseLine = function(line) {
    line = line.split(' NS ')[0];
    return line.split(' ')[0].toLowerCase();
};

// File stats for progress indicator
var stats = fs.statSync(file);
var fileSizeInBytes = stats["size"];
var linesProcessed = 0;

// progress bar
var green = '\u001b[42m \u001b[0m';
var bar = new ProgressBar('  running |:bar| :percent :ethh :etmm (:lines lines processed)', {
    complete: green,
    incomplete: ' ',
    width: 40,
    total: fileSizeInBytes
});

/**
* Processes lines read from the zonefile
**/
var processLines = function(last) {
    last = !last ? 1 : 0;
  
    // parse all lines
    var cleanLines = [];
    while(lines.length > last) {
      var line = lines.shift();
      
      if(!checkLine(line)) continue;
      
      var parsed = parseLine(line);
      
      // proximity dedupe
      if(cleanLines.length > 0 && parsed == cleanLines[0]) continue;
      
      cleanLines.unshift(parsed);
    }
    while(cleanLines.length > 0) lines.unshift(cleanLines.shift());
    delete cleanLines;

    // dedupe
    linesProcessed += lines.length;
  
    // shift lines off the array as we enter them into the database
    while(lines.length > last) sortLine(lines.shift());
    commitLines();
};

// Asynchronous file processing
var fileIn = fs.createReadStream(file);
fileIn.on('readable', function() {
    var chunk = null;
    while(null !== (chunk = fileIn.read())) {
        var data = chunk.toString();
        var currLine = lines.length == 0 ? 0 : lines.length - 1;
        
        // detect newline characters and split array elements
        if(data.indexOf("\n") !== -1) {
          data = data.split("\n");
        
          for(var line in data) {
            var ishift = currLine + parseInt(line);
        
            if(lines.length == ishift) lines[ishift] = "";
            lines[ishift] += data[line];
          }
        } else lines[currLine] += data;
        
        // update progress indicator
        var etm = ((bar.curr / bar.total * 100) == 100) ? 0 : (new Date - bar.start) * (bar.total / bar.curr - 1);
        etm = etm > 0 ? (etm / 1000 / 60) : 0;
        eth = etm / 60;
        etm = etm % 60;

        bar.tick(chunk.length, {
          'etm': parseInt(etm, 10),
          'eth': parseInt(eth, 10),
          'lines': linesProcessed
        });
        
        // process lines
        processLines();
    }
    
    // take care of the last line when we know it's done forming
    processLines(true);
});
