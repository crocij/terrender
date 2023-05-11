import { Terrender, StandardInputHandler } from 'terrender-core';
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
    config.errorCallback = (err) => { console.error(err) };

    const canvas = document.querySelector("#webGl");
    let gl = canvas.getContext('webgl2');
    let isWebGL2 = true;
    if (!gl) {
        gl = canvas.getContext('webgl');
        isWebGL2 = false;
    }

    let terrender = new Terrender(gl, config, config.initialCamera);
    let inputHandler = new StandardInputHandler(terrender);

    // Setup Info UI
    const loadingDiv = document.querySelector('#loadingSpinner');

    // Setup legal notice
    if (config.legalNotice) {
        const legalNoticeText = config.legalNotice.text || '';
        const legalNoticeURL = config.legalNotice.url;
        const legalNoticeDiv = document.querySelector('#legalNotice');
        if (legalNoticeURL) {
            let linkElem = document.createElement('a');
            linkElem.target = '_blank';
            linkElem.href = legalNoticeURL;
            linkElem.innerHTML = legalNoticeText;
            legalNoticeDiv.appendChild(linkElem)
        } else {
            legalNoticeDiv.innerHTML = legalNoticeText;
        }
    }

    // Setup line drawing
    const drawing = new Drawing(terrender);

    // Add UI Buttons
    let drawingConfigContainerDiv = document.querySelector('#drawingContainer');
    let enableDrawingButton = document.querySelector('#enableDrawing');
    enableDrawingButton.addEventListener('click', () => {
        inputHandler.setActive(!inputHandler.isActive());
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
        inputHandler.setTopDownMode(!inputHandler.isTopDownMode());
        if (inputHandler.isTopDownMode()) {
            topDownModeButton.innerHTML = 'Disable Top Down Mode';
        } else {
            topDownModeButton.innerHTML = 'Enable Top Down Mode';
        }
    })

    // Dolly Cam
    let dollyCam;
    if (config.dollyCam && config.dollyCam.length > 0) {
        dollyCam = new DollyCam(terrender, config.dollyCam);
    }


    terrender.setRenderLoopCallback((didDraw, swapped) => {
        didDraw && dollyCam && dollyCam.start();
        dollyCam && dollyCam.advance(swapped);

        loadingDiv.style.visibility = !terrender.getLoadingState().currentlyLoadingHeight && !terrender.getLoadingState().currentlyLoadingColor ? 'hidden' : 'visible'

        // Cam does not update but maybe lines change -> redraw lines
        if (drawing.isActive && (drawing.hasChanged() || didDraw)) {
            drawing.renderResult();
        }
    });
    terrender.setDrawCallback(() => {

        // Terrain has changed and line draw will not happen in general render loop callback
        if (!drawing.isActive) {
            drawing.renderResult();
        }
    });

    if (isWebGL2) {
        terrender.getGlInfo().recreateCombinedRenderTargets()
    } else {
        terrender.getGlInfo().recreateColorRenderTarget();
        terrender.getGlInfo().recreatePixelPosRenderTarget();
    }

    terrender.start();
}

fetch('config').then(res => {
    res.json().then(config => mainFunction(config));
})