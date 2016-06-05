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

Smc10eu.prototype.discover = function(callback) {
    var self = this;
    self.udpsocket = dgram.createSocket('udp4');
    self.localAddresses = getLocalAddresses();
    self.udpsocket.on('listening', function () {
        var address = self.udpsocket.address();
        self.udpsocket.setBroadcast(true)
        var message = new Buffer ([cmdGetHardware, retEnd]);
        self.udpsocket.send(message, 0, message.length, port, BROADCAST_ADDRESS);
    });
      
    self.udpsocket.on('message', function (message, remote) {
        //if (_.includes(self.localAddresses, remote.address)) return;
        if (message.length >= 2
            && message[0] == retHardware
            && message[1] == SMARTER_DEVICE_TYPE) {
            self.udpsocket.close();
            callback(null, remote.address);
        }
    });

    self.udpsocket.bind(port);
}

Smc10eu.prototype.busy = function() {
    return deviceBusy;
};

Smc10eu.prototype._checkConnection = function(callback) {
    if (this.machine) return true;
    callback(this.SMC10EU_NOT_CONNECTED);
    return false;
};

Smc10eu.prototype._checkHardware = function(callback) {
    this._sendCommand(cmdGetHardware, [] ,function(result) 
    {
        //console.log("Return Hardware!");
        if ((result[0]==retHardware) && (result[1]==2))  {
            callback("OK");
        } else {
            callback("not ok");
        }
    });
};

Smc10eu.prototype.brew = function(callback) {
    this._sendCommand(cmdBrew, [0x1, 0x2, 0x0, 0x0] ,function(result) 
    {
        //console.log("Return Hardware!");
        if (result===0)  {
            callback("OK");
        } else {
            callback("not ok");
        }
    });
};


Smc10eu.prototype._connect = function(ip, port, callback) {

    var self = this;
    console.log('Connecting to machine at ' + ip + " ...");
    var client = new socket();
    client.connect(port, ip, function() {
        self.machine = client;
        console.log('Connected');
        callback(null);
    });
};

Smc10eu.prototype._disconnect = function(callback) {

    var self = this;
    console.log('Close connection to machine at ' + ip);
    if (!this._checkConnection(callback)) return;
    this.machine.end();
    if (typeof callback!='undefined') callback(null);
    return true;     
};

Smc10eu.prototype._sendCommand = function(cmd, values, callback) {
    //while (deviceBusy===true);
    deviceBusy=true;
    var self = this;
    _callback = callback;
    _self = this.machine;
    console.log('Send command "'+this.decodeCommands(cmd)+'" ...');

    //if (!this._checkConnection(callback)) return;
    var zw = cmd.toString()+values.join()+retEnd;
    command = new Buffer([cmd])+new Buffer(values)+new Buffer([retEnd]);
    this.machine.write(command, function() {
        console.log('Command gesendet');
    });
};

Smc10eu.prototype._eventHandler = function(cmd, values, callback) {
    var self = this;
    this.machine.on('data', function(data) {
        //console.log("MSG DATA");
        var msg="";
        var i;
        switch(data[0]) {
        case retErrorcode:
            console.log("Error: "+data[1]);
            if (typeof _callback!==null) {
                    _callback(data[1]);
                    deviceBusy=false;
                    return
            }
            break;
        case retHardware:
            if (typeof _callback!==null) {
                    _callback(data);
                    deviceBusy=false;
                    return
            }
            break;
        case retStatus:
            break;
        default:
            for (i=0;i<data.length;i++) {
                msg+=data[i].toString()+"="+"0x"+data[i].toString(16);
                msg+=", ";
            }
            if (typeof _callback!==null) _callback(0);
        }
    });
};


Smc10eu.prototype.decodeError = function(errorcode) {
    var msg;
    switch(errorcode) {
    case 0x00:
        msg="OK";
        break;
    case 0x01:
        msg="already brewing";
        break;
    case 0x04:
        msg="wrong parameter";
        break;
    case 0x05:
        msg="no carafe";
        break;
    case 0x06:
        msg="no Water";
        break;
    case 0x69:
        msg="Command not supportet";
        break;
    default:
        msg="Fehler 0x"+errorcode.toString(16)+" unbekannt.";
    }
    return msg;
};

Smc10eu.prototype.decodeCommands = function(cmd) {
    var msg;
    switch(cmd) {
    case cmdLoadParameters:
        msg="Load parameters";
        break;
    case cmdBrew:
        msg="Brew with supplied settings";
        break;
    case cmdBrewCurSettings:
        msg="Brew with curent settings";
        break;
    case retEnd:
        msg="End of Command";
        break;
    case cmdGetHardware:
        msg="Get hardware info";
        break;
    default:
        msg="Fehler 0x"+cmd.toString(16)+" unbekannt.";
    }
    return msg;
};

//module.exports.Smc10eu = new Smc10eu();

function getLocalAddresses() {

    var interfaces = os.networkInterfaces();
    var addresses = [];
    for (var k in interfaces) {
        for (var k2 in interfaces[k]) {
            var address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
                addresses.push(address.address);
            }
        }
    }
    return addresses;
}


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

