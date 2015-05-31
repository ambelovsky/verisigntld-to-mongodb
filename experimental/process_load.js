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
var connString = 'mongodb://localhost:27017/zone';

/*** NO ADDITIONAL CONFIGURATION BELOW THIS LINE ***/

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
    var model = new DomainModel({
        tld: tld,
        name: line
    }).save(function (err) {
        // if the error is a duplicate entry error, move on to next record
        if(err && err.code !== 11000) console.error(err);
    });
};

/**
* Processes lines read from the zonefile
**/
var processLines = function(last) {
    last = !last ? 1 : 0;
  
    // shift lines off the array as we enter them into the database
    while(lines.length > last) storeLine(lines.shift());
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
  
    var data = fs.readFileSync("./" + dataDir + "/" + files[file]);
  
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
  
    lines = data.toString().split('\n');
    data = null;
  
    // remove any blank lines from the end of the file
    while(lines[lines.length-1] == '') lines.pop();
    
    processLines(true);
}
