import {RecordedData} from "./data.js";

export function startCronJob(server) {
    setInterval(() => {
        tick(server);
    }, 1000 * 60); // capture every 5 seconds
}

function tick(server) {
    console.log('Capturing data...');
    let devices = server.devices;
    for (let deviceId in devices) {
        let device = devices[deviceId];
        let sensors = device.sensors; // {sensorId: value}
        for (let sensorId in sensors) {
            RecordedData.create({
                device: device.id,
                sensor: sensorId,
                value: sensors[sensorId].value,
                timestamp: Date.now(),
            })
        }
    }
}