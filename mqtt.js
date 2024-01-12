import config from "./config.json" assert { type: "json" };
import Aedes from "aedes";
import net from "net";
import {EventDeviceDataUpdated, EventDeviceOffline, EventDeviceOnline} from "./events.js";
import {command_upload_data, sensorIds} from "./consts.js";
function generateUsername(clientId) {
    clientId = config.hash_salt + clientId;
    let hash = 0;
    for (let i = 0; i < clientId.length; i++) {
        hash = ((hash << config.hash_username_shift) - hash) + clientId.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    // returns hex string
    return hash.toString(16);
}

function generatePassword(clientId) {
    clientId = config.hash_salt + clientId;
    let hash = 0;
    for (let i = 0; i < clientId.length; i++) {
        hash = ((hash << config.hash_password_shift) - hash) + clientId.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    // returns hex string
    return hash.toString(16);
}
function startMqtt(port, server) {
    // create simple MQTT-Server
    const aedes = new Aedes();
    const mqttServer = net.createServer(aedes.handle);
    mqttServer.sendCommand = function (clientId, command) {
        aedes.publish({
            cmd: 'publish',
            qos: 0,
            dup: false,
            topic: 'nafas_' + clientId,
            payload: Buffer.from(command),
            retain: false
        }, function (err) {
            if (err) {
                console.error(err);
            }
        });
    }
    // listen to MQTT-Events
    aedes.on('client', function (client) {
        server.dispatchEvent(new EventDeviceOnline(client.id));
    });


// listen on client disconnect
    aedes.on('clientDisconnect', function (client) {
        server.dispatchEvent(new EventDeviceOffline(client.id));
    });

// subscribe to topic "nafas_data"
    aedes.subscribe('nafas_data', function (packet, cb) {
        const clientID = packet.clientId;
        const rawCommand = packet.payload.toString();

        let splitCommand = rawCommand.split(' ');

        let commandName = splitCommand[0];
        let args = splitCommand.slice(1);

        if (commandName === command_upload_data) {
            let sensorValues = {}; // sensorId -> value
            // command is: "data sensorId1:value1 sensorId2:value2 ..."
            for (let i = 0; i < args.length; i++) {
                let arg = args[i];
                let colonIndex = arg.indexOf(':');
                let sensorId = arg.substring(0, colonIndex);
                let value = arg.substring(colonIndex + 1);
                if (sensorIds.includes(sensorId)) {
                    // need to parse value to float
                    let parsedValue = parseFloat(value);
                    // must be a number (not NaN)
                    if (!isNaN(parsedValue)) {
                        sensorValues[sensorId] = parsedValue;
                    }
                }
            }
            server.dispatchEvent(new EventDeviceDataUpdated(clientID, sensorValues));
        }

        cb();
    }, function (err) {
        console.error(err);
    });


    aedes.authenticate = function (client, username, password, callback) {
        let clientId = parseInt(client.id); // e.g. '18497218308291'
        let generatedUsername = generateUsername(clientId);
        let generatedPassword = generatePassword(clientId);
        let passwordString = password.toString();
        if (username === generatedUsername && passwordString === generatedPassword) {
            console.log('Client ' + clientId + ' authenticated');
            callback(null, true);
        } else {
            console.log('Client ' + clientId + ' not authenticated');
            callback(null, false);
        }
    }

    mqttServer.listen(port);

    return mqttServer;
}

export {startMqtt}