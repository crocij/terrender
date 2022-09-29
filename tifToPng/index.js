const GeoTIFF = require('geotiff');
const Jimp = require('jimp');

/**
 * 
 * @param {string} path 
 */
let convert = async (path) => {
    const tiff = await GeoTIFF.fromFile(path);
    const rasters = await tiff.readRasters();
    let width = rasters.width;
    let height = rasters.height;
    let f32Arr = new Float32Array(rasters[0]);
    let u8Arr = new Uint8Array(f32Arr.buffer);
    let img = undefined;
    await (() => new Promise((resolve, reject) => {
        new Jimp({ data: u8Arr, width: width, height: height }, (err, image) => {
            if (err) {
                reject(err);
            }
            img = image;
            resolve(image);
        });
    }))();
    let pngPath = path.substring(0, path.length - 4)
    pngPath += '.png';
    await img.writeAsync(pngPath);
}

let filePath = process.argv[2];

if (filePath) {
    convert(filePath).then(res => {
        console.log('Converted: ' + filePath)
        process.exit(0)

    }).catch(err => {
        console.log('Failed to convert: ' + filePath);
        console.error(err)
        process.exit(1)
    })
};