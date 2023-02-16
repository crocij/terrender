import * as twgl from 'twgl.js';
const m4 = twgl.m4;

import BinTreeNode from '../BinTree/BinTreeNode.js';

let instance;

/**
 * Singleton containing the vertex buffers to render the different kinds of kPatches
 */
class TileBufferInfo {

    /**
     * Returns the tile buffer info singleton
     * @param {Terrender} terrender 
     * @param {Number} height Height of the mBlock
     * @param {Number} width Width of the mblock
     * @param {Number} sideLengthOS Side length of the mBlock in object space
     */
    static getTileBufferInfo = (terrender, height, width, sideLengthOS) => {
        if (!instance) {
            instance = new TileBufferInfo(terrender, height, width, sideLengthOS);
        }

        return instance;
    }

    /**
     * @constructor
     * @param {Terrender} terrender 
     * @param {Number} height Height of the mBlock
     * @param {Number} width Width of the mblock
     * @param {Number} sideLengthOS Side length of the mBlock in object space
     */
    constructor(terrender, height = 2000, width = 2000, sideLengthOS = 1.0) {
        this.terrender = terrender;
        this.height = height;
        this.width = width;
        this.kPatchBase = this.terrender.getParameters().kPatchBase;
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
    }

    /**
     * Recreates the buffers if the kPatchBase changed
     * @param {WebGLRenderingContext|WebGL2RenderingContext} gl 
     */
    recreateBuffers = (gl) => {
        if (this.kPatchBase == this.terrender.getParameters().kPatchBase) {
            return;
        }
        this.kPatchBase = this.terrender.getParameters().kPatchBase;

        // Delete old buffers and create new ones
        this.leftKPatchBufferInfo && gl.deleteBuffer(this.leftKPatchBufferInfo.indices);
        this.leftKPatchLinesBufferInfo && gl.deleteBuffer(this.leftKPatchLinesBufferInfo.indices);
        this.topLeftKPatchBufferInfo && gl.deleteBuffer(this.topLeftKPatchBufferInfo.indices);
        this.topLeftKPatchLinesBufferInfo && gl.deleteBuffer(this.topLeftKPatchLinesBufferInfo.indices);
        this.leftKPatchBufferInfo = undefined;
        this.leftKPatchLinesBufferInfo = undefined;
        this.topLeftKPatchBufferInfo = undefined;
        this.topLeftKPatchLinesBufferInfo = undefined;
        this.createLeftKPatchBufferInfo(gl);
        this.createLeftKPatchLinesBufferInfo(gl);
        this.createTopLeftKPatchBufferInfo(gl);
        this.createTopLeftKPatchLinesBufferInfo(gl);
    }

    /**
     * Creates the left buffer for the geom render mode (e.g. only the outline of the kPatch)
     * @param {WebGLRenderingContext|WebGL2RenderingContext} gl 
     */
    createLeftGeomBufferInfo = (gl) => {
        if (this.leftGeomBufferInfo) {
            return;
        }
        let vPlanarPosition = [
            -0.5, -0.5,
            0, 0,
            -0.5, 0.5,
        ]

        let indices = [
            0, 1, 2
        ]

        let fullArrays = {

            // Twgl does not understand that the first array buffer only has two components hence set it manually
            vPlanarPosition: { numComponents: 2, data: vPlanarPosition },

            // Create Uint32 array manually, else TWGL tries a short array
            indices: new Uint32Array(indices),
        }

        this.leftGeomBufferInfo = twgl.createBufferInfoFromArrays(gl, fullArrays);
    }

