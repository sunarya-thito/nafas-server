// 12321412312

import config from "./config.json" assert { type: "json" };
import mqtt from "mqtt";
import {sensor_co2, sensor_dust, sensor_gas, sensor_humidity, sensor_temperature} from "./consts.js";

const hostname = 'localhost';
const port = 1883;
const deviceId = '12321412312';

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

const username = generateUsername(deviceId);
const password = generatePassword(deviceId);

const client = mqtt.connect(
    'mqtt://' + hostname + ':' + port ,
    {
        username: username,
        password: password,
        clientId: deviceId,
    }
);

client.on('error', function (error) {
    console.error(error);
});

client.on('connect', function () {
    console.log('connected');
    client.subscribe('nafas', function (err) {
        if (err) {
            console.error(err);
        }
    });
    client.on('message', function (topic, message) {
        console.log(topic, message.toString());
    });
});

let sensorValues = {};
let sensors = [
    sensor_temperature,
    sensor_gas,
    sensor_co2,
    sensor_dust,
    sensor_humidity,
];
let min = 25;
let max = 35;

generateRandomSensorValues();
setInterval(sendRandomData, 1000);



function generateRandomSensorValues() {
    for (let i = 0; i < sensors.length; i++) {
        sensorValues[sensors[i]] = (Math.random() * (max - min) + min).toFixed(2);
    }
    sensorValues[sensor_humidity] = 90;
}

function generateNextSensorValues() {
    // to prevent sudden changes
    // to prevent sudden changes
    let minDelta = -1.5;
    let maxDelta = 1.5;
    let delta = (Math.random() * (maxDelta - minDelta) + minDelta).toFixed(2);
    for (let i = 0; i < sensors.length; i++) {
        let copyDelta = delta;
        // prevent delta from being less than min, or more than max
        if (parseFloat(sensorValues[sensors[i]]) + parseFloat(delta) < min) {
            // make delta positive
            copyDelta = Math.abs(delta);
        } else if (parseFloat(sensorValues[sensors[i]]) + parseFloat(delta) > max) {
            // make delta negative
            copyDelta = -Math.abs(delta);
        }
        sensorValues[sensors[i]] = (parseFloat(sensorValues[sensors[i]]) + parseFloat(copyDelta)).toFixed(2);
    }
    sensorValues[sensor_humidity] = 90;
}

function sendRandomData() {
    if (!client.connected) {
        return;
    }

    let builder = 'data ';
    // data sensorId:value sensorId:value ...
    generateNextSensorValues();
    for (let i = 0; i < sensors.length; i++) {
        let min = 30;
        let max = 40;
        // builder += sensors[i] + ':' + Math.floor(Math.random() * 40) + ' ';
        builder += sensors[i] + ':' + sensorValues[sensors[i]] + ' ';
    }
    const command = builder.trim();
    const topic = 'nafas_data';
    console.log('sending', command);
    client.publish(topic, command);
}