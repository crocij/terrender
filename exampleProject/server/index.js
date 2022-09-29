const static = require('node-static');
const express = require('express');
const nconf = require('nconf');
const fs = require('fs');
const processClientConfig = require('./processClientConfig');

let configFile = process.argv[2] || './config.json';
nconf.file(configFile);

/**
 * Check if path relative or absolute, if relative prepend current directory
 * @param {string} path 
 */
const resolvePath = (path) => {
    if (!path) {
        return undefined;
    }

    if (path.startsWith('/')) {
        return path;
    } else {
        return __dirname + '/' + path;
    }
}

const hostname = nconf.get('server:hostname');
const port = nconf.get('server:port');
const heightAssetFolder = resolvePath(nconf.get('server:heightAssets'));
const textureAssetFolder = resolvePath(nconf.get('server:textureAssets'));
const geomErrorFolder = resolvePath(nconf.get('server:geomErrorFolder'));
const type = nconf.get('server:type') || 'expert';

if (!(type == 'expert' || type == 'standard' || type == 'minimal' || type == 'noDrawingBench')) {
    console.error('Unknown server type: ' + type)
    process.exit(1)
}

const clientConfig = processClientConfig(nconf);

const app = express();
const staticServer = new static.Server('../client/' + type + '/public');

const handleHeightAsset = (req, res) => {
    let lod = Number.parseInt(req.params.lod);
    let x = Number.parseInt(req.params.xIndex);
    let y = Number.parseInt(req.params.yIndex);
    let fileType = clientConfig.heightIsTiff ? '.tif' : '.png'
    let path = heightAssetFolder + '/' + lod + '/' + x + '/' + y + fileType;

    fs.promises.access(path).then(() => { 
        res.sendFile(path);
    }).catch(() => {
        res.status(204);
        res.send('Height map not found for LOD: ' + lod + ' at ' + x + '/' + y);
    })
}

const handleTextureAsset = (req, res) => {
    let lod = Number.parseInt(req.params.lod);
    let x = Number.parseInt(req.params.xIndex);
    let y = Number.parseInt(req.params.yIndex);
    let fileType = '.png';
    
    if (clientConfig.colorIsTiff) {
        fileType = '.tif';
    } else if(clientConfig.colorIsJpeg) {
        fileType = '.jpg';
    }

    let path = textureAssetFolder + '/' + lod + '/' + x + '/' + y + fileType;

    fs.promises.access(path).then(() => { 
        res.sendFile(path);
    }).catch(() => {
        res.status(204);
        res.send('Texture not found for LOD: ' + lod + ' at ' + x + '/' + y)
    })
    
}

app.get('/asset/:type/:lod/:xIndex/:yIndex', (req, res) => {
    switch (req.params.type) {
        case 'height':
            handleHeightAsset(req, res);
            break;
        case 'texture':
            handleTextureAsset(req, res);
            break;
        default:
            res.status(400);
            res.send('Unknown Asset Type: ' + req.params.type);
    }
});

app.get('/geom/:lod/:kPatchBase', (req, res) => {
    if (!geomErrorFolder) {
        res.status(204);
        res.send('No geometric erros provided');
        return;
    }

    let path = geomErrorFolder + '/' + req.params.lod + '_' + req.params.kPatchBase + '.json';
    fs.promises.access(path).then(() => { 
        res.sendFile(path);
    }).catch(() => {
        res.status(204);
        res.send('Geom Error not found for LOD: ' + req.params.lod + ' with kPatchBase: ' + req.params.kPatchBase);
    })
})

app.get('/config', (req, res) => {
    res.send(JSON.stringify(clientConfig));
    return;
})

app.get('/*', (req, res) => {
    staticServer.serve(req, res);
})

app.listen(port, hostname, () => {
    console.log('Server running at ' + hostname + ':' + port);
});