import {
    api_request_activities,
    api_request_beep_device,
    api_request_change_config,
    api_request_color,
    api_request_config,
    api_request_data,
    api_request_devices,
    api_request_forecast,
    api_request_login,
    api_request_logout,
    api_request_rename_device,
    api_request_sensor_values,
    api_response_activities,
    api_response_color,
    api_response_config,
    api_response_data,
    api_response_devices,
    api_response_error,
    api_response_forecast,
    api_response_login_success,
    api_response_logout_success,
    api_response_sensor_values,
    api_response_success
} from "./consts.js";

export function parseDtoRequest(json) {
    let type = json["type"];
    switch (type) {
        case api_request_login:
            return new APIRequestLogin(json["deviceName"], json["googleAccessToken"]);
        case api_request_logout:
            return new APIRequestLogout(json["userToken"]);
        case api_request_config:
            return new APIRequestConfig();
        case api_request_devices:
            return new APIRequestDevices();
        case api_request_activities:
            return new APIRequestActivities(json["limit"], json["fromId"], json["fromDate"], json["toDate"], json["devices"], json["sensors"]);
        case api_request_data:
            return new APIRequestData(json["fromDate"], json["toDate"], json["deviceId"], json["sensorId"]);
        case api_request_forecast:
            return new APIRequestForecast(json["deviceId"], json["sensorId"], json["forecastUntil"]);
        case api_request_beep_device:
            return new APIRequestBeepDevice(json["userToken"], json["deviceId"]);
        case api_request_rename_device:
            return new APIRequestRenameDevice(json["userToken"], json["deviceId"], json["deviceName"]);
        case api_request_change_config:
            return new APIRequestChangeConfig(json["userToken"], json["configurations"]);
        case api_request_sensor_values:
            return new APIRequestSensorValues(json["deviceId"]);
        case api_request_color:
            return new APIRequestColor(json["deviceId"]);
        default:
            return null;
    }
}
export class APIData {
    type;
    constructor(type) {
        this.type = type;
    }
}

export class APIRequestSensorValues extends APIData {
    deviceId;
    constructor(deviceId) {
        super(api_request_sensor_values);
        this.deviceId = deviceId;
    }
}

export class APIResponseSensorValues extends APIData {
    values; // {sensorId: value}
    constructor(values) {
        super(api_response_sensor_values);
        this.values = values;
    }
}

export class APIRequestChangeConfig extends APIData {
    userToken;
    configurations;

    constructor(userToken, configurations) {
        super(api_request_change_config);
        this.userToken = userToken;
        this.configurations = configurations;
    }
}

export class APIRequestRenameDevice extends APIData {
    userToken;
    deviceId;
    deviceName;
    constructor(userToken, deviceId, deviceName) {
        super(api_request_rename_device);
        this.userToken = userToken;
        this.deviceId = deviceId;
        this.deviceName = deviceName;
    }
}

export class APIRequestBeepDevice extends APIData {
    userToken;
    deviceId;
    constructor(userToken, deviceId) {
        super(api_request_beep_device);
        this.userToken = userToken;
        this.deviceId = deviceId;
    }
}

export class APIResponseSuccess extends APIData {
    constructor() {
        super(api_response_success);
    }
}

export class APIResponseError extends APIData {
    message;
    constructor(message) {
        super(api_response_error);
        this.message = message;
    }
}

export class APIRequestLogin extends APIData {
    deviceName;
    googleAccessToken;

    constructor(deviceName, googleAccessToken) {
        super(api_request_login);
        this.deviceName = deviceName;
        this.googleAccessToken = googleAccessToken;
    }
}

export class APIRequestLogout extends APIData {
    userToken;
    constructor(userToken) {
        super(api_request_logout);
        this.userToken = userToken;
    }
}

export class APIRequestConfig extends APIData {
    constructor() {
        super(api_request_config);
    }
}

export class APIRequestDevices extends APIData {
    constructor() {
        super(api_request_devices);
    }
}

export class APIRequestActivities extends APIData {
    limit;
    fromId; // for pagination purposes, null if start from beginning, max is 100 per request
    fromDate;
    toDate;
    devices; // array of device ids, null if all devices
    sensors; // array of sensor ids, null if all sensors
    constructor(limit, fromId, fromDate, toDate, devices, sensors) {
        super(api_request_activities);
        this.limit = limit;
        this.fromId = fromId;
        this.fromDate = fromDate;
        this.toDate = toDate;
        this.devices = devices;
        this.sensors = sensors;
    }
}

export class APIRequestData extends APIData {
    fromDate; // can be null, but however, max is 100 per request (from latest)
    toDate; // can be null, but however, max is 100 per request (from latest)
    deviceId; // must not be null
    sensorId; // must not be null
    constructor(fromDate, toDate, deviceId, sensorId) {
        super(api_request_data);
        this.fromDate = fromDate;
        this.toDate = toDate;
        this.deviceId = deviceId;
        this.sensorId = sensorId;
    }
}

export class APIResponseLoginSuccess extends APIData {
    token;
    role;
    constructor(token, role) {
        super(api_response_login_success);
        this.token = token;
        this.role = role;
    }
}

export class APIResponseLogoutSuccess extends APIData {
    constructor() {
        super(api_response_logout_success);
    }
}

export class APIResponseConfig extends APIData {
    configurations; // {sensorId: {min: number, max: number}}
    constructor(configurations) {
        super(api_response_config);
        this.configurations = configurations;
    }
}

export class APIResponseDevices extends APIData {
    devices; // {deviceId: {name: string, isOnline: boolean}}
    constructor(devices) {
        super(api_response_devices);
        this.devices = devices;
    }
}

export class APIResponseActivities extends APIData {
    activities; // {activityId: {type: string, timestamp: number, deviceId: string, sensorId: string, value: number}}
    constructor(activities) {
        super(api_response_activities);
        this.activities = activities;
    }
}

export class APIResponseData extends APIData {
    data; // {timestamp: number, value: number}
    average; // number
    highest; // number
    highestWhen; // number (timestamp)
    lowest; // number
    lowestWhen; // number (timestamp)
    constructor(data, average, highest, lowest, highestWhen, lowestWhen) {
        super(api_response_data);
        this.data = data;
        this.average = average;
        this.highest = highest;
        this.lowest = lowest;
        this.highestWhen = highestWhen;
        this.lowestWhen = lowestWhen;
    }
}

export class APIRequestForecast extends APIData {
    deviceId;
    sensorId;
    forecastUntil;

    constructor(deviceId, sensorId, forecastUntil) {
        super(api_request_forecast);
        this.deviceId = deviceId;
        this.sensorId = sensorId;
        this.forecastUntil = forecastUntil;
    }
}

export class APIResponseForecast extends APIData {
    forecast; // {timestamp: number, value: number}
    constructor(forecast) {
        super(api_response_forecast);
        this.forecast = forecast;
    }
}

export class APIRequestColor extends APIData {
    deviceId;
    constructor(deviceId) {
        super(api_request_color);
        this.deviceId = deviceId;
    }
}

export class APIResponseColor extends APIData {
    color;
    constructor(color) {
        super(api_response_color);
        this.color = color;
    }
}

