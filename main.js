"use strict";

var utils = require(__dirname + '/lib/utils');
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

