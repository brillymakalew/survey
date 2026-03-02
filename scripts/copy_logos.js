/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'logo');
const destDir = path.join(__dirname, '..', 'public', 'logo');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

const rttSrc = path.join(srcDir, 'logo-rtt.png');
const rttDest = path.join(destDir, 'rtt.png');

if (fs.existsSync(rttSrc)) {
    fs.copyFileSync(rttSrc, rttDest);
    console.log('Copied RTT');
} else {
    console.log('RTT missing');
}
