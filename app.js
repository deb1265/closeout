const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const path = require('path');
const cors = require('cors'); // Require CORS middleware
const app = express();

// Use CORS middleware to allow cross-origin requests
app.use(cors());

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.locals.progressUpdate = null;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/executeScript', (req, res) => {
    const { custID } = req.body;
    console.log("Received Customer ID:", custID);
    if (!custID) {
        return res.status(400).send('Customer ID is required');
    }

    // Inform the connected client that processing has started
    if (app.locals.progressUpdate) {
        const message = JSON.stringify({ status: "Starting", message: `Executing script for Customer ID: ${custID}...` });
        app.locals.progressUpdate.write(`data: ${message}\n\n`);
    }

    const childProcess = exec(`node mainforclosing.js ${custID}`);

    childProcess.stdout.on('data', (data) => {
        console.log('stdout: ' + data);
        if (app.locals.progressUpdate) {
            const message = JSON.stringify({ message: data.trim() });
            app.locals.progressUpdate.write(`data: ${message}\n\n`);
        }
    });
    // Add error handling for child process
    childProcess.on('error', (error) => {
        console.error('Child process failed to start:', error);
        if (app.locals.progressUpdate) {
            const message = JSON.stringify({ status: "Error", message: "Failed to start script execution." });
            app.locals.progressUpdate.write(`data: ${message}\n\n`);
        }
        res.status(500).send({ message: 'Failed to execute script', error: error.message });
    });
    childProcess.stderr.on('data', (data) => {
        console.error('stderr: ' + data);
        if (app.locals.progressUpdate) {
            const error = JSON.stringify({ error: data.trim() });
            app.locals.progressUpdate.write(`data: ${error}\n\n`);
        }
    });

    childProcess.on('exit', (code) => {
        console.log(`Child process exited with code ${code}`);
        if (app.locals.progressUpdate) {
            const message = JSON.stringify({ status: "Completed", message: "Script execution completed." });
            app.locals.progressUpdate.write(`data: ${message}\n\n`);
        }
        res.send({ message: 'Script executed successfully', code });
    });
});

app.get('/progress', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const keepAlive = setInterval(() => {
        res.write(':keep-alive\n\n');
    }, 20000);

    app.locals.progressUpdate = res;

    req.on('error', (error) => {
        console.error('SSE connection error:', error);
        clearInterval(keepAlive);
        app.locals.progressUpdate = null;
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
