import {Activity, createUserSession, Device, getUserFromSessionToken, RecordedData, SensorConfig} from "./data.js";
import {Model as UserSession, Op} from "sequelize";
import {verifyUser} from "./auth.js";
import {
    activity_sensor_offline,
    activity_sensor_online,
    data_input_interval, forecast_cache_validity,
    role_admin,
    sensor_network, sensorIds
} from "./consts.js";
import {
    PacketConfigChangeOutbound, PacketDeviceRenameOutbound,
    PacketOutboundActivity,
    PacketOutboundData
} from "./packets.js";
import {EventActivity, EventDeviceDataUpdated, EventDeviceOffline, EventDeviceOnline} from "./events.js";
// import ARIMA from "arima";

import {
    APIRequestActivities, APIRequestBeepDevice, APIRequestChangeConfig,
    APIRequestConfig,
    APIRequestData,
    APIRequestDevices,
    APIRequestForecast,
    APIRequestLogin,
    APIRequestLogout, APIRequestRenameDevice, APIRequestSensorValues,
    APIResponseActivities,
    APIResponseConfig,
    APIResponseData,
    APIResponseDevices,
    APIResponseError,
    APIResponseForecast,
    APIResponseLoginSuccess,
    APIResponseLogoutSuccess, APIResponseSensorValues, APIResponseSuccess
} from "./dto.js";
import {ActivityData, DataEntry, typeFromSensor} from "./objects.js";
import ARIMA from "arima";
import WebSocket, {WebSocketServer} from "ws";

class SensorDevice {
    id;
    isOnline = false;
    sensors = {};
    previousCompare = {}; // {sensorId: -1, 0, 1}
    websocketServer; // every device has its own websocket, but bound to this url: ws://localhost:8080/device?id={id}
    name;
    server;
    constructor(id, server) {
        this.id = id;
        this.server = server;
        function heartbeat() {
            this.isAlive = true;
        }
        this.websocketServer = new WebSocketServer({ noServer: true });
        this.websocketServer.on('connection', function connection(ws) {
            ws.isAlive = true;
            ws.on('error', function error(err) {
                console.error(err);
            });
            ws.on('pong', heartbeat);
        });

        const interval = setInterval(() => {
            this.websocketServer.clients.forEach(function each(ws) {
                if (ws.isAlive === false) return ws.terminate();

                ws.isAlive = false;
                ws.ping(() => {});
            });
        }, 30000);

        // listen for incoming messages
        // this.websocketServer.on('message', async (message) => {
        //     let json;
        //     try {
        //         json = JSON.parse(message);
        //     } catch (e) {
        //         return;
        //     }
        //     const packet = packetFromJson(json);
        //     if (packet === null) {
        //         return;
        //     }
        //     // check if packet is change config packet
        //     // if (packet instanceof PacketConfigChangeInbound) {
        //     //     let token = packet.userToken; // this is token from database not google token
        //     //     let user = await getUserFromSessionToken(token);
        //     //     if (user === null || user.role !== role_admin) {
        //     //         return;
        //     //     }
        //     //     // config is a global thing, not a device thing
        //     //     const config = packet.configurations; // {sensorId: {min: number, max: number}}
        //     //     // broadcast to all clients
        //     //     this.broadcast(new PacketConfigChangeOutbound(config));
        //     //     // update database
        //     //     for (let sensorId in config) {
        //     //         if (config.hasOwnProperty(sensorId)) {
        //     //             let sensorConfig = config[sensorId];
        //     //             let min = sensorConfig.min;
        //     //             let max = sensorConfig.max;
        //     //             // update database
        //     //             await SensorConfig.update({
        //     //                 min: min,
        //     //                 max: max,
        //     //             }, {
        //     //                 where: {
        //     //                     sensor: sensorId,
        //     //                     device: this.id,
        //     //                 }
        //     //             });
        //     //         }
        //     //     }
        //     // }
        // });

        this.websocketServer.on('close', function close() {
            clearInterval(interval);
        });
    }
    broadcast(packet) {
        let jsonPacket = JSON.stringify(packet);
        this.websocketServer.clients.forEach(async function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(jsonPacket);
            }
        });
    }
    updateData(map) {
        let sensorValues = {};
        for (let i in map) {
            if (!sensorIds.includes(i)) {
                continue;
            }
            let sensor = this.sensors[i];
            if (sensor === undefined) {
                sensor = new Sensor(i);
                this.sensors[i] = sensor;
            }
            sensor.value = map[i];
            sensorValues[i] = sensor.value;
        }
        this.broadcast(new PacketOutboundData(sensorValues));
    }
    async updateOnlineStatus(isOnline) {
        if (this.isOnline === isOnline) {
            return;
        }
        this.isOnline = isOnline;
        if (!isOnline) {
            // clear all sensors
            this.sensors = {};
        }
        let packetOutboundActivity = new PacketOutboundActivity(
            isOnline ?
                new ActivityData(
                    activity_sensor_online,
                    // now in milliseconds
                    Date.now(),
                    sensor_network,
                    this.id,
                    1,
                ) :
                new ActivityData(
                    activity_sensor_offline,
                    // now in milliseconds
                    Date.now(),
                    sensor_network,
                    this.id,
                    0,
                )
        );
        this.server.noDevice.broadcast(packetOutboundActivity);
        for (let device of this.server.devices) {

            device.broadcast(packetOutboundActivity);
        }
        await Activity.create({
            type: isOnline ? activity_sensor_online : activity_sensor_offline,
            timestamp: Date.now(),
            sensor: sensor_network,
            device: this.id,
            value: isOnline ? 1 : 0,
        });
    }
}

