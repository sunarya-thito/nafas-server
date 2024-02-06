// const { Sequelize, DataTypes } = require
import { Sequelize, DataTypes } from "sequelize";
import config from "./config.json" assert { type: "json" };
import {role_user, sensor_co2, sensor_dust, sensor_gas, sensor_humidity, sensor_temperature} from "./consts.js";

// mysql2
const sequelize = new Sequelize({
    database: config.database.database,
    host: config.database.hostname,
    port: config.database.port,
    dialect: 'mysql',
    username: config.database.username,
    password: config.database.password,
})

const User = sequelize.define('user', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    email: {
        type: DataTypes.STRING(320),
        allowNull: false,
    },
    google_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
    },
    photo_url: {
        type: DataTypes.STRING(2048),
        allowNull: true,
    },
    display_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    role: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: role_user,
    },
});

const UserSession = sequelize.define('user_session', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        // create unique index
        unique: 'user_session_user_id_token',
    },
    token: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    device_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    device_id: {
        type: DataTypes.STRING(255), // the mobile device id (mac address)
        allowNull: false,
        unique: 'user_session_user_id_token',
    },
    last_active: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
});

const Device = sequelize.define('device', {
    id: {
        type: DataTypes.STRING(255), // from mqtt client id
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    hue: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    saturation: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    value: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
});

const Activity = sequelize.define('activity', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    type: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    timestamp: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    value: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    sensor: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    device: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
}, {
    indexes: [
        {
            fields: ['timestamp', 'sensor', 'device'],
        },
    ],
})

const RecordedData = sequelize.define('recorded_data', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    sensor: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    value: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    timestamp: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    device: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
}, {
    indexes: [
        {
            fields: ['timestamp', 'sensor', 'device'],
        }
    ],
});

const SensorConfig = sequelize.define('sensor', {
    id: {
        type: DataTypes.STRING(50),
        primaryKey: true,
        allowNull: false,
    },
    min_threshold: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    max_threshold: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
});

async function initDatabase() {
    // initialize associations
    User.hasMany(UserSession, {
        foreignKey: 'user_id',
    });
    UserSession.belongsTo(User, {
        foreignKey: 'user_id',
    });
    Device.hasMany(Activity, {
        foreignKey: 'device',
        as: 'deviceKey2',
    });
    Activity.belongsTo(Device, {
        foreignKey: 'device',
        as: 'deviceKey2',
    });
    Device.hasMany(RecordedData, {
        foreignKey: 'device',
        as: 'deviceKey',
    });
    RecordedData.belongsTo(Device, {
        foreignKey: 'device',
        as: 'deviceKey',
    });
    // await sequelize.sync();
    // force
    await sequelize.sync();
    // store default sensor configurations (ignore if already exists)
    await SensorConfig.findOrCreate({
        where: {
            id: sensor_temperature,
        },
        defaults: {
            min_threshold: 15, // below 15 is too cold
            max_threshold: 30, // above 30 is too hot
        }
    });
    await SensorConfig.findOrCreate({
        where: {
            id: sensor_humidity,
        },
        defaults: {
            min_threshold: 30, // below 30 is too dry
            max_threshold: 70, // above 70 is too wet
        }
    });
    await SensorConfig.findOrCreate({
        where: {
            id: sensor_co2,
        },
        defaults: {
            min_threshold: 0, // below 0 is too low
            max_threshold: 1000, // above 1000 is too high
        }
    });
    await SensorConfig.findOrCreate({
        where: {
            id: sensor_gas,
        },
        defaults: {
            min_threshold: 0, // below 0 is too low
            max_threshold: 1000, // above 1000 is too high
        }
    });
    await SensorConfig.findOrCreate({
        where: {
            id: sensor_dust,
        },
        defaults: {
            min_threshold: 0, // below 0 is too low
            max_threshold: 1000, // above 1000 is too high
        }
    });


}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function createUserSession(googleId, deviceName, deviceId) {
    let token = generateToken();
    // also create a new user if not exists
    let user = await User.findOrCreate({
        where: {
            google_id: googleId,
        }
    });
    let role = user[0].role;
    let userId = user[0].id;
    await UserSession.upsert({
        user_id: userId,
        token: token,
        device_name: deviceName,
        device_id: deviceId,
        last_active: new Date(),
    });
    return {
        token: token,
        role: role,
    };
}

async function getUserFromSessionToken(token) {
    let session = await UserSession.findOne({
        where: {
            token: token,
        }
    });
    if (session === null) {
        return null;
    }
    return await User.findOne({
        where: {
            id: session.user_id,
        }
    });
}


export { User, Activity, RecordedData, SensorConfig, Device, initDatabase, createUserSession, getUserFromSessionToken };