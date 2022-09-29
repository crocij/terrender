const processClientConfig = (conf) => {
    let clientConfig = conf.get('client');

    // Set default values
    clientConfig = Object.assign({
        tileSideLength: 257,
        boundaries: [-180, -90, 180, 90],
        estMaxHeight: 10000,
        heightScaling: 0.000025,
        xStart: 0,
        yStart: 0,
        maxLod: 7,
        kPatchBase: 129,
        currentLod: 7,
        errorThreshold: 0.01,
        useCullingMetric: true,
        useDistanceMetric: true,
        useMinMaxForErrors: false,
        maxGpuCache: 200,
        maxRamCache: 400,
        colorIsTiff: false,
        colorIsJpeg: false,
        heightIsTiff: true,
        noColorTextures: false,
        dynamicBinTreeUpdate: true,
        dynamicBinTreeUpdateTreeLengthRatio: 0.75,
        dynamicBinTreeUpdateNotReadyRatio: 0.2,
    }, clientConfig);

    // Set values that can be derived from server settings
    let geomFolder = conf.get('server:geomErrorFolder');
    clientConfig.useGeomMetric = geomFolder && clientConfig.useGeomMetric !== false ? true : false;

    let textureFolder = conf.get('server:textureAssets');
    clientConfig.noColorTextures = !clientConfig.noColorTextures && textureFolder ? false : true;

    // Handle cam settings
    if (!clientConfig.initialCamera) {
        clientConfig.initialCamera = {}
    }

    clientConfig.initialCamera = Object.assign({
        pos: [(clientConfig.boundaries[0] + clientConfig.boundaries[2]) / 2, clientConfig.boundaries[3], clientConfig.estMaxHeight * clientConfig.heightScaling * 4],
        target: [(clientConfig.boundaries[0] + clientConfig.boundaries[2]) / 2, clientConfig.boundaries[3] - clientConfig.estMaxHeight * clientConfig.heightScaling * 12, 0],
        up: [0, 0, 1],
        sensitivity: 0.5
    }, clientConfig.initialCamera);

    if (clientConfig.dollyCam && clientConfig.dollyCam.length > 0) {
        clientConfig.initialCamera = Object.assign(clientConfig.initialCamera, clientConfig.dollyCam[0]);
    }

    return clientConfig;
}

module.exports = processClientConfig;