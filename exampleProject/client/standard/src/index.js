import { Terrender, StandardInputHandler } from 'terrender-core';
import Chart from 'chart.js/auto';
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

    // Setup Config UI 
    let lodCheckbox = document.querySelector('#showLod')
    lodCheckbox.checked = terrender.getParameters().showLodAsColor;
    lodCheckbox.addEventListener('change', () => { terrender.getParameters().setParam('showLodAsColor', lodCheckbox.checked) })

    let renderGeometryCheckbox = document.querySelector('#renderGeometry')
    renderGeometryCheckbox.checked = terrender.getParameters().renderGeometry;
    renderGeometryCheckbox.addEventListener('change', () => { terrender.getParameters().setParam('renderGeometry', renderGeometryCheckbox.checked) })

    let renderKPatchLinesCheckbox = document.querySelector('#renderKPatchLines')
    renderKPatchLinesCheckbox.checked = terrender.getParameters().renderKPatchLines;
    renderKPatchLinesCheckbox.addEventListener('change', () => { terrender.getParameters().setParam('renderKPatchLines', renderKPatchLinesCheckbox.checked) })

    let renderFlatCheckbox = document.querySelector('#renderFlat')
    renderFlatCheckbox.checked = terrender.getParameters().renderFlat;
    renderFlatCheckbox.addEventListener('change', () => { terrender.getParameters().setParam('renderFlat', renderFlatCheckbox.checked) });

    let renderUniColorCheckbox = document.querySelector('#renderUniColor')
    renderUniColorCheckbox.checked = terrender.getParameters().renderUniColor;
    renderUniColorCheckbox.addEventListener('change', () => { terrender.getParameters().setParam('renderUniColor', renderUniColorCheckbox.checked) });

    let disableUpdateOnCamCheckbox = document.querySelector('#disableCamUpdate');
    disableUpdateOnCamCheckbox.checked = terrender.getParameters().disableUpdateOnCam;
    disableUpdateOnCamCheckbox.addEventListener('change', () => { terrender.getParameters().setParam('disableUpdateOnCam', disableUpdateOnCamCheckbox.checked) });

    let verticalExaggerationInput = document.querySelector('#verticalExaggeration');
    verticalExaggerationInput.value = terrender.getParameters().verticalExaggeration;
    verticalExaggerationInput.addEventListener('change', () => { terrender.getParameters().setParam('verticalExaggeration', verticalExaggerationInput.value) });

    // Setup Info UI
    const fpsDiv = document.querySelector('#fps');
    const vertexCounterDiv = document.querySelector('#vertexCount');
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

    // Setup Chart UI
    const loadingChartDiv = document.querySelector('#loadingChart');
    let loadingChart = new Chart(loadingChartDiv, {
        type: 'bar',
        data: {
            labels: ['Height', 'Color'],
            datasets: [{
                label: '# of Textures currently loading',
                data: [0, 0],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.2)',
                    'rgba(54, 162, 235, 0.2)',
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                ],
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    min: 0,
                    max: 150,
                }
            }
        }
    });
    const ramUsageChartDiv = document.querySelector('#ramUsageChart');
    let ramUsageChart = new Chart(ramUsageChartDiv, {
        type: 'doughnut',
        data: {
            labels: ['Rendering', 'Cached on GPU', 'Cached in RAM'],
            datasets: [
                {
                    label: 'Composition of tiles currently in RAM',
                    data: [0, 0, 0],
                    backgroundColor: [
                        'green',
                        'yellow',
                        'red',
                    ]
                }
            ]
        }
    })

    const gpuUsageChartDiv = document.querySelector('#gpuUsageChart');
    let gpuUsageChart = new Chart(gpuUsageChartDiv, {
        type: 'doughnut',
        data: {
            labels: ['Rendering', 'Caching on GPU'],
            datasets: [
                {
                    label: 'Composition of tiles currently in GPU memory',
                    data: [0, 0],
                    backgroundColor: [
                        'green',
                        'yellow',
                    ]
                }
            ]
        }
    })

    let getBinNodeChartsLabels = () => {
        let binNodeCounter = terrender.getCounters().getBinNodeCounter().getCounters();
        return binNodeCounter.map((val, index) => index != binNodeCounter.length - 1 ? 'Lod: ' + index : 'Total: ');
    }

    const binNodesChartDiv = document.querySelector('#binNodesChart');
    let binNodesChart = new Chart(binNodesChartDiv, {
        type: 'bar',
        data: {
            labels: getBinNodeChartsLabels(),
            datasets: [{
                label: '# of bintree nodes currently rendered',
                data: terrender.getCounters().getBinNodeCounter().getCounters(),
                borderWidth: 1,
                backgroundColor: [
                    'green',
                ]
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    min: 0,
                    max: 300,
                }
            }
        }
    });
    let prevBinNodeCountersLength = terrender.getCounters().getBinNodeCounter().getCounters().length;

    let getMblockChartsLabels = () => {
        let mblockCounter = terrender.getCounters().getMblockCounter().getCounters();
        return mblockCounter.map((val, index) => index != mblockCounter.length - 1 ? 'Lod: ' + index : 'Total: ');
    }

    const mBlocksChartDiv = document.querySelector('#mblocksChart');
    let mBlocksChart = new Chart(mBlocksChartDiv, {
        type: 'bar',
        data: {
            labels: getMblockChartsLabels(),
            datasets: [{
                label: '# of quadtree nodes currently rendered',
                data: terrender.getCounters().getMblockCounter().getCounters(),
                borderWidth: 1,
                backgroundColor: [
                    'green',
                ]
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    min: 0,
                    max: 150,
                }
            }
        }
    });

    // Setup line drawing
    const drawing = new Drawing(terrender);

    // Add UI Buttons
    const chartContainer = document.querySelector('#chartContainer');
    const controlContainer = document.querySelector('#controlContainer');

    let showChartsButton = document.querySelector('#showCharts');
    showChartsButton.addEventListener('click', () => {
        if (chartContainer.style.visibility !== 'hidden') {
            chartContainer.style.visibility = 'hidden';
            showChartsButton.innerHTML = 'Show Statistics';
        } else {
            chartContainer.style.visibility = 'visible';
            showChartsButton.innerHTML = 'Hide Statistics';
        }
    });

    let showControlsButton = document.querySelector('#showControls');
    showControlsButton.addEventListener('click', () => {
        if (controlContainer.style.visibility !== 'hidden') {
            controlContainer.style.visibility = 'hidden';
            showControlsButton.innerHTML = 'Show Settings';
        } else {
            controlContainer.style.visibility = 'visible';
            showControlsButton.innerHTML = 'Hide Settings';
        }
    });

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

    // UI Updates
    let updateMemoryUsageCharts = () => {
        ramUsageChart.data.datasets[0].data = [
            terrender.getQuadTree().renderList.size,
            terrender.getQuadTree().onGPUList.size,
            terrender.getQuadTree().onRAMList.size,
        ];
        ramUsageChart.update();

        gpuUsageChart.data.datasets[0].data = [
            terrender.getQuadTree().renderList.size,
            terrender.getQuadTree().onGPUList.size,
        ]
        gpuUsageChart.update();

        if (terrender.getCounters().getBinNodeCounter().getCounters().length != prevBinNodeCountersLength) {
            prevBinNodeCountersLength = terrender.getCounters().getBinNodeCounter().getCounters().length;
            binNodesChart.data.labels = getBinNodeChartsLabels();
        }
        binNodesChart.data.datasets[0].data = terrender.getCounters().getBinNodeCounter().getCounters();
        binNodesChart.update();

        mBlocksChart.data.datasets[0].data = terrender.getCounters().getMblockCounter().getCounters();
        mBlocksChart.update();
    }

    // Dolly Cam
    let dollyCam;
    if (config.dollyCam && config.dollyCam.length > 0) {
        dollyCam = new DollyCam(terrender, config.dollyCam);
    }

    terrender.setLoadingFinishedCallback(updateMemoryUsageCharts)
    terrender.setRenderLoopCallback((didDraw, swapped) => {
        didDraw && dollyCam && dollyCam.start();
        dollyCam && dollyCam.advance(swapped);

        fpsDiv.innerHTML = 'FPS: ' + terrender.fps;
        vertexCounterDiv.innerHTML = 'Vertices: ' + terrender.getCounters().getVertexCounter().vertices.toLocaleString();
        loadingChart.data.datasets[0].data = [terrender.getLoadingState().currentlyLoadingHeight, terrender.getLoadingState().currentlyLoadingColor];
        loadingChart.update();

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