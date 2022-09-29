class MethodTimer {
    constructor(key, label) {
        this.accumulatedTime = 0;
        this.counter = 0;
        this.min = Number.MAX_SAFE_INTEGER;
        this.max = Number.MIN_SAFE_INTEGER;
        this.lastValue = 0;
        this.key = key;
        this.label = label || key;
    }

    reset = () => {
        this.accumulatedTime = 0;
        this.counter = 0;
        this.min = Number.MAX_SAFE_INTEGER;
        this.max = Number.MIN_SAFE_INTEGER;
    }

    getAverageTime = (divisor = 1) => {
        return this.counter == 0 ? -1 : this.accumulatedTime / (this.counter * divisor);
    }

    measureTime = (method, ...methodArguments) => {
        let startTime = Date.now();
        let result = method(...methodArguments);
        let endTime = Date.now();
        this.counter += 1;
        let duration = endTime - startTime
        this.accumulatedTime += duration;
        this.lastValue = duration;
        this.checkMinMax(duration);
        return result;
    }

    checkMinMax = (duration) => {
        this.min = Math.min(duration, this.min);
        this.max = Math.max(duration, this.max);
    }

    addManualMeasurement = (duration) => {
        if (duration == undefined) {
            return;
        }
        this.counter += 1;
        this.accumulatedTime += duration;
        this.lastValue = duration;
        this.checkMinMax(duration);
    }

    toString = () => {
        return this.label + ' Avg: ' + this.getAverageTime() +'ms; Min: ' + this.min + 'ms; Max: ' + this.max + 'ms';
    }
}

class Timer {
    constructor() {
        this.timer = {};
    }

    reset = () => {
        Object.keys(this.timer).forEach(key => {
            let currentTimer = this.timer[key];
            currentTimer.reset();
        });
    }

    addTimer = (key, label) => {
        if (!this.timer[key]) {
            this.timer[key] = new MethodTimer(key, label);
        }
        return this.timer[key];
    }

    getTimer = (key) => {
        return this.timer[key];
    }

    writeAverageTimingsToConsole = () => {
        console.log('-----------------------------')
        console.log('Current Timings:')
        Object.keys(this.timer).forEach(key => {
            let currentTimer = this.timer[key];
            if (currentTimer.counter !== 0) {
                console.log(currentTimer.toString());
            }
        });
        console.log('-----------------------------\n')
    }
}

export default Timer;