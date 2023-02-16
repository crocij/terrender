import {Terrender, StandardInputHandler} from 'terrender-core';
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

    let terrender = new Terrender(gl, config, config.initialCamera);
    let inputHandler = new StandardInputHandler(terrender);

    // Setup Info UI
    const loadingDiv = document.querySelector('#loadingSpinner');

    // Setup legal notice
    const legalNotice = config.legalNotice || '';
    const legalNoticeDiv = document.querySelector('#legalNotice');
    legalNoticeDiv.innerHTML = legalNotice;
    
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
    });

    terrender.start();
}

fetch('config').then(res => {
    res.json().then(config => mainFunction(config));
})