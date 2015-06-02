# verisigntld-to-mongodb
Asynchronous processing of Verisign's TLD zone files to extract domain names and enter them into mongodb.

Important
=========

This NodeJS version of the processing scripts are not stable. It's highly recommended that you use the Python
version of these files at [github.com/ambelovsky/py-verisigntld-to-mongodb](https://github.com/ambelovsky/py-verisigntld-to-mongodb).

Installation
============

Run "npm install" under the project directory. This will pull down all necessary dependencies from npm.

    npm install


Configuration
=============

Open process.js and set the following variables:

    var tld = "com";
    var file = "../com.zone";
    var connString = 'mongodb://localhost/zone';


Usage
=====

    node process.js
