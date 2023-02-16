class MethodTimer {

    /**
     * @param {String} key Unique for the timer
     * @param {String} label Pretty name for the timer
     */
    constructor(key, label) {
        this.accumulatedTime = 0;
        this.counter = 0;
        this.min = Number.MAX_SAFE_INTEGER;
        this.max = Number.MIN_SAFE_INTEGER;
        this.lastValue = 0;
        this.key = key;
        this.label = label || key;
    }

    /**
     * Reset the Timer
     */
    reset = () => {
        this.accumulatedTime = 0;
        this.counter = 0;
        this.min = Number.MAX_SAFE_INTEGER;
        this.max = Number.MIN_SAFE_INTEGER;
    }

    /**
     * Get the average and scale ut with the specified inverse
     * @param {Number} inverseScaling 
     * @returns {Number}
     */
    getAverageTime = (inverseScaling = 1) => {
        return this.counter == 0 ? -1 : this.accumulatedTime / (this.counter * inverseScaling);
    }

    /**
     * Execute the method synchronously, measure the time for the execution and return the result of the method
     * @param {Function} method 
     * @param  {...any} methodArguments 
     * @returns {any}
     */
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

    /**
     * Check if the specified duration is a new min or max, if so set it
     * @param {Number} duration 
     */
    checkMinMax = (duration) => {
        this.min = Math.min(duration, this.min);
        this.max = Math.max(duration, this.max);
    }

    /**
     * Add a manual measurement
     * @param {Number} duration 
     */
    addManualMeasurement = (duration) => {
        if (duration == undefined) {
            return;
        }
        this.counter += 1;
        this.accumulatedTime += duration;
        this.lastValue = duration;
        this.checkMinMax(duration);
    }

    /**
     * @inheritdoc
     * @returns {String}
     */
    toString = () => {
        return this.label + ' Avg: ' + this.getAverageTime() +'ms; Min: ' + this.min + 'ms; Max: ' + this.max + 'ms';
    }
}

class Timer {
    constructor() {
        this.timer = {};
    }

    /**
     * Reset all timers
     */
    reset = () => {
        Object.keys(this.timer).forEach(key => {
            let currentTimer = this.timer[key];
            currentTimer.reset();
        });
    }

    /**
     * Creates a new Timer
     *
     * @param {String} key Unique for the timer
     * @param {String} label Pretty name for the timer
     * @returns {Timer}
     */
    addTimer = (key, label) => {
        if (!this.timer[key]) {
            this.timer[key] = new MethodTimer(key, label);
        }
        return this.timer[key];
    }

    /**
     * Get the timer specified by the key
     * 
     * @param {String} key 
     * @returns {Timer|null}
     */
    getTimer = (key) => {
        return this.timer[key];
    }

    /**
     * Write the timers to console
     */
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