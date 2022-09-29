const MAX_CONCURRENT_PROMISES = 30;

class PromiseQueue {
    constructor(maxParallel = MAX_CONCURRENT_PROMISES) {
        this.maxParallel = maxParallel;
        this.currentlyRunning = 0;
        this.queue = [];
    }

    /**
     * Takes as argument a function that returns a promise e.g. () => somethingThatReturnsAPromise()
     * @param {Function} promise
     * @returns {Promise}
     */
    push = (promise) => {
        return new Promise((resolve, reject) => {
            this.queue.push({
                promise,
                resolve,
                reject,
            })
            this.startNext()
        });
    }

    startNext = () => {
        while (this.currentlyRunning < MAX_CONCURRENT_PROMISES && this.queue.length > 0) {
            let item = this.queue.shift();
            this.currentlyRunning += 1;
            item.promise().then(value => {
                this.currentlyRunning -= 1;
                item.resolve(value);
                this.startNext();
            }).catch(err => {
                this.currentlyRunning -= 1;
                item.reject(err);
                this.startNext();
            })
            return true;
        }
    }


}

export default PromiseQueue;