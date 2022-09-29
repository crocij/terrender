import * as GeoTIFF from 'geotiff';

onmessage = (e) => {
    const tiff = GeoTIFF.fromArrayBuffer(e.data).then(tiff => {
        tiff.readRasters({interleave: true}).then(rasters => {
            let uint8 = new Uint8Array(rasters);
            postMessage(uint8.buffer, [uint8.buffer]);
        });
    });
}