import { Raster, StandardInputHandler } from 'raster-core';
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

    let raster = new Raster(gl, config, config.initialCamera);
    let inputHandler = new StandardInputHandler(raster);

    // Setup Config UI 
    let lodCheckbox = document.querySelector('#showLod')
    lodCheckbox.checked = raster.getParameters().showLodAsColor;
    lodCheckbox.addEventListener('change', () => { raster.getParameters().setParam('showLodAsColor', lodCheckbox.checked) })

    let renderGeometryCheckbox = document.querySelector('#renderGeometry')
    renderGeometryCheckbox.checked = raster.getParameters().renderGeometry;
    renderGeometryCheckbox.addEventListener('change', () => { raster.getParameters().setParam('renderGeometry', renderGeometryCheckbox.checked) })

    let renderKPatchLinesCheckbox = document.querySelector('#renderKPatchLines')
    renderKPatchLinesCheckbox.checked = raster.getParameters().renderKPatchLines;
    renderKPatchLinesCheckbox.addEventListener('change', () => { raster.getParameters().setParam('renderKPatchLines', renderKPatchLinesCheckbox.checked) })

    let renderFlatCheckbox = document.querySelector('#renderFlat')
    renderFlatCheckbox.checked = raster.getParameters().renderFlat;
    renderFlatCheckbox.addEventListener('change', () => { raster.getParameters().setParam('renderFlat', renderFlatCheckbox.checked) });

    let renderUniColorCheckbox = document.querySelector('#renderUniColor')
    renderUniColorCheckbox.checked = raster.getParameters().renderUniColor;
    renderUniColorCheckbox.addEventListener('change', () => { raster.getParameters().setParam('renderUniColor', renderUniColorCheckbox.checked) });

    let disableUpdateOnCamCheckbox = document.querySelector('#disableCamUpdate');
    disableUpdateOnCamCheckbox.checked = raster.getParameters().disableUpdateOnCam;
    disableUpdateOnCamCheckbox.addEventListener('change', () => { raster.getParameters().setParam('disableUpdateOnCam', disableUpdateOnCamCheckbox.checked) });

    let verticalExaggerationInput = document.querySelector('#verticalExaggeration');
    verticalExaggerationInput.value = raster.getParameters().verticalExaggeration;
    verticalExaggerationInput.addEventListener('change', () => { raster.getParameters().setParam('verticalExaggeration', verticalExaggerationInput.value) });

    // Setup Info UI
    const fpsDiv = document.querySelector('#fps');
    const vertexCounterDiv = document.querySelector('#vertexCount');
    const loadingDiv = document.querySelector('#loadingSpinner');

    // Setup legal notice
    const legalNotice = config.legalNotice || '';
    const legalNoticeDiv = document.querySelector('#legalNotice');
    legalNoticeDiv.innerHTML = legalNotice;

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
        let binNodeCounter = raster.getCounters().getBinNodeCounter().getCounters();
        return binNodeCounter.map((val, index) => index != binNodeCounter.length - 1 ? 'Lod: ' + index : 'Total: ');
    }

    const binNodesChartDiv = document.querySelector('#binNodesChart');
    let binNodesChart = new Chart(binNodesChartDiv, {
        type: 'bar',
        data: {
            labels: getBinNodeChartsLabels(),
            datasets: [{
                label: '# of bintree nodes currently rendered',
                data: raster.getCounters().getBinNodeCounter().getCounters(),
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
    let prevBinNodeCountersLength = raster.getCounters().getBinNodeCounter().getCounters().length;

    let getMblockChartsLabels = () => {
        let mblockCounter = raster.getCounters().getMblockCounter().getCounters();
        return mblockCounter.map((val, index) => index != mblockCounter.length - 1 ? 'Lod: ' + index : 'Total: ');
    }

    const mBlocksChartDiv = document.querySelector('#mblocksChart');
    let mBlocksChart = new Chart(mBlocksChartDiv, {
        type: 'bar',
        data: {
            labels: getMblockChartsLabels(),
            datasets: [{
                label: '# of quadtree nodes currently rendered',
                data: raster.getCounters().getMblockCounter().getCounters(),
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
    const drawing = new Drawing(raster);

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
            raster.getQuadTree().renderList.size,
            raster.getQuadTree().onGPUList.size,
            raster.getQuadTree().onRAMList.size,
        ];
        ramUsageChart.update();

        gpuUsageChart.data.datasets[0].data = [
            raster.getQuadTree().renderList.size,
            raster.getQuadTree().onGPUList.size,
        ]
        gpuUsageChart.update();

        if (raster.getCounters().getBinNodeCounter().getCounters().length != prevBinNodeCountersLength) {
            prevBinNodeCountersLength = raster.getCounters().getBinNodeCounter().getCounters().length;
            binNodesChart.data.labels = getBinNodeChartsLabels();
        }
        binNodesChart.data.datasets[0].data = raster.getCounters().getBinNodeCounter().getCounters();
        binNodesChart.update();

        mBlocksChart.data.datasets[0].data = raster.getCounters().getMblockCounter().getCounters();
        mBlocksChart.update();
    }

    // Dolly Cam
    let dollyCam;
    if (config.dollyCam && config.dollyCam.length > 0) {
        dollyCam = new DollyCam(raster, config.dollyCam);
    }

    raster.setLoadingFinishedCallback(updateMemoryUsageCharts)
    raster.setRenderLoopCallback((didDraw, swapped) => {
        didDraw && dollyCam && dollyCam.start();
        dollyCam && dollyCam.advance(swapped);

        fpsDiv.innerHTML = 'FPS: ' + raster.fps;
        vertexCounterDiv.innerHTML = 'Vertices: ' + raster.getCounters().getVertexCounter().vertices.toLocaleString();
        loadingChart.data.datasets[0].data = [raster.getLoadingState().currentlyLoadingHeight, raster.getLoadingState().currentlyLoadingColor];
        loadingChart.update();

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