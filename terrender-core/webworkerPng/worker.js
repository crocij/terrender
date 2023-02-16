import { decode } from 'fast-png';

onmessage = function (e) {
    let result = new Uint8Array(decode(e.data).data)
    postMessage(result.buffer, [result.buffer]);
}
