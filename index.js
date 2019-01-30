const net = require('net');
const https = require('https');
const fetch = require('node-fetch');
const config = require('config');
const log4js = require('log4js');

const host = config.get('host');
const port = config.get('port');
const urls = config.get('urls');

log4js.configure({
    disableClustering: true,
    appenders: {
        file: {
            type: 'dateFile',
            filename: 'logs/out',
            pattern: '.yyyy-MM-dd.log',
            alwaysIncludePattern: true
        }
    },
    categories: {
        default: {
            appenders: ['file'],
            level: config.get('logLevel')
        }
    }
})
const logger = log4js.getLogger()

const server = net.createServer(onClientConnected);

server.listen(port, host, function () {
    console.log('server listening on %j', server.address());
    logger.info('server listening on %j', server.address());
});

function onClientConnected(sock) {
    var remoteAddress = sock.remoteAddress + ':' + sock.remotePort;
    logger.info('new client connected: %s', remoteAddress);

    sock.on('data', function (data) {
        logger.info('%s client is data: %s', remoteAddress, data);
        onClientData(data.toString())
            .then(data => {
                logger.warn('socket response is: %s', data);
                sock.write(data)
            })
            .catch(e => {
                logger.warn('http send faild exception: %j', e);
                sock.write(pkgResp({
                    type: 'FFFF',
                    body: '请求失败'
                }))
            });
    });
    sock.on('close', function () {
        logger.info('connection from %s closed', remoteAddress);
    });
    sock.on('error', function (err) {
        logger.info('connection %s error: %j', remoteAddress, err);
    });
};

function onClientData(data) {
    const req = unpkgReq(data);
    logger.info('http url is: %s, body is: %s', req.url, req.body);
    return fetch(req.url, {
            method: 'post',
            body: req.body,
            headers: {
                'Content-Type': 'application/xml'
            },
            agent: new https.Agent({
                rejectUnauthorized: false
            }),
        })
        .then(async res => {
            logger.info('http response is: %s->%s', res.status, res.statusText)
            if (res.status >= 200 && res.status < 300) {
                return {
                    type: '0000',
                    body: await res.text()
                }
            } else if (res.status >= 400 && res.status < 500) {
                return {
                    type: 'FFFF',
                    body: '请求错误'
                }
            } else if (res.status >= 500 && res.status < 600) {
                return {
                    type: '9999',
                    body: '服务器错误'
                }
            }
        })
        .then(pkgResp)
        .catch(e => {
            logger.warn('http request %s exception: %j', req.url, e);
            return pkgResp({
                type: 'FFFF',
                body: e.message
            })
        })
}

const unpkgReq = data => ({
    url: urls[data.substr(2, 4)],
    type: data.substr(2, 4),
    body: data.substr(6),
})

const pkgResp = resp => ((4 + resp.body.length) < 16 ? '0' : '') +
    (4 + resp.body.length).toString(16) + resp.type + resp.body