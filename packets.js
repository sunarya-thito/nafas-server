import {
    packet_outbound_activity, packet_outbound_config,
    packet_outbound_data, packet_outbound_device_rename,
} from "./consts.js";

export class Packet {
    type;
    constructor(type) {
        this.type = type;
    }
}

export function packetFromJson(json) {
    switch (json.type) {
        case packet_outbound_data:
            return new PacketOutboundData(json.data);
        case packet_outbound_activity:
            return new PacketOutboundActivity(json.activity);
        case packet_outbound_config:
            return new PacketConfigChangeOutbound(json.configurations);
        default:
            return null;
    }
}

export class PacketOutboundData extends Packet {
    data;
    constructor(data) {
        super(packet_outbound_data);
        this.data = data;
    }
}

export class PacketOutboundActivity extends Packet {
    activity;
    constructor(activity) {
        super(packet_outbound_activity);
        this.activity = activity;
    }
}

export class PacketConfigChangeOutbound extends Packet {
    configurations;
    constructor(configurations) {
        super(packet_outbound_config);
        this.configurations = configurations;
    }
}

export class PacketDeviceRenameOutbound extends Packet {
    deviceId;
    name;
    constructor(deviceId, name) {
        super(packet_outbound_device_rename);
        this.deviceId = deviceId;
        this.name = name;
    }
}