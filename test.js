const net = require('net');

const client = net.createConnection({
    port: 1337,
    host: '127.0.0.1'
}, () => {
    console.log('connected to server!');
    client.write('fa1001aaa');
});

client.on('data', (data) => {
    console.log(data.toString());
    client.end();
});

client.on('end', () => {
    console.log('disconnected from server');
});