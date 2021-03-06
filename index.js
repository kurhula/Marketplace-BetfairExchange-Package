"use strict";

global.PACKAGE_NAME = "Betfair";

const express       = require('express'),
    bodyParser      = require('body-parser'),
    API             = require('rapi-js-package'),
    fs              = require('fs'),
    lib             = require('./lib'),
    _               = lib.callback;

const PORT          = process.env.PORT || 8080;
const app           = express();

let mfile = fs.readFileSync('./metadata.json', 'utf-8'),
    cfile = fs.readFileSync('./control.json',  'utf-8');

let metadata = JSON.parse(mfile),
    control  = JSON.parse(cfile);

app.use(bodyParser.json(({limit: '50mb'})));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.all(`/api/${PACKAGE_NAME}`, (req, res) => { res.send(metadata); });

for(let func in control) {
    let options = {
        parseUri:  true,
        isRawBody: func == 'startSession'
    };
    let {
        method, 
        args,
        url,
        parse
    } = control[func];

    app.post(`/api/${PACKAGE_NAME}/${func}`, _(function* (req, res) {
        let opts     = {};
        let authopts = {};
        let r = {
            callback     : "",
            contextWrites: {}
        };
        let response;

        req.body.args = lib.clearArgs(req.body.args);

        let api = new API(url, {
            method: 'POST',
            headers: {
                'Accept':           'application/json',
                'X-Application':    req.body.args['appKey'],
                'X-Authentication': req.body.args['sessionToken']
            }
        })

        try {
            for(let arg in args) {
                let argarr      = arg.split('|');
                opts[args[arg] + '|' + argarr[0]] = req.body.args[argarr[1]];
            }

            if(args['JSON|filter'] && !opts['$filter|JSON']) opts['$filter|JSON'] = {};

            options.method    = method;
            options.body      = opts;
            //options.debug     = true;
            options.hasSkip   = true;
            options.eo        = true;

            response              = yield api.request(options);
            r.callback            = 'success';
            r.contextWrites['to'] = (Array.isArray(response) && response.length == 0) ? {status_msg: 'API returns no results'} : response;
        } catch(e) {
            r.callback            = 'error';
            r.contextWrites['to'] = e.status_code ? e : {
                status_code: "API_ERROR",
                status_msg:  e.message ? e.message : e
            };
        }

        res.status(200).send(r);
    }))
}

app.post(`/api/${PACKAGE_NAME}/startSslSession`, require('./api/startSslSession.js'))
app.post(`/api/${PACKAGE_NAME}/listRaceDetails`, require('./api/listRaceDetails.js'))
app.post(`/api/${PACKAGE_NAME}/heartbeat`, require('./api/heartbeat'))

app.listen(PORT);
module.exports = app;