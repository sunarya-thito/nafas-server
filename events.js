import {event_data_updated, event_device_offline, event_device_online} from "./consts.js";

export class Event {
    type;
    constructor(type) {
        this.type = type;
    }
}

export class EventDeviceDataUpdated extends Event {
    clientId;
    sensors; // {sensorId: value}
    constructor(clientId, sensors) {
        super(event_data_updated);
        this.clientId = clientId;
        this.sensors = sensors;
    }
}

export class EventActivity extends Event {
    activity;
    constructor(activity) {
        super(event_data_updated);
        this.activity = activity;
    }
}

export class EventDeviceOnline extends Event {
    clientId;
    constructor(clientId) {
        super(event_device_online);
        this.clientId = clientId;
    }
}

export class EventDeviceOffline extends Event {
    clientId;
    constructor(clientId) {
        super(event_device_offline);
        this.clientId = clientId;
    }
}