class Sensor {
    id;
    value;

    constructor(id) {
        this.id = id;
    }
}
class Server {
    noDevice; // dummy device for when theres no device connected
    devices = [];
    sensorConfigurations = {}; // {sensorId: {min: number, max: number}}
    mqttServer;
    getDeviceById(id) {
        for (let i = 0; i < this.devices.length; i++) {
            let device = this.devices[i];
            if (device.id === id) {
                return device;
            }
        }
        return undefined;
    }
    async dispatchEvent(event) {
        if (event instanceof EventDeviceDataUpdated) {
            let device = this.getDeviceById(event.clientId);
            if (device !== undefined) {
                let previousData = device.sensors;
                let deepCopy = {};
                for (let sensorId in previousData) {
                    deepCopy[sensorId] = previousData[sensorId].value;
                }
                device.updateData(event.sensors);
                for (let sensorId in event.sensors) {
                    let previousValue = deepCopy[sensorId];
                    let config = this.sensorConfigurations[sensorId];
                    if (previousValue === undefined || config === undefined) {
                        continue;
                    }
                    let compare = 0;
                    let min = config.min;
                    let max = config.max;
                    if (previousValue < min) {
                        compare = -1;
                    } else if (previousValue > max) {
                        compare = 1;
                    } else {
                        compare = 0;
                    }
                    let previousCompare = device.previousCompare[sensorId];
                    // TO PREVENT SPAMMING ACTIVITY
                    if (previousCompare !== compare) {
                        device.previousCompare[sensorId] = compare;
                        if (compare !== 0) {
                            let type = typeFromSensor(sensorId, compare === -1);
                            if (type) {
                                let activity = new ActivityData(
                                    type,
                                    // now in milliseconds
                                    Date.now(),
                                    sensorId,
                                    event.clientId,
                                    previousValue,
                                );
                                console.log(JSON.stringify(activity));
                                await this.dispatchEvent(new EventActivity(activity));
                            }
                        }
                    }
                }

            }
        } else if (event instanceof EventActivity) {
            let activity = event.activity;
            await Activity.create({
                type: activity.type,
                timestamp: activity.timestamp,
                sensor: activity.sensor,
                device: activity.device,
                value: activity.value,
            });
            // broadcast to all clients
            this.noDevice.broadcast(new PacketOutboundActivity(activity));
            for (let i = 0; i < this.devices.length; i++) {
                let device = this.devices[i];
                device.broadcast(new PacketOutboundActivity(activity));
            }
        } else if (event instanceof EventDeviceOnline) {
            let device = this.getDeviceById(event.clientId);
            if (device === undefined) {
                device = new SensorDevice(event.clientId, this);
                // // get the name from the database
                // let deviceData = await Device.findOne({
                //     where: {
                //         id: event.clientId,
                //     }
                // });
                // if (deviceData !== null) {
                //     device.name = deviceData.name;
                // }
                // this.devices.push(device);
                // get or create the device
                let deviceData = await Device.findOrCreate({
                    where: {
                        id: event.clientId,
                    },
                    defaults: {
                        name: device.name,
                    }
                });
                device.name = deviceData[0].name;
                this.devices.push(device);
            }
            await device.updateOnlineStatus(true);
        } else if (event instanceof EventDeviceOffline) {
            // do not remove, just mark as offline
            let device = this.getDeviceById(event.clientId);
            if (device !== undefined) {
                await device.updateOnlineStatus(false);
            }
        }
    }
    async dispatchAPIRequest(request, user) {
        if (request instanceof APIRequestDevices) {
            let devices = {}; // {deviceId: {name: string, isOnline: boolean}}
            for (let i = 0; i < this.devices.length; i++) {
                let device = this.devices[i];
                devices[device.id] = {
                    name: device.name,
                    isOnline: device.isOnline,
                }
            }
            return new APIResponseDevices(devices);
        } else if (request instanceof APIRequestActivities) {
            console.log(JSON.stringify(request));
            let limit = request.limit;
            let activities = {}; // array of ActivityData
            let where = {};
            if (request.fromId !== null && request.fromId >= 0) {
                where.id = {
                    [Op.lt]: request.fromId, // lt because the pagination is from latest to oldest
                }
            }
            if (request.fromDate !== null) {
                // request.fromDate might be a number
                if (typeof request.fromDate === "number") {
                    // it represents the millis since epoch
                    // if its below 0, then its a null
                    if (request.fromDate >= 0) {
                        where.timestamp = {
                            [Op.gt]: request.fromDate,
                        }
                    }
                }
            }
            if (request.toDate !== null) {
                // request.toDate might be a number
                if (typeof request.toDate === "number") {
                    // it represents the millis since epoch
                    // if its below 0, then its a null
                    if (request.toDate >= 0) {
                        where.timestamp = {
                            [Op.lt]: request.toDate,
                        }
                    }
                }
            }
            if (request.devices !== null && request.devices.length > 0) {
                where.device = {
                    [Op.in]: request.devices,
                }
            }
            if (request.sensors !== null && request.sensors.length > 0) {
                where.sensor = {
                    [Op.in]: request.sensors,
                }
            }
            if (limit !== null) {
                if (limit >= 0) {
                    limit = Math.min(limit, 100); // safe limit is 100 (max 100 per request)
                } else {
                    limit = 100;
                }
            } else {
                limit = 100;
            }
            let activitiesData = await Activity.findAll({
                where: where,
                limit: limit,
                order: [
                    ['id', 'DESC'],
                ],
            });
            for (let i = 0; i < activitiesData.length; i++) {
                let activityData = activitiesData[i];
                let device = await Device.findOne({
                    where: {
                        id: activityData.device,
                    }
                });
                // activities.push(new ActivityData(
                //     activityData.type,
                //     activityData.timestamp,
                //     activityData.sensor,
                //     activityData.device,
                //     activityData.value,
                // ));
                activities[activityData.id] = new ActivityData(
                    activityData.type,
                    activityData.timestamp,
                    activityData.sensor,
                    device.name,
                    activityData.value,
                );
            }
            return new APIResponseActivities(activities);
        } else if (request instanceof APIRequestData) {
            let where = {
                sensor: request.sensorId,
                device: request.deviceId,
            };
            if (request.fromDate !== null) {
                // request.fromDate might be a number
                if (typeof request.fromDate === "number") {
                    // it represents the millis since epoch
                    // if its below 0, then its a null
                    if (request.fromDate >= 0) {
                        where.timestamp = {
                            [Op.gt]: request.fromDate,
                        }
                    }
                }
            }
            if (request.toDate !== null) {
                // request.toDate might be a number
                if (typeof request.toDate === "number") {
                    // it represents the millis since epoch
                    // if its below 0, then its a null
                    if (request.toDate >= 0) {
                        where.timestamp = {
                            [Op.lt]: request.toDate,
                        }
                    }
                }
            }
            let recordedData = await RecordedData.findAll({
                where: where,
                order: [
                    ['timestamp', 'DESC'],
                ],
            });
            let data = [];
            let sum = 0;
            let lowest = null;
            let highest = null;
            let lowestTimestamp = null;
            let highestTimestamp = null;
            for (let i = 0; i < recordedData.length; i++) {
                let dataEntry = recordedData[i];
                dataEntry.value = parseFloat(dataEntry.value);
                data.push(new DataEntry(dataEntry.timestamp, dataEntry.value));
                sum += dataEntry.value;
                if (lowest === null || dataEntry.value < lowest) {
                    lowest = dataEntry.value;
                    lowestTimestamp = dataEntry.timestamp;
                }
                if (highest === null || dataEntry.value > highest) {
                    highest = dataEntry.value;
                    highestTimestamp = dataEntry.timestamp;
                }
            }
            let average = sum / recordedData.length;
            return new APIResponseData(data, average, highest, lowest, highestTimestamp, lowestTimestamp);
        } else if (request instanceof APIRequestConfig && user !== null) {
            console.log(JSON.stringify(this.sensorConfigurations));
            return new APIResponseConfig(this.sensorConfigurations)
        } else if (request instanceof APIRequestSensorValues) {
            let deviceId = request.deviceId;
            let values = {};
            let device = this.getDeviceById(deviceId);
            if (device !== undefined) {
                for (let sensorId in device.sensors) {
                    let sensor = device.sensors[sensorId];
                    values[sensorId] = sensor.value;
                }
                values[sensor_network] = device.isOnline ? 1 : 0;
            }
            return new APIResponseSensorValues(values)
        } else if (request instanceof APIRequestBeepDevice) {
            let userToken = request.userToken;
            let user = await getUserFromSessionToken(userToken);
            if (user === null || user.role !== role_admin) {
                return new APIResponseError("Invalid token");
            }
            let deviceId = request.deviceId;
            let device = this.getDeviceById(deviceId);
            if (device !== undefined) {
                this.mqttServer.sendCommand(deviceId, "buzz 5000");
                return new APIResponseSuccess();
            }
            return new APIResponseError("Device not found");
        } else if (request instanceof APIRequestRenameDevice) {
            let userToken = request.userToken;
            let user = await getUserFromSessionToken(userToken);
            if (user === null || user.role !== role_admin) {
                return new APIResponseError("Invalid token");
            }
            let deviceId = request.deviceId;
            let device = this.getDeviceById(deviceId);
            if (device !== undefined) {
                Device.update({
                    name: request.deviceName,
                }, {
                    where: {
                        id: deviceId,
                    }
                });
                // update the name in the device
                device.name = request.deviceName;
                // broadcast to all clients
                this.noDevice.broadcast(new PacketDeviceRenameOutbound(deviceId, request.deviceName));
                for (let i = 0; i < this.devices.length; i++) {
                    let device = this.devices[i];
                    device.broadcast(new PacketDeviceRenameOutbound(deviceId, request.deviceName));
                }
                return new APIResponseSuccess();
            }
            return new APIResponseError("Device not found");
        } else if (request instanceof APIRequestChangeConfig) {
            let userToken = request.userToken;
            let user = await getUserFromSessionToken(userToken);
            if (user === null || user.role !== role_admin) {
                return new APIResponseError("Invalid token");
            }
            let config = request.configurations; // {sensorId: {min: number, max: number}}
            // broadcast to all clients
            this.noDevice.broadcast(new PacketConfigChangeOutbound(config));
            for (let i = 0; i < this.devices.length; i++) {
                let device = this.devices[i];
                device.broadcast(new PacketConfigChangeOutbound(config));
            }
            // update database
            for (let sensorId in config) {
                if (config.hasOwnProperty(sensorId)) {
                    let sensorConfig = config[sensorId];
                    let currentConfig = this.sensorConfigurations[sensorId];
                    if (currentConfig === undefined) {
                        currentConfig = {};
                        this.sensorConfigurations[sensorId] = currentConfig;
                    }
                    let min = sensorConfig.min;
                    let max = sensorConfig.max;
                    currentConfig.min = min;
                    currentConfig.max = max;
                    // update database
                    await SensorConfig.update({
                        min: min,
                        max: max,
                    }, {
                        where: {
                            sensor: sensorId,
                        }
                    });
                }
            }
            return new APIResponseSuccess();
        } else if (request instanceof APIRequestLogin) {
            let googleAccessToken = request.googleAccessToken;
            let deviceName = request.deviceName;
            let googleUser = await verifyUser(googleAccessToken);
            if (googleUser === null) {
                return new APIResponseError("Invalid Google access token");
            }
            let result = await createUserSession(googleUser, deviceName);
            return new APIResponseLoginSuccess(result.token, result.role);
        } else if (request instanceof APIRequestLogout) {
            let token = request.token;
            let session = await UserSession.findOne({
                where: {
                    token: token,
                }
            });
            if (session === null) {
                return new APIResponseError("Invalid token");
            }
            await session.destroy();
            return new APIResponseLogoutSuccess();
        } else if (request instanceof APIRequestForecast) {
            let deviceId = request.deviceId;
            let sensorId = request.sensorId;
            let forecastUntil = request.forecastUntil;
            // max forecasting is 1 month
            let where = {
                sensor: sensorId,
                device: deviceId,
            };
            let dataEntries = await RecordedData.findAll({
                where: where,
                order: [
                    ['timestamp', 'DESC'],
                ],
                limit: 200,
            });
            if (dataEntries.length === 0) {
                return new APIResponseForecast([]);
            }
            // forecast 1 month of data using ARIMA
            let forecastedData = [];
            let data = [];
            for (let i = 0; i < dataEntries.length; i++) {
                let dataEntry = dataEntries[i];
                data.push(parseFloat(dataEntry.value));
            }
            let firstTimestamp = dataEntries[0].timestamp;
            let lastTimestamp = dataEntries[dataEntries.length - 1].timestamp;
            let averageInterval = (firstTimestamp - lastTimestamp) / dataEntries.length;
            if (averageInterval <= data_input_interval) {
                averageInterval = data_input_interval;
            }
            // firstTimestamp - lastTimestamp  because the data is sorted DESC
            let forecast;
            forecast = new ARIMA({
                p: 1,
                d: 1,
                q: 1,
                verbose: false,
            }).fit(data);
            // let amountOfPrediction = Math.floor((forecastUntil - dataEntries[0].timestamp) / data_input_interval);
            // let amountOfPrediction = 100;
            let amountOfPrediction = Math.floor(forecastUntil / averageInterval);
            console.log('Forecasting until: ' + forecastUntil);
            console.log('Average interval: ' + averageInterval);
            console.log('Amount of prediction: ' + amountOfPrediction);
            let forecasted;
            let errors;
            try {
                [forecasted, errors] = forecast.predict(amountOfPrediction);
            } catch (e) {
                console.error(e);
                return new APIResponseError("Invalid request");
            }
            for (let i in forecasted) {
                let forecastedValue = forecasted[i];
                // forecastedData.push(new DataEntry(lastTimestamp + data_input_interval * (i + 1), forecastedValue));
                forecastedData.push(new DataEntry(lastTimestamp + averageInterval * (i + 1), forecastedValue));
            }
            return new APIResponseForecast(forecastedData);
        } else {
            return new APIResponseError("Invalid request");
        }
    }

    initialize() {
        this.noDevice = new SensorDevice(-1, this);
        // load sensor configurations
        SensorConfig.findAll().then((sensorConfigs) => {
            for (let i = 0; i < sensorConfigs.length; i++) {
                let sensorConfig = sensorConfigs[i];
                let sensorId = sensorConfig.id;
                let min = sensorConfig.min_threshold;
                let max = sensorConfig.max_threshold;
                this.sensorConfigurations[sensorId] = {
                    min: parseFloat(min),
                    max: parseFloat(max),
                }
            }
        });
    }
}

export {SensorDevice, Sensor, Server}