export const port_websocket = 8080;
export const port_mqtt = 1883;

export const forecast_cache_validity = 1000 * 60 * 5; // 5 minutes
export const data_input_interval = 1000 * 60 * 5; // 5 minutes

export const sensor_temperature = "temp";
export const sensor_humidity = "humid";
export const sensor_co2 = "co2";
export const sensor_gas = "gas";
export const sensor_dust = "dust";
export const sensor_network = "network";
export const sensor_air_quality_index = "aqi";

// all the following packets are sent from the server to the client
export const packet_outbound_data = "PacketOutboundData";
export const packet_outbound_activity = "PacketOutboundActivity";
export const packet_outbound_config = "PacketOutboundConfig";
export const packet_outbound_device_rename = "PacketOutboundDeviceRename";

export const role_admin = "admin";
export const role_user = "user";
export const api_request_change_config = "APIRequestChangeConfig";
export const api_request_beep_device = "APIRequestBeepDevice";
export const api_response_success = "APIResponseSuccess";
export const api_request_rename_device = "APIRequestRenameDevice";

export const api_request_sensor_values = "APIRequestSensorValues";
export const api_response_sensor_values = "APIResponseSensorValues";

export const api_response_error = "APIResponseError";
export const api_response_login_success = "APIResponseLoginSuccess";
export const api_response_logout_success = "APIResponseLogoutSuccess";
export const api_response_config = "APIResponseConfig";
export const api_response_devices = "APIResponseDevices";
export const api_response_activities = "APIResponseActivities";
export const api_response_data = "APIResponseData";
export const api_response_forecast = "APIResponseForecast";
export const api_request_forecast = "APIRequestForecast";
export const api_request_login = "APIRequestLogin";
export const api_request_logout = "APIRequestLogout";
export const api_request_config = "APIRequestConfig";
export const api_request_devices = "APIRequestDevices";
export const api_request_activities = "APIRequestActivities";
export const api_request_data = "APIRequestData";

export const event_device_online = "device_online";
export const event_device_offline = "device_offline";
export const event_data_updated = "data_updated";

export const activity_co2_high = "co2_high";
export const activity_gas_high = "gas_high";
export const activity_dust_high = "dust_high";
export const activity_temperature_high = "temperature_high";
export const activity_humidity_high = "humidity_high";
export const activity_sensor_offline = "sensor_offline";
export const activity_sensor_online = "sensor_online";
export const activity_co2_low = "co2_low";
export const activity_gas_low = "gas_low";
export const activity_dust_low = "dust_low";
export const activity_temperature_low = "temperature_low";
export const activity_humidity_low = "humidity_low";

export const command_upload_data = "data";

export const sensorIds = [sensor_temperature, sensor_humidity, sensor_co2, sensor_gas, sensor_dust, sensor_network];
