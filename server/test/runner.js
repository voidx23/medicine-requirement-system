import { spawn } from 'child_process';
import path from 'path';

const PORT = 5001;

console.log(`🔌 Starting Temporary Test Server on Port ${PORT}...`);

// Run from 'server' directory so .env is found
const server = spawn('node', ['src/server.js'], {
    env: { ...process.env, PORT },
    cwd: 'server', 
    stdio: 'pipe', 
    shell: true
});

server.stdout.on('data', (data) => {
    console.log(`[SERVER]: ${data.toString().trim()}`);
});

server.stderr.on('data', (data) => {
    console.error(`[SERVER ERROR]: ${data.toString().trim()}`);
});

// Give server time to connect to DB
setTimeout(() => {
    console.log('\n🧪 Running Test Script against Port 5001...');
    
    // Run test from 'server' directory
    const test = spawn('node', ['test/api_test.js'], {
        env: { ...process.env, PORT },
        cwd: 'server', 
        stdio: 'inherit',
        shell: true
    });

    test.on('close', (code) => {
        console.log(`\n🛑 Tests completed with code ${code}. Stopping Test Server...`);
        // Kill tree 
        if (process.platform === 'win32') {
             spawn("taskkill", ["/pid", server.pid, '/f', '/t']);
        } else {
             server.kill();
        }
        process.exit(code);
    });

}, 5000);
