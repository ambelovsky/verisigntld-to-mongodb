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
var connString = 'mongodb://localhost/zone';

/*** NO ADDITIONAL CONFIGURATION BELOW THIS LINE ***/

// includes
var fs = require('fs');
var ProgressBar = require('progress');

var lines = [];

/**
* Fast dedupe
**/
var dedupe = function() {
  var lineSet = {};
  for(var line in lines) lineSet[lines[line]] = 1; lines = [];
  for(var line in lineSet) lines.push(line); lineSet = {};
}

/**
* Processes lines read from the zonefile
**/
var processLines = function(last) {
    last = !last ? 1 : 0;

    // dedupe
    var startingLen = lines.length;
    linesProcessed += startingLen;
    dedupe();
    dupesDetected += startingLen - lines.length;
};

// file stats for progress indicator
var fileSizeInBytes = 0;
var dupesDetected = 0;
var linesProcessed = 0;

var files = fs.readdirSync("./" + dataDir);
for(var file in files) {
    if(files[file][0] == '.') continue; // ignore hidden files

    var stats = fs.statSync("./" + dataDir + "/" + files[file]);
    fileSizeInBytes += stats["size"];
}

// progress bar
var green = '\u001b[42m \u001b[0m';
var bar = new ProgressBar('  running |:bar| :percent :ethh :etmm (:dupes/:lines dedupes)', {
    complete: green,
    incomplete: ' ',
    width: 40,
    total: fileSizeInBytes
});

// synchronous file processing
for(var file in files) {
    if(files[file][0] == '.') continue; // ignore hidden files
  
    var fileName = "./" + dataDir + "/" + files[file];
    var data = fs.readFileSync(fileName);

    // update progress indicator
    var etm = ((bar.curr / bar.total * 100) == 100) ? 0 : (new Date - bar.start) * (bar.total / bar.curr - 1);
    etm = etm > 0 ? (etm / 1000 / 60) : 0;
    eth = etm / 60;
    etm = etm % 60;

    bar.tick(data.length, {
        'etm': parseInt(etm, 10),
        'eth': parseInt(eth, 10),
        'dupes': dupesDetected,
        'lines': linesProcessed
    });
  
    lines = data.toString().split("\n");
    data = "";
  
    // remove any blank lines from the end of the file
    while(lines[lines.length-1] == '') lines.pop();
    
    processLines(true);
  
    for(var line in lines) data += (lines[line] + "\n"); lines = [];
    fs.writeFileSync(fileName, data, { flag: 'w' });
}
