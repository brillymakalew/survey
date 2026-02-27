/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'logo');
const destDir = path.join(__dirname, '..', 'public', 'logo');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

const bcSrc = path.join(srcDir, 'logo british council.png');
const bcDest = path.join(destDir, 'british_council.png');

if (fs.existsSync(bcSrc)) {
    fs.copyFileSync(bcSrc, bcDest);
    console.log('Copied British Council');
} else {
    console.log('BC missing', bcSrc);
}

const rttSrc = path.join(srcDir, 'logo-rtt.png');
const rttDest = path.join(destDir, 'rtt.png');

if (fs.existsSync(rttSrc)) {
    fs.copyFileSync(rttSrc, rttDest);
    console.log('Copied RTT');
} else {
    console.log('RTT missing');
}
