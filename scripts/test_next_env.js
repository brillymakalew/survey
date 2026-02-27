/* eslint-disable @typescript-eslint/no-require-imports */
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

/* eslint-disable @typescript-eslint/no-require-imports */
const bcrypt = require('bcryptjs');
const hash = process.env.ADMIN_PASSWORD_HASH;
console.log('Loaded hash from Next Config:', hash);
try {
    console.log('password123 matches:', bcrypt.compareSync('password123', hash));
} catch (e) {
    console.error('Bcrypt Error:', e.message);
}
