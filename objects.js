import {
    activity_co2_high,
    activity_co2_low,
    activity_dust_high,
    activity_dust_low, activity_gas_high, activity_gas_low,
    activity_humidity_high,
    activity_humidity_low,
    activity_temperature_high,
    activity_temperature_low,
    sensor_co2,
    sensor_dust, sensor_gas,
    sensor_humidity, sensor_network,
    sensor_temperature
} from "./consts.js";

export function typeFromSensor(sensor, below) {
    switch (sensor) {
        case sensor_temperature:
            return below ? activity_temperature_low : activity_temperature_high;
        case sensor_humidity:
            return below ? activity_humidity_low : activity_humidity_high;
        case sensor_dust:
            return below ? activity_dust_low : activity_dust_high;
        case sensor_co2:
            return below ? activity_co2_low : activity_co2_high;
        case sensor_gas:
            return below ? activity_gas_low : activity_gas_high;
        default:
            return null;
    }
}
export class ActivityData {
    type;
    timestamp;
    device;
    sensor;
    value;
    constructor(type, timestamp, sensor, device, value) {
        this.type = type;
        this.timestamp = timestamp;
        this.sensor = sensor;
        this.device = device;
        this.value = value;
    }
}

export class DataEntry {
    timestamp;
    value;

    constructor(timestamp, value) {
        this.timestamp = timestamp;
        this.value = value;
    }
}