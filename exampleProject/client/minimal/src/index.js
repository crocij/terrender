import Raster from 'raster-core';
import Drawing from '../../common/Drawing';
import DollyCam from '../../common/DollyCam';

let mainFunction = (config) => {

    // FIX for ios devices regarding canvas height
    let resizeCallback = () => {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', vh + 'px');
    }

    window.addEventListener('resize', resizeCallback);
    resizeCallback();

    config.getGeomErrorSlug = (lod, kPatchBase) => 'geom/' + lod + '/' + kPatchBase;
    config.errorCallback = (err) => {console.error(err)};
    
    const canvas = document.querySelector("#webGl");
    let gl = canvas.getContext('webgl2');
    let isWebGL2 = true;
    if (!gl) {
        gl = canvas.getContext('webgl');
        isWebGL2 = false;
    }

    let raster = new Raster(gl, config, config.initialCamera);

    // Setup Info UI
    const loadingDiv = document.querySelector('#loadingSpinner');

    // Setup line drawing
    const drawing = new Drawing(raster);

    // Add UI Buttons
    let drawingConfigContainerDiv = document.querySelector('#drawingContainer');
    let enableDrawingButton = document.querySelector('#enableDrawing');
    enableDrawingButton.addEventListener('click', () => {
        raster.getCamera().setControlActive(!raster.getCamera().isControlActive());
        drawing.setActive(!drawing.isActive);
        drawingConfigContainerDiv.style.visibility = drawing.isActive ? 'visible' : 'hidden';
        if (drawing.isActive) {
            enableDrawingButton.innerHTML = 'Disable Drawing';
        } else {
            enableDrawingButton.innerHTML = 'Enable Drawing';
        }
    });

    let topDownModeButton = document.querySelector('#topDownMode');
    topDownModeButton.addEventListener('click', () => {
        raster.getCamera().setTopDownMode(!raster.getCamera().isTopDownMode());
        if (raster.getCamera().isTopDownMode()) {
            topDownModeButton.innerHTML = 'Disable Top Down Mode';
        } else {
            topDownModeButton.innerHTML = 'Enable Top Down Mode';
        }
    })

    // Dolly Cam
    let dollyCam;
    if (config.dollyCam && config.dollyCam.length > 0) {
        dollyCam = new DollyCam(raster, config.dollyCam);
    }


    raster.setRenderLoopCallback((didDraw, swapped) => {
        didDraw && dollyCam && dollyCam.start();
        dollyCam && dollyCam.advance(swapped);

        loadingDiv.style.visibility = !raster.getLoadingState().currentlyLoadingHeight && !raster.getLoadingState().currentlyLoadingColor ? 'hidden' : 'visible'

        // Cam does not update but maybe lines change -> redraw lines
        if (drawing.isActive && (drawing.hasChanged() || didDraw)) {
            drawing.renderResult();
        }
    });
    raster.setDrawCallback(() => {

        // Terrain has changed and line draw will not happen in general render loop callback
        if (!drawing.isActive) {
            drawing.renderResult();
        }
    });

    if (isWebGL2) {
        raster.getGlInfo().recreateCombinedRenderTargets()
    } else {
        raster.getGlInfo().recreateColorRenderTarget();
        raster.getGlInfo().recreatePixelPosRenderTarget();
    }

    raster.start();
}

fetch('config').then(res => {
    res.json().then(config => mainFunction(config));
})