const twgl = require('twgl.js');
const m4 = twgl.m4;

const BinTreeNode = require('../BinTree/BinTreeNode.js');

let instance;

class TileBufferInfo {

    /**
     * 
     * @param {config} config 
     */
    static getTileBufferInfo = (config, height, width, sideLengthOS) => {
        if (!instance) {
            instance = new TileBufferInfo(config, height, width, sideLengthOS);
        }

        return instance;
    }

    /**
     * 
     * @param {config} config 
     * @param {*} height 
     * @param {*} width 
     * @param {*} sideLengthOS 
     */
    constructor(config, height = 2000, width = 2000, sideLengthOS = 1.0) {
        this.config = config;
        this.height = height;
        this.width = width;
        this.kPatchBase = this.config.kPatchBase;
        this.sideLengthOS = sideLengthOS;
        this.fullBufferInfo = undefined;
        this.quarterBufferInfo = undefined;
        this.quarterVertexCount = 0;
        this.wholeVertexCount = 0;
        this.rotationMatrices = [
            m4.rotationZ(0),
            m4.rotationZ(-Math.PI * 0.5),
            m4.rotationZ(-Math.PI),
            m4.rotationZ(-Math.PI * 1.5),
        ];
        this.createBufferInfo();
    }

    createLeftKPatchBufferInfo = () => {
        if (this.leftKPatchBufferInfo) {
            return;
        }

        let vPlanarPosition = [];
        let indices = [];

        let localSideLength = this.config.kPatchBase * 2 - 1;

        // Note that for the kpatches with the hypotenuse on the border of the mblock the grid is double the size
        for (let y = 0; y < localSideLength; y++) {
            for (let x = 0; x < localSideLength; x++) {

                // x Part
                vPlanarPosition.push((x * this.sideLengthOS / (localSideLength - 1)) - (this.sideLengthOS / 2));

                // y Part
                vPlanarPosition.push((y * this.sideLengthOS / (localSideLength - 1)) - (this.sideLengthOS / 2));
            }
        }

        for (let y = 0; y < this.config.kPatchBase - 1; y++) {

            let widthLimit = y - ((this.config.kPatchBase - 1) / 2) < 0 ? y + 1 : this.config.kPatchBase - y - 1;

            for (let x = 0; x < widthLimit; x++) {

                // Single Split Triangle on the lower part of the patch on the hypotenuse
                if (x == widthLimit - 1 && y < (this.config.kPatchBase - 1) / 2) {

                    // Left Triangle
                    indices.push(

                        // Lower Left Point
                        x * 2 + y * 2 * localSideLength,

                        // Middle Point,
                        x * 2 + 1 + y * 2 * localSideLength + localSideLength,

                        // Upper Left Point
                        x * 2 + (y + 1) * 2 * localSideLength,
                    );

                    // Top Triangle
                    indices.push(

                        // Middle Point,
                        x * 2 + 1 + y * 2 * localSideLength + localSideLength,

                        // Upper Right Point
                        (x + 1) * 2 + (y + 1) * 2 * localSideLength,

                        // Upper Left Point
                        x * 2 + (y + 1) * 2 * localSideLength,
                    )
                } else if (x == widthLimit - 1) { // Single Split Triangle on the upper part of the patch on the hypotenuse

                    // Bottom Triangle
                    indices.push(

                        // Lower Left Point
                        x * 2 + y * 2 * localSideLength,

                        // Lower Right Point
                        (x + 1) * 2 + y * 2 * localSideLength,

                        // Middle Point,
                        x * 2 + 1 + y * 2 * localSideLength + localSideLength,
                    )

                    // Left Triangle
                    indices.push(

                        // Lower Left Point
                        x * 2 + y * 2 * localSideLength,

                        // Middle Point,
                        x * 2 + 1 + y * 2 * localSideLength + localSideLength,

                        // Upper Left Point
                        x * 2 + (y + 1) * 2 * localSideLength,
                    );
                } else { // Normal square consisting of 4 triangles

                    // Left Triangle
                    indices.push(

                        // Lower Left Point
                        x * 2 + y * 2 * localSideLength,

                        // Middle Point,
                        x * 2 + 1 + y * 2 * localSideLength + localSideLength,

                        // Upper Left Point
                        x * 2 + (y + 1) * 2 * localSideLength,
                    );

                    // Right Triangle
                    indices.push(
                        
                        // Lower Right Point
                        (x + 1) * 2 + y * 2 * localSideLength,

                        // Upper Right Point
                        (x + 1) * 2 + (y + 1) * 2 * localSideLength,

                        // Middle Point,
                        x * 2 + 1 + y * 2 * localSideLength + localSideLength,
                    )

                    // Top Triangle
                    indices.push(

                        // Middle Point,
                        x * 2 + 1 + y * 2 * localSideLength + localSideLength,

                        // Upper Right Point
                        (x + 1) * 2 + (y + 1) * 2 * localSideLength,

                        // Upper Left Point
                        x * 2 + (y + 1) * 2 * localSideLength,
                    )

                    // Bottom Triangle
                    indices.push(

                        // Lower Left Point
                        x * 2 + y * 2 * localSideLength,

                        // Lower Right Point
                        (x + 1) * 2 + y * 2 * localSideLength,

                        // Middle Point,
                        x * 2 + 1 + y * 2 * localSideLength + localSideLength,
                    )
                }
            }
        }

        let fullArrays = {

            // Twgl does not understand that the first array buffer only has two components hence set it manually
            vPlanarPosition: vPlanarPosition,

            // Create Uint32 array manually, else TWGL tries a short array
            indices: new Uint32Array(indices),
        }

        this.leftKPatchBufferInfo = fullArrays;
    }

    createTopLeftKPatchBufferInfo = () => {
        if (this.topLeftKPatchBufferInfo) {
            return;
        }

        let vPlanarPosition = [];
        let indices = [];

        for (let y = 0; y < this.config.kPatchBase; y++) {
            for (let x = 0; x < this.config.kPatchBase; x++) {

                // x Part
                vPlanarPosition.push((x * this.sideLengthOS / (this.config.kPatchBase - 1)) - (this.sideLengthOS / 2));

                // y Part
                vPlanarPosition.push((y * this.sideLengthOS / (this.config.kPatchBase - 1)) - (this.sideLengthOS / 2));
            }
        }

        for (let y = 0; y < this.config.kPatchBase - 1; y++) {
            for (let x = 0; x < y + 1; x++) {

                // Single Triangle on the hypotenuse of the patch
                if (x == y) {
                    indices.push(
                        // lower Point
                        x + y * this.config.kPatchBase,

                        // Upper Right Point
                        x + 1 + (y + 1) * this.config.kPatchBase,

                        // Upper Left Point
                        x + (y + 1) * this.config.kPatchBase,
                    )
                } else if (x % 2 == y % 2) { // Diagonal from bottom left to top right

                    // Upper Left Triangle
                    indices.push(
                        // lower left Point
                        x + y * this.config.kPatchBase,

                        // Upper Right Point
                        x + 1 + (y + 1) * this.config.kPatchBase,

                        // Upper Left Point
                        x + (y + 1) * this.config.kPatchBase,
                    )

                    // Lower Right Triangle
                    indices.push(
                        // lower left Point
                        x + y * this.config.kPatchBase,

                        // lower right Point
                        x + 1 + y * this.config.kPatchBase,

                        // upper right Point
                        x + 1 + (y + 1) * this.config.kPatchBase,
                    )
                } else { // Diagonal from top left to bottom right

                    // Lower left triangle
                    indices.push(
                        // lower left Point
                        x + y * this.config.kPatchBase,

                        // lower right Point
                        x + 1 + y * this.config.kPatchBase,

                        // Upper Left Point
                        x + (y + 1) * this.config.kPatchBase,
                    )

                    // Upper Right Triangle
                    indices.push(
                        // lower right Point
                        x + 1 + y * this.config.kPatchBase,

                        // upper right Point
                        x + 1 + (y + 1) * this.config.kPatchBase,

                        // Upper Left Point
                        x + (y + 1) * this.config.kPatchBase,
                    )
                }
            }
        }

        let fullArrays = {

            // Twgl does not understand that the first array buffer only has two components hence set it manually
            vPlanarPosition: vPlanarPosition,

            // Create Uint32 array manually, else TWGL tries a short array
            indices: new Uint32Array(indices),
        }

        this.topLeftKPatchBufferInfo = fullArrays;

    }

    createBufferInfo = () => {
        this.createLeftKPatchBufferInfo();
        this.createTopLeftKPatchBufferInfo();
    }

    getTypeKPatchBuffer = (type) => {
        type = Number.parseInt(type);
        switch (type) {
            case BinTreeNode.LEFT:
            case BinTreeNode.TOP:
            case BinTreeNode.RIGHT:
            case BinTreeNode.BOTTOM:
                return this.leftKPatchBufferInfo;
            case BinTreeNode.TOPLEFT:
            case BinTreeNode.TOPRIGHT:
            case BinTreeNode.BOTTOMRIGHT:
            case BinTreeNode.BOTTOMLEFT:
                return this.topLeftKPatchBufferInfo;
            default:
                console.error("Unknown Type: " + type);
        }
    }
}

module.exports = TileBufferInfo;