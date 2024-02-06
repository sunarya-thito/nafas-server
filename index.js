import {Server} from "./server.js";
// import express
import express from "express";
import http from "http";
import {initDatabase} from "./data.js";
import {APIResponseError, parseDtoRequest} from "./dto.js";
import {startMqtt} from "./mqtt.js";
import {port_mqtt} from "./consts.js";
import cors from "cors";
// body parser
import bodyParser from "body-parser";
import urllib from "url";
import {startCronJob} from "./cron.js";
// cors

async function startNafasServer() {
    const port = 8081;
    const server = new Server();
    server.initialize();
    server.mqttServer = startMqtt(port_mqtt, server);
    const app = express();
    // enable cors for all requests
    app.use(cors());
    // use plain text body parser
    app.use(bodyParser.text({type: '*/*'}));

    // app use public
    app.use(express.static('web'));

    const httpServer = http.createServer(app);

    await initDatabase();

    httpServer.on('upgrade', function upgrade(request, socket, head) {
        // const { pathname } = url.parse(request.url);
        const url = urllib.parse(request.url, true);
        const pathname = url.pathname;
        const params = url.query;

        if (pathname === '/device') {
            const deviceId = params['id']
            console.log(`New Client for Device ${deviceId}`);
            if (deviceId === '-1') {
                const wss = server.noDevice.websocketServer;
                wss.handleUpgrade(request, socket, head, function done(ws) {
                    wss.emit('connection', ws, request);
                });
                return;
            }
            const device = server.getDeviceById(deviceId);
            if (device === undefined) {
                socket.destroy();
                return;
            }
            const wss = device.websocketServer;
            wss.handleUpgrade(request, socket, head, function done(ws) {
                wss.emit('connection', ws, request);
            });
        } else {
            socket.destroy();
        }
    });

    // restful api
    app.post('/api', async function (req, res) {
        const body = req.body;
        let jsonBody;
        try {
            jsonBody = JSON.parse(body);
        } catch (e) {
            res.status(400);
            res.send('Bad request');
            return;
        }
        const dto = parseDtoRequest(jsonBody);
        if (dto === null) {
            res.status(400);
            res.send(JSON.stringify(new APIResponseError('Invalid request')));
            return;
        }
        let response;
        try {
            response = await server.dispatchAPIRequest(dto);
        } catch (e) {
            res.status(500);
            res.send('Internal server error');
            return;
        }
        // send response
        res.send(JSON.stringify(response));
    });

    httpServer.listen(port);

    startCronJob(server);
}

startNafasServer().then(() => {
    console.log("Nafas server started");
}).catch((e) => {
    console.error(e);
});