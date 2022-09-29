import * as GeoTIFF from 'geotiff';

onmessage = (e) => {
    const tiff = GeoTIFF.fromArrayBuffer(e.data).then(tiff => {
        tiff.readRasters().then(rasters => {
            tiff.getImage().then(image => {
                let f32Arr = image.getBytesPerPixel() !== 4 ? new Float32Array(rasters[0]) : rasters[0];
                postMessage(f32Arr.buffer, [f32Arr.buffer]);
            });
        });
    });
}