    /**
     * Creates the left kPatch buffer info if does not exist
     * @param {WebGLRenderingContext|WebGL2RenderingContext} gl 
     */
    createLeftKPatchBufferInfo = (gl) => {
        if (this.leftKPatchBufferInfo) {
            return;
        }

        let vPlanarPosition = [];
        let indices = [];

        let localSideLength = this.terrender.getParameters().kPatchBase * 2 - 1;

        // Note that for the kpatches with the hypotenuse on the border of the mblock the grid is double the size
        for (let y = 0; y < localSideLength; y++) {
            for (let x = 0; x < localSideLength; x++) {

                // x Part
                vPlanarPosition.push((x * this.sideLengthOS / (localSideLength - 1)) - (this.sideLengthOS / 2));

                // y Part
                vPlanarPosition.push((y * this.sideLengthOS / (localSideLength - 1)) - (this.sideLengthOS / 2));
            }
        }

        for (let y = 0; y < this.terrender.getParameters().kPatchBase - 1; y++) {

            let widthLimit = y - ((this.terrender.getParameters().kPatchBase - 1) / 2) < 0 ? y + 1 : this.terrender.getParameters().kPatchBase - y - 1;

            for (let x = 0; x < widthLimit; x++) {

                // Single Split Triangle on the lower part of the patch on the Hypothenuse
                if (x == widthLimit - 1 && y < (this.terrender.getParameters().kPatchBase - 1) / 2) {

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
                } else if (x == widthLimit - 1) { // Single Split Triangle on the upper part of the patch on the Hypothenuse

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
            vPlanarPosition: { numComponents: 2, data: vPlanarPosition },

            // Create Uint32 array manually, else TWGL tries a short array
            indices: new Uint32Array(indices),
        }

        this.leftKPatchBufferInfo = twgl.createBufferInfoFromArrays(gl, fullArrays);
    }

    /**
     * Creates the left kPatch buffer info if does not exist for rendering in line mode
     * @param {WebGLRenderingContext|WebGL2RenderingContext} gl 
     */
    createLeftKPatchLinesBufferInfo = (gl) => {
        if (this.leftKPatchLinesBufferInfo) {
            return;
        }

        let vPlanarPosition = [];
        let indices = [];

        let localSideLength = this.terrender.getParameters().kPatchBase * 2 - 1;

        // Note that for the kPatches with the hypotenuse on the border of the mblock the grid is double the size
        for (let y = 0; y < localSideLength; y++) {
            for (let x = 0; x < localSideLength; x++) {

                // x Part
                vPlanarPosition.push((x * this.sideLengthOS / (localSideLength - 1)) - (this.sideLengthOS / 2));

                // y Part
                vPlanarPosition.push((y * this.sideLengthOS / (localSideLength - 1)) - (this.sideLengthOS / 2));
            }
        }

        for (let y = 0; y < this.terrender.getParameters().kPatchBase - 1; y++) {

            let widthLimit = y - ((this.terrender.getParameters().kPatchBase - 1) / 2) < 0 ? y + 1 : this.terrender.getParameters().kPatchBase - y - 1;

            for (let x = 0; x < widthLimit; x++) {

                // Single Split Triangle on the lower part of the patch on the Hypothenuse
                if (x == widthLimit - 1 && y < (this.terrender.getParameters().kPatchBase - 1) / 2) {
                    indices.push(

                        // Lower Left Point - Upper Left Point
                        x * 2 + y * 2 * localSideLength,
                        x * 2 + (y + 1) * 2 * localSideLength,

                        // Upper Right Point - Middle Point
                        (x + 1) * 2 + (y + 1) * 2 * localSideLength,
                        x * 2 + 1 + y * 2 * localSideLength + localSideLength,

                        // Middle Point - Upper Left Point
                        x * 2 + 1 + y * 2 * localSideLength + localSideLength,
                        x * 2 + (y + 1) * 2 * localSideLength,

                        // Middle Point - Lower Left Point
                        x * 2 + 1 + y * 2 * localSideLength + localSideLength,
                        x * 2 + y * 2 * localSideLength,
                    )

                } else if (x == widthLimit - 1) { // Single Split Triangle on the upper part of the patch on the hypotenuse
                    indices.push(

                        // Lower Left Point - Lower Right Point
                        x * 2 + y * 2 * localSideLength,
                        (x + 1) * 2 + y * 2 * localSideLength,

                        // Lower Right Point - Middle Point
                        (x + 1) * 2 + y * 2 * localSideLength,
                        x * 2 + 1 + y * 2 * localSideLength + localSideLength,

                        // Middle Point - Lower Left Point
                        x * 2 + 1 + y * 2 * localSideLength + localSideLength,
                        x * 2 + y * 2 * localSideLength,

                        // Middle Point -  Upper Left Point
                        x * 2 + 1 + y * 2 * localSideLength + localSideLength,
                        x * 2 + (y + 1) * 2 * localSideLength,

                        // Lower Left Point - Upper Left Point
                        x * 2 + y * 2 * localSideLength,
                        x * 2 + (y + 1) * 2 * localSideLength,
                    )
                } else { // Normal square consisting of 4 triangles
                    indices.push(

                        // Lower Left Point - Upper Left Point
                        x * 2 + y * 2 * localSideLength,
                        x * 2 + (y + 1) * 2 * localSideLength,

                        // Lower Left Point - Lower Right Point
                        x * 2 + y * 2 * localSideLength,
                        (x + 1) * 2 + y * 2 * localSideLength,

                        // Lower Right Point - Middle Point
                        (x + 1) * 2 + y * 2 * localSideLength,
                        x * 2 + 1 + y * 2 * localSideLength + localSideLength,

                        // Middle Point - Lower Left Point
                        x * 2 + 1 + y * 2 * localSideLength + localSideLength,
                        x * 2 + y * 2 * localSideLength,

                        // Middle Point -  Upper Left Point
                        x * 2 + 1 + y * 2 * localSideLength + localSideLength,
                        x * 2 + (y + 1) * 2 * localSideLength,

                        // Upper Right Point - Middle Point
                        (x + 1) * 2 + (y + 1) * 2 * localSideLength,
                        x * 2 + 1 + y * 2 * localSideLength + localSideLength,
                    )
                }
            }
        }

        let fullArrays = {

            // Twgl does not understand that the first array buffer only has two components hence set it manually
            vPlanarPosition: { numComponents: 2, data: vPlanarPosition },

            // Create Uint32 array manually, else TWGL tries a short array
            indices: new Uint32Array(indices),
        }

        this.leftKPatchLinesBufferInfo = twgl.createBufferInfoFromArrays(gl, fullArrays);
    }
    /**
     * Creates the top left buffer for the geom render mode (e.g. only the outline of the kPatch)
     * @param {WebGLRenderingContext|WebGL2RenderingContext} gl 
     */
    createTopLeftGeomBufferInfo = (gl) => {
        if (this.topLeftGeomBufferInfo) {
            return;
        }
        let vPlanarPosition = [
            -0.5, -0.5,
            -0.5, 0.5,
            0.5, 0.5,
        ]

        let indices = [
            0, 1, 2
        ]

        let fullArrays = {

            // Twgl does not understand that the first array buffer only has two components hence set it manually
            vPlanarPosition: { numComponents: 2, data: vPlanarPosition },

            // Create Uint32 array manually, else TWGL tries a short array
            indices: new Uint32Array(indices),
        }

        this.topLeftGeomBufferInfo = twgl.createBufferInfoFromArrays(gl, fullArrays);
    }

    /**
     * Creates the top left kPatch buffer info if does not exist
     * @param {WebGLRenderingContext|WebGL2RenderingContext} gl 
     */
    createTopLeftKPatchBufferInfo = (gl) => {
        if (this.topLeftKPatchBufferInfo) {
            return;
        }

        let vPlanarPosition = [];
        let indices = [];

        for (let y = 0; y < this.terrender.getParameters().kPatchBase; y++) {
            for (let x = 0; x < this.terrender.getParameters().kPatchBase; x++) {

                // x Part
                vPlanarPosition.push((x * this.sideLengthOS / (this.terrender.getParameters().kPatchBase - 1)) - (this.sideLengthOS / 2));

                // y Part
                vPlanarPosition.push((y * this.sideLengthOS / (this.terrender.getParameters().kPatchBase - 1)) - (this.sideLengthOS / 2));
            }
        }

        for (let y = 0; y < this.terrender.getParameters().kPatchBase - 1; y++) {
            for (let x = 0; x < y + 1; x++) {

                // Single Triangle on the hypotenuse of the patch
                if (x == y) {
                    indices.push(
                        // lower Point
                        x + y * this.terrender.getParameters().kPatchBase,

                        // Upper Right Point
                        x + 1 + (y + 1) * this.terrender.getParameters().kPatchBase,

                        // Upper Left Point
                        x + (y + 1) * this.terrender.getParameters().kPatchBase,
                    )
                } else if (x % 2 == y % 2) { // Diagonal from bottom left to top right

                    // Upper Left Triangle
                    indices.push(
                        // lower left Point
                        x + y * this.terrender.getParameters().kPatchBase,

                        // Upper Right Point
                        x + 1 + (y + 1) * this.terrender.getParameters().kPatchBase,

                        // Upper Left Point
                        x + (y + 1) * this.terrender.getParameters().kPatchBase,
                    )

                    // Lower Right Triangle
                    indices.push(
                        // lower left Point
                        x + y * this.terrender.getParameters().kPatchBase,

                        // lower right Point
                        x + 1 + y * this.terrender.getParameters().kPatchBase,

                        // upper right Point
                        x + 1 + (y + 1) * this.terrender.getParameters().kPatchBase,
                    )
                } else { // Diagonal from top left to bottom right

                    // Lower left triangle
                    indices.push(
                        // lower left Point
                        x + y * this.terrender.getParameters().kPatchBase,

                        // lower right Point
                        x + 1 + y * this.terrender.getParameters().kPatchBase,

                        // Upper Left Point
                        x + (y + 1) * this.terrender.getParameters().kPatchBase,
                    )

                    // Upper Right Triangle
                    indices.push(
                        // lower right Point
                        x + 1 + y * this.terrender.getParameters().kPatchBase,

                        // upper right Point
                        x + 1 + (y + 1) * this.terrender.getParameters().kPatchBase,

                        // Upper Left Point
                        x + (y + 1) * this.terrender.getParameters().kPatchBase,
                    )
                }
            }
        }

        let fullArrays = {

            // Twgl does not understand that the first array buffer only has two components hence set it manually
            vPlanarPosition: { numComponents: 2, data: vPlanarPosition },

            // Create Uint32 array manually, else TWGL tries a short array
            indices: new Uint32Array(indices),
        }

        this.topLeftKPatchBufferInfo = twgl.createBufferInfoFromArrays(gl, fullArrays);
    }

    /**
     * Creates the top left kPatch buffer info if does not exist for rendering in line mode
     * @param {WebGLRenderingContext|WebGL2RenderingContext} gl 
     */
    createTopLeftKPatchLinesBufferInfo = (gl) => {
        if (this.topLeftKPatchLinesBufferInfo) {
            return;
        }

        let vPlanarPosition = [];
        let indices = [];

        for (let y = 0; y < this.terrender.getParameters().kPatchBase; y++) {
            for (let x = 0; x < this.terrender.getParameters().kPatchBase; x++) {

                // x Part
                vPlanarPosition.push((x * this.sideLengthOS / (this.terrender.getParameters().kPatchBase - 1)) - (this.sideLengthOS / 2));

                // y Part
                vPlanarPosition.push((y * this.sideLengthOS / (this.terrender.getParameters().kPatchBase - 1)) - (this.sideLengthOS / 2));
            }
        }

        for (let y = 0; y < this.terrender.getParameters().kPatchBase - 1; y++) {
            for (let x = 0; x < y + 1; x++) {

                // Single Triangle on the hypotenuse of the patch
                if (x == y) {
                    indices.push(

                        // lower Left Point - Upper Right Point
                        x + y * this.terrender.getParameters().kPatchBase,
                        x + 1 + (y + 1) * this.terrender.getParameters().kPatchBase,

                        // lower Left Point - Upper Left Point
                        x + y * this.terrender.getParameters().kPatchBase,
                        x + (y + 1) * this.terrender.getParameters().kPatchBase,

                        // Upper Left Point - Upper Right Point
                        x + (y + 1) * this.terrender.getParameters().kPatchBase,
                        x + 1 + (y + 1) * this.terrender.getParameters().kPatchBase,
                    )
                } else if (x % 2 == y % 2) { // Diagonal from bottom left to top right
                    indices.push(
                        
                        // lower Left Point - Upper Right Point
                        x + y * this.terrender.getParameters().kPatchBase,
                        x + 1 + (y + 1) * this.terrender.getParameters().kPatchBase,

                        // lower Left Point - Upper Left Point
                        x + y * this.terrender.getParameters().kPatchBase,
                        x + (y + 1) * this.terrender.getParameters().kPatchBase,

                        // Upper Left Point - Upper Right Point
                        x + (y + 1) * this.terrender.getParameters().kPatchBase,
                        x + 1 + (y + 1) * this.terrender.getParameters().kPatchBase,
                    )
                } else { // Diagonal from top left to bottom right
                    indices.push(

                        // lower left Point - Upper Left Point
                        x + y * this.terrender.getParameters().kPatchBase,
                        x + (y + 1) * this.terrender.getParameters().kPatchBase,

                        // upper right Point - Upper Left Point
                        x + 1 + (y + 1) * this.terrender.getParameters().kPatchBase,
                        x + (y + 1) * this.terrender.getParameters().kPatchBase,

                        // lower right Point - Upper Left Point
                        x + 1 + y * this.terrender.getParameters().kPatchBase,
                        x + (y + 1) * this.terrender.getParameters().kPatchBase,
                    )
                }
            }
        }

        let fullArrays = {

            // Twgl does not understand that the first array buffer only has two components hence set it manually
            vPlanarPosition: { numComponents: 2, data: vPlanarPosition },

            // Create Uint32 array manually, else TWGL tries a short array
            indices: new Uint32Array(indices),
        }

        this.topLeftKPatchLinesBufferInfo = twgl.createBufferInfoFromArrays(gl, fullArrays);
    }

    /**
     * Create the required vertex buffers
     * @param {WebGLRenderingContext|WebGL2RenderingContext} gl 
     */
    createBufferInfo = (gl) => {
        this.createLeftGeomBufferInfo(gl);
        this.createLeftKPatchLinesBufferInfo(gl);
        this.createLeftKPatchBufferInfo(gl);

        this.createTopLeftGeomBufferInfo(gl);
        this.createTopLeftKPatchLinesBufferInfo(gl);
        this.createTopLeftKPatchBufferInfo(gl);
    }

    /**
     * Get the appropriate geom buffer for the specified kPatch type
     * @param {Number} type 
     * @returns {twgl.BufferInfo}
     */
    getTypeGeoBuffer = (type) => {
        type = Number.parseInt(type);
        switch (type) {
            case BinTreeNode.LEFT:
            case BinTreeNode.TOP:
            case BinTreeNode.RIGHT:
            case BinTreeNode.BOTTOM:
                return this.leftGeomBufferInfo;
            case BinTreeNode.TOPLEFT:
            case BinTreeNode.TOPRIGHT:
            case BinTreeNode.BOTTOMRIGHT:
            case BinTreeNode.BOTTOMLEFT:
                return this.topLeftGeomBufferInfo;
            default:
                console.error("Unknown Type: " + type);
        }
    }

    /**
     * Get the appropriate buffer for the specified kPatch type
     * @param {Number} type 
     * @returns {twgl.BufferInfo}
     */
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
    
    /**
     * Get the appropriate line buffer for the specified kPatch type
     * @param {Number} type 
     * @returns {twgl.BufferInfo}
     */
    getTypeKPatchLinesBuffer = (type) => {
        type = Number.parseInt(type);
        switch (type) {
            case BinTreeNode.LEFT:
            case BinTreeNode.TOP:
            case BinTreeNode.RIGHT:
            case BinTreeNode.BOTTOM:
                return this.leftKPatchLinesBufferInfo;
            case BinTreeNode.TOPLEFT:
            case BinTreeNode.TOPRIGHT:
            case BinTreeNode.BOTTOMRIGHT:
            case BinTreeNode.BOTTOMLEFT:
                return this.topLeftKPatchLinesBufferInfo;
            default:
                console.error("Unknown Type: " + type);
        }
    }
}

export default TileBufferInfo;