const twgl = require('twgl.js');
const m4 = twgl.m4;
const v3 = twgl.v3;
const GeoTIFF = require('geotiff');
const fs = require('fs');

const TileBufferInfo = require('./TileBufferInfo');

class Tile {
    /**
     * 
     * @param {*} lod 
     * @param {*} xIndex 
     * @param {*} yIndex 
     * @param {object} config 
     */
    constructor(lod, xIndex, yIndex, config) {
        this.tileBufferInfo = TileBufferInfo.getTileBufferInfo(config, 257, 257, 1.0);
        this.config = config;
        this.lod = lod;
        this.xIndex = xIndex;
        this.yIndex = yIndex;
        this.tiffSource = config.heightAssetFolder + '/' + lod + '/' + xIndex + '/' + yIndex + '.tif';
        this.noHeightTexture = false;
        this.heightRawData = undefined;
    }

    loadHeightTiff = async () => {
        if (!this.heightRawData) {

            const fileExists = await fs.promises.access(this.tiffSource).then(() => true).catch(() => false);
            if (!fileExists) {
                this.noHeightTexture = true;
                return true;
            }
            const tiff = await GeoTIFF.fromFile(this.tiffSource);

            const image = await tiff.getImage();
            const metadata = image.getGDALMetadata() || {};
            const boundingBox = image.getBoundingBox();
            this.minHeight = metadata.STATISTICS_MINIMUM ? Number.parseFloat(metadata.STATISTICS_MINIMUM) : -100000.0;
            this.maxHeight = metadata.STATISTICS_MAXIMUM ? Number.parseFloat(metadata.STATISTICS_MAXIMUM) : 100000.0;
            this.realLifeSideLength = boundingBox[2] - boundingBox[0];

            const rasters = await tiff.readRasters();


            // Treat the float as 4 ints, reassemble float in shader
            this.heightRawData = rasters[0];
            this.heightRasterWidth = rasters.width;
            this.heightRasterHeight = rasters.height;
        }
        return true;
    }

    deleteData = () => {
        this.heightRawData = undefined;
    }

    getBounds = (binNode) => {
        if (this.noHeightTexture) {
            return [0,0];
        }
        return this.readHeight(binNode);
    }

    readHeight = (binNode) => {
        let buffer = this.tileBufferInfo.getTypeKPatchBuffer(binNode.type);
        let coordTransformationMatrix = binNode.coordTransformationMatrix;

        let max = -Number.MAX_VALUE;
        let min = Number.MAX_VALUE;

        buffer.indices.forEach(index => {
            // TODO: Numeric Stability
            let posX = buffer.vPlanarPosition[index * 2];
            let posY = buffer.vPlanarPosition[index * 2 + 1];
            let pos = m4.transformPoint(coordTransformationMatrix, [posX, posY, 0, 1]);
            posX = Math.floor((pos[0] + 0.5) * 256);
            posY = Math.floor((pos[1] + 0.5) * 256);
            if (posX > 256 || posY > 256 || posX < 0 || posY < 0) {
                console.log(posX + " " + posY);
            }
            let height = this.heightRawData[posX * this.heightRasterWidth + posY];

            // Make sure values are >= 0;
            max = Math.max(height, max, 0);
            min = Math.max(0, Math.min(height, min));
        })
        return [min, max];

    }
}

module.exports = Tile;