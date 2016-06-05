"use strict";

var utils = require(__dirname + '/lib/utils');

var socket = require('net').Socket;
var dgram = require('dgram'); 
var os = require('os');

var SMARTER_DEVICE_TYPE =   0x02;

var retErrorcode =          0x03; // default answer for commands
var cmdLoadParameters=      0x0C; // load parameters; answer nothing?
var retStatus =             0x32; // return code of periodical status broadcast
var cmdBrew =               0x33; // brew with settings: cupsHex + strengthHex + hotPlateHex + grindHex   
var cmdBrewCurSettings=     0x37; // Brew with current settings
var retEnd =                0x56; // this code ends a command sequence
var cmdGetHardware =        0x64;
var retHardware =           0x65; // Reserviert für Antwort auf 0x64

var BROADCAST_ADDRESS = '255.255.255.255'
var deviceBusy = false;
var _callback = null;
var _self = null;


var Smc10eu = function() {
    this.SMC10EU_NOT_CONNECTED =    'smc10eu-not-connected';
    this.SMC10EU_NOT_FOUND =        'smc10eu-not-found';
    this.SMC10EU_FOUND =            'smc10eu-ok';
    
};


var adapter = utils.adapter('smartercoffee');

adapter.on('ready', function () {
    if (adapter.config.ip) {

        var auth = {
            "ip": adapter.config.ip
        };

        //api = new netatmo(auth);
        //Hier connect

        // Update
        requestUpdate();
    } else
        adapter.log.error("Please setup IP of your smarter coffee machine!");
});

