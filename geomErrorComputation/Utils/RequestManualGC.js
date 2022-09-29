module.exports = () => {
    try {
        if (global.gc) { 
            global.gc();  
        }
    } catch (e) {
        console.log("`node --expose-gc index.js`");
        process.exit();
    }
}