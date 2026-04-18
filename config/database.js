const mysql = require('mysql2');

function resolveDatabaseHost() {
    const rawHost = String(process.env.DB_HOST || 'localhost').trim();
    const explicitPort = Number.parseInt(process.env.DB_PORT || '', 10);

    if (Number.isInteger(explicitPort) && explicitPort > 0) {
        return {
            host: rawHost,
            port: explicitPort
        };
    }

    const hostParts = rawHost.split(':');

    if (hostParts.length > 1) {
        const parsedPort = Number.parseInt(hostParts[hostParts.length - 1], 10);

        if (Number.isInteger(parsedPort) && parsedPort > 0) {
            return {
                host: hostParts.slice(0, -1).join(':') || 'localhost',
                port: parsedPort
            };
        }
    }

    return {
        host: rawHost,
        port: 3306
    };
}

const { host, port } = resolveDatabaseHost();

const pool = mysql.createPool({
    host,
    port,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bingung_gambling',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = pool.promise();

module.exports = promisePool;
