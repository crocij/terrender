const nconf = require('nconf');
const fs = require('fs');
const BinTree = require('./BinTree/BinTree');
const Quadtree = require('./Quadtree/Quadtree');
const RequestManualGC = require('./Utils/RequestManualGC');

nconf.file('./config.json');

// command to run wth increased mem limit: node --max-old-space-size=32768 index

const heightAssetFolder = nconf.get('assets:heightAssets');
const kPatchBase = nconf.get('assets:kPatchBase');
const maxLod = nconf.get('assets:maxLodLevels');
const minDiff = nconf.get('assets:minDifference') || 0;
const boundaries = nconf.get('assets:boundaries') || [-180, -90, 180, 90];
const xStart = nconf.get('assets:xStart') || 0;
const yStart = nconf.get('assets:yStart') || 0;

let startTime = Date.now();

let config = {
    maxLod: Number.parseInt(maxLod),
    kPatchBase: Number.parseInt(kPatchBase),
    heightAssetFolder: heightAssetFolder,
    lodsFirstMblock: 2 * Math.log2((257 - 1) / (kPatchBase - 1)),
    maxBinLod: 2 * Math.log2((257 - 1) / (kPatchBase - 1)) + maxLod * 2
}

let quadTree = new Quadtree(config, boundaries, xStart, yStart);

let binTree = new BinTree(config, quadTree, boundaries);

console.log('Start Setup Tree')
binTree.setupTree();
console.log('End Setup Tree')

// Free some memory
quadTree.removeRoots()

console.log('Start Loading Leaf Heights')
quadTree.loadHeightLeafs().then(() => {
    console.log('End Loading Leaf Heights')
    quadTree = undefined;
    RequestManualGC();
    console.log('Start Calculating Bounds')
    binTree.calculateBounds();
    console.log('End Calculating Bounds');
    console.log('Write Result');
    fs.writeFileSync('result_' + maxLod + '_' + kPatchBase + '_' + minDiff + '.json', binTree.toString(minDiff));

    console.log('Duration: ' + (Date.now() - startTime) / 1000)
});