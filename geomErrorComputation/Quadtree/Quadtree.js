const QuadtreeNode = require('./QuadtreeNode.js');
const RequestManualGC = require('../Utils/RequestManualGC')

class Quadtree {

    /**
     * 
     * @param {*} globalConfig 
     * @param {*} config 
     */
    constructor(globalConfig, boundaries, x, y) {
        this.globalConfig = globalConfig;

        this.roots = [];
        let xLength = Math.abs(boundaries[0] - boundaries[2]);
        let yLength = Math.abs(boundaries[1] - boundaries[3]);

        if (xLength >= yLength) {
            let nrOfMblocks = xLength / yLength;
            for (let i = 0; i < nrOfMblocks; i++) {
                this.roots.push(new QuadtreeNode(globalConfig, x + i, y, 0, this));
            }
        } else {
            let nrOfMblocks = yLength / xLength;
            for (let i = 0; i < nrOfMblocks; i++) {
                this.roots.push(new QuadtreeNode(globalConfig, x, y + 1, 0, this));
            }
        }

        this.leafs = [];
    }

    removeRoots = () => {
        this.superRoot = undefined;
        this.roots = undefined;
    }

    addLeaf = (leaf) => {
        this.leafs.push(leaf);
    }

    loadHeightLeafs = async () => {
        let percent = 0;
        let perPercent = Math.ceil(this.leafs.length / 100)
        for (let i = 0; i < this.leafs.length; i++) {
            await this.leafs[i].loadHeightIntoNodes();
            if (i % perPercent == 0) {
                let start = Date.now()
                RequestManualGC();
                console.log('Tiles loaded: ' + percent + '%; Time for GC[s]: ' + ((Date.now() - start) / 1000))
                percent += 1;
            }
        }
        this.leafs = undefined;
    }
}

module.exports = Quadtree;