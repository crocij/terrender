import * as twgl from 'twgl.js';
const v3 = twgl.v3;

let waitTimeDownloads = 0;

const DO_BENCHMARK = false;

/**
 * 
 * @param {String} content 
 * @param {String} name 
 */
let download = (content, name) => {
    var link = document.createElement('a');
    if (typeof link.download === 'string') {
        link.href = content;
        link.download = name.replace('.', '_') + '.csv';

        //Firefox requires the link to be in the body
        document.body.appendChild(link);

        setTimeout(() => {

            //simulate click
            link.click();

            //remove the link when done
            document.body.removeChild(link);
        }, waitTimeDownloads)

        waitTimeDownloads += 5000
    } else {
        window.open(uri);
    }
}

class DollyCam {

    /**
     * 
     * @param {*} terrender 
     * @param {Array} dollyConfig 
     */
    constructor(terrender, dollyConfig) {
        this.terrender = terrender;
        this.paresConfig(dollyConfig);
        this.running = false;
        this.init = true;

        if (DO_BENCHMARK) {
            this.nrSwapped = 0;
            this.timeLine = [];
            this.fpsBuckets = new Uint32Array(300);
            this.genericCounters = {};
            this.timers = {}
        }
    }

    paresConfig = (dollyConfig) => {
        let totalTime = dollyConfig[0].duration || 10000;
        let breakTime = dollyConfig[0].breakTime || 10000;
        let arr = []
        for (let i = 0; i < dollyConfig.length - 1; i++) {
            let obj = {
                startPostion: dollyConfig[i].pos,
                startTarget: dollyConfig[i].target,
                endPosition: dollyConfig[i + 1].pos,
                endTarget: dollyConfig[i + 1].target,
                distPositions: v3.distance(dollyConfig[i].pos, dollyConfig[i + 1].pos),
                distTargets: v3.distance(dollyConfig[i].target, dollyConfig[i + 1].target),
                vecPositions: v3.normalize(v3.subtract(dollyConfig[i + 1].pos, dollyConfig[i].pos)),
                vecTargets: v3.normalize(v3.subtract(dollyConfig[i + 1].target, dollyConfig[i].target)),
            };

            // Check if there is any movement or it is a stop
            // if it is a stop (two times identical points e.g. zero distances) wait for the specified break time
            if (obj.distPositions == 0 && obj.distTargets == 0) {
                obj.noCamUpdates = true;
            }

            arr.push(obj)
        }

        let totalLength = arr.reduce((prevVal, item) => prevVal + item.distPositions, 0);
        let timeSum = 0;
        let totalBreakTime = 0;
        arr = arr.map(item => {
            let time = (item.distPositions / totalLength) * totalTime;
            if (item.noCamUpdates) {
                time = breakTime;
                totalBreakTime += time;
            }
            item.startTime = timeSum;
            item.duration = time;
            timeSum += time;
            return item;
        });

        // The Total time the dollyshot runs is given by the break times and the specified time in motion
        totalTime += totalBreakTime;

        arr.push({
            startPostion: dollyConfig[dollyConfig.length - 1].pos,
            startTarget: dollyConfig[dollyConfig.length - 1].target,
            startTime: totalTime,
            stop: true,
        })
        this.steps = arr.reverse();
    }

    start = () => {
        if (this.init && !this.running) {
            this.init = false;
            this.running = true;
            this.startTime = Date.now();
            this.terrender.getTimer().reset();
        }
    }

    advance = (swapped) => {
        if (!this.running) {
            return;
        }
        let currentTime = Date.now() - this.startTime;
        let currentStep = this.steps.find(item => item.startTime <= currentTime);

        // Dolly finished
        if (currentStep.stop) {
            this.running = false;
            this.terrender.getCamera().changeCamPosition(currentStep.startPostion, currentStep.startTarget);

            // UNCOMMENT FOR BENCH (2/3)
            if (DO_BENCHMARK) {
                console.log('Nr. of swaps durring dolly: ' + this.nrSwapped);
                this.terrender.getTimer().writeAverageTimingsToConsole();
                let csv;
                let encodedUri;

                // Only Swaps
                csv = 'data:text/csv;charset=utf-8,timeStamp,swapped\r\n' + this.timeLine.filter(item => item.swapped).map(item => item.timeStamp + ',1').join('\r\n');
                encodedUri = encodeURI(csv);
                download(encodedUri, 'swaps');


                // FPS and Swaps
                csv = this.timeLine.reduce((prev, current) => {
                    if (current.timeStamp < 10 && !current.swapped) {
                        return prev;
                    }
                    return prev + current.timeStamp + ',' + (current.fps < 55 ? current.fps : '') + ',' + (current.swapped ? 1 : '') + '\r\n';
                }, 'data:text/csv;charset=utf-8,timeStamp,fps,swapped\r\n');
                encodedUri = encodeURI(csv);
                download(encodedUri, 'swapsAndFps');

                // Histo Data
                csv = this.fpsBuckets.reduce((prev, current, currentI) => {
                    if (current > 0) {
                        return prev + (currentI + 1) + ',' + current + '\r\n'; 
                    }
                    return prev;
                }, 'data:text/csv;charset=utf-8,fps,number\r\n')
                encodedUri = encodeURI(csv);
                download(encodedUri, 'histogram');

                // Generic Counters
                Object.keys(this.genericCounters).forEach(counterName => {
                    let entries = this.genericCounters[counterName];
                    csv = 'data:text/csv;charset=utf-8,timeStamp,' + counterName + '\r\n' + entries.map(entry => entry.timeStamp + ',' + entry.value).join('\r\n');
                    encodedUri = encodeURI(csv);
                    download(encodedUri, 'conunter_' + counterName);
                });

                // Timers
                Object.keys(this.timers).forEach(timerName => {
                    let entries = this.timers[timerName];
                    csv = 'data:text/csv;charset=utf-8,timeStamp,' + timerName + '\r\n' + entries.map(entry => entry.timeStamp + ',' + entry.value).join('\r\n');
                    encodedUri = encodeURI(csv);
                    download(encodedUri, 'timer_' + timerName);
                });
            }

            return;
        }

        if (currentStep.noCamUpdates) {
            return;
        }

        let timeInCurrentStep = currentTime - currentStep.startTime;
        let percentageCurrentStep = timeInCurrentStep / currentStep.duration;

        let newPosition = v3.add(currentStep.startPostion, v3.mulScalar(currentStep.vecPositions, percentageCurrentStep * currentStep.distPositions));
        let newTarget = v3.add(currentStep.startTarget, v3.mulScalar(currentStep.vecTargets, percentageCurrentStep * currentStep.distTargets));

        this.terrender.getCamera().changeCamPosition(newPosition, newTarget);

        if (DO_BENCHMARK) {
            if (swapped) {
                this.nrSwapped++;
            }

            let currentFPS = this.terrender.getTimer().getTimer('fps').lastValue;
            if (currentFPS < 55 || swapped) {
                this.timeLine.push({ timeStamp: currentTime, fps: currentFPS, swapped: swapped });
            }
            this.fpsBuckets[currentFPS - 1]++;
            let counters = this.terrender.getCounters().getGenericCounters();
            Object.keys(counters).forEach(counterName => {
                let lastEntries = this.genericCounters[counterName];
                let lastVal = undefined;
                let currentVal = counters[counterName].getValue();
                if (!Array.isArray(lastEntries)) {
                    this.genericCounters[counterName] = [];
                } else {
                    lastVal = lastEntries[lastEntries.length - 1].value;
                }

                if (lastVal !== currentVal) {
                    this.genericCounters[counterName].push({ value: currentVal, timeStamp: currentTime });
                }
            });

            let timers = this.terrender.getTimer().timer;
            Object.keys(timers).forEach(timerName => {
                if (timers[timerName].counter === 0) {
                    return;
                }
                let lastEntries = this.timers[timerName];
                let lastVal = undefined;
                let currentVal = timers[timerName].lastValue;
                if (!Array.isArray(lastEntries)) {
                    this.timers[timerName] = [];
                } else {
                    lastVal = lastEntries[lastEntries.length - 1].value;
                }

                if (lastVal !== currentVal) {
                    this.timers[timerName].push({ value: currentVal, timeStamp: currentTime });
                }
            });
        }
    }
}

export default DollyCam;