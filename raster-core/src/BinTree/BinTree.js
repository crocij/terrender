import Quadtree from "../Quadtree/Quadtree";
import Raster from "../Raster";
import BinTreeNode from "./BinTreeNode";

/**
 * @property {Array.<BinTreeNode>} children
 */
class BinTree {

    /**
     * Root Element of the Bintree
     * 
     * @param {Raster} raster 
     * @param {Quadtree} quadTree 
     * @param {Array.<number>} boundaries 
     */
    constructor(raster, quadTree, boundaries) {
        this.raster = raster;
        this.center = [
            (boundaries[0] + boundaries[2]) / 2,
            (boundaries[1] + boundaries[3]) / 2
        ]
        this.boundaries = boundaries;
        this.quadTree = quadTree;
        this.children = [];
        this.geomErrorTree = undefined;
    }

    /**
     * Attach an geom error tree to the bintree
     * @param {Array.<Object>} errorTree 
     */
    setGeomErrorTree = (errorTree) => {
        this.clear()
        this.geomErrorTree = errorTree;
    }

    /**
     * Return the root of the attached geom error tree at the index
     * @param {number} index 
     * @returns
     */
    getGeomErrorRootNode = (index) => {
        if (this.geomErrorTree && this.geomErrorTree.length > index) {
            return this.geomErrorTree[index];
        }
        return undefined;
    }

    /**
     * Update the bintree with the new camera parameters and initialize the roots if necessary.
     * Based on the parameters, either a depth first recursive update is executed or a breadth first dynamic update that can stop preliminary
     * @param {Camera} camera 
     * @param {boolean} cameraHasChanged 
     */
    update = (camera, cameraHasChanged) => {
        if (this.children.length == 0) {
            this.children = [];
            let xLength = Math.abs(this.boundaries[0] - this.boundaries[2]);
            let yLength = Math.abs(this.boundaries[1] - this.boundaries[3]);

            if (xLength >= yLength) {
                let nrOfMblocks = xLength / yLength;
                for (let i = 0; i < nrOfMblocks; i++) {
                    let center = [
                        this.boundaries[0] + (i + 0.5) * yLength,
                        this.boundaries[1] + 0.5 * yLength
                    ]
                    if (i % 2 == 0) {
                        this.children.push(new BinTreeNode(this.raster, BinTreeNode.TOPLEFT, undefined, center, yLength, 0, this.quadTree.roots[i], [0, 0], this.getGeomErrorRootNode(i * 2)));
                        this.children.push(new BinTreeNode(this.raster, BinTreeNode.BOTTOMRIGHT, undefined, center, yLength, 0, this.quadTree.roots[i], [0, 0], this.getGeomErrorRootNode(i * 2 + 1)));
                    } else {
                        this.children.push(new BinTreeNode(this.raster, BinTreeNode.BOTTOMLEFT, undefined, center, yLength, 0, this.quadTree.roots[i], [0, 0], this.getGeomErrorRootNode(i * 2)));
                        this.children.push(new BinTreeNode(this.raster, BinTreeNode.TOPRIGHT, undefined, center, yLength, 0, this.quadTree.roots[i], [0, 0], this.getGeomErrorRootNode(i * 2 + 1)));
                    }
                }
            } else {
                let nrOfMblocks = yLength / xLength;
                for (let i = 0; i < nrOfMblocks; i++) {
                    let center = [
                        this.boundaries[0] + 0.5 * xLength,
                        this.boundaries[0] + (i + 0.5) * xLength
                    ]
                    if (i % 2 == 0) {
                        this.children.push(new BinTreeNode(this.raster, BinTreeNode.BOTTOMLEFT, undefined, center, xLength, 0, this.quadTree.roots[i], [0, 0], this.getGeomErrorRootNode(i * 2)));
                        this.children.push(new BinTreeNode(this.raster, BinTreeNode.TOPRIGHT, undefined, center, xLength, 0, this.quadTree.roots[i], [0, 0], this.getGeomErrorRootNode(i * 2 + 1)));
                    } else {
                        this.children.push(new BinTreeNode(this.raster, BinTreeNode.TOPLEFT, undefined, center, xLength, 0, this.quadTree.roots[i], [0, 0], this.getGeomErrorRootNode(i * 2)));
                        this.children.push(new BinTreeNode(this.raster, BinTreeNode.BOTTOMRIGHT, undefined, center, xLength, 0, this.quadTree.roots[i], [0, 0], this.getGeomErrorRootNode(i * 2 + 1)));
                    }
                }
            }
        }

        if (this.raster.getParameters().dynamicBinTreeUpdate) {
            this.dynamicUpdate(camera, cameraHasChanged);
        } else {
            this.recursiveUpdate(camera);
        }
    }

    /**
     * Depth first update of the bintree
     * Use @see update
     * @param {Camera} camera 
     */
    recursiveUpdate = (camera) => {
        this.children.forEach(child => child.recursiveEvaluate(camera));
    }

    /**
     * Breadth first update of the bintree that stops early if too much mblocks are missing
     * Use @see update
     * @param {Camera} camera 
     * @param {boolean} cameraHasChanged 
     */
    dynamicUpdate = (camera, cameraHasChanged) => {
        let toEvaluate = [];
        let currentMblockLod = 0;
        let endNodesReady = 0;
        let endNodesNotReady = 0;

        this.children.forEach(child => toEvaluate.push(child));
        while(toEvaluate.length > 0) {
            let current = toEvaluate.shift();

            // A new new depth has been reached in the quadtree, check if we stop here
            // to allow a quicker terrain load with lower LoD during movement
            if (current.mblock.lod !== currentMblockLod) {

                // Based on the ratio between currently ready mblocks and not ready ones.
                // Only apply if the number of rendered mblocks would not differ too much to avoid the pop in of low resolution textures
                if (cameraHasChanged && this.quadTree.futureList.size / this.quadTree.renderList.size > this.raster.getParameters().dynamicBinTreeUpdateTreeLengthRatio) {
                    let nrNotReadyBlocks = 0;
                    let iterator = this.quadTree.futureList.first;
                    while (iterator) {
                        if (!iterator.isReady()) {
                            nrNotReadyBlocks++;
                        }

                        iterator = iterator.futureNext;
                    }
                    if (nrNotReadyBlocks / this.quadTree.futureList.size > this.raster.getParameters().dynamicBinTreeUpdateNotReadyRatio) {
                        break;
                    }
                }

                currentMblockLod = current.mblock.lod;
            }

            // Breadth first tree traversal
            let res = current.evaluate(camera);
            if (res.length > 0) {
               toEvaluate.push(...res);
            } else if (current.mblock.isReady()) {
                endNodesReady++;
            } else {
                endNodesNotReady++;
            }
        }
    }

    /**
     * Remove all references in the mBlock nodes, then delete the children
     */
    clear = () => {
        this.children.map(node => node.deactivate());
        this.children = [];
    }
}

export default BinTree;