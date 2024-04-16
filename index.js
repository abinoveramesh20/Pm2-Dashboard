const express = require('express');
const app = express();
const httpServer = require('http').createServer(app);
const basicAuth = require('express-basic-auth');
const io = require('socket.io')(httpServer, {
    cors: {
        origin: '*', // Adjust this to match your HTML page's origin
        methods: ['GET', 'POST']
    }
});
const fs = require('fs');
const { exec } = require('child_process');
const dotenv = require('dotenv').config();
const env = dotenv.parsed;

// Middleware for basic authentication
const auth = basicAuth({
    users: { [env.USERNAME]: env.PASSWORD },
    challenge: true,
    realm: 'Restricted Area',
  });
  
  app.use(auth);
  
  // Serve the client-side HTML and JS
  app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
  });

const port = process.env.PORT || 3000;

const outLogFilePath = process.env.FILE_PATH1;
const errorLogFilePath = process.env.FILE_PATH2;
const maxLines = 100;


// Function to emit changes in the log file
function emitLogFileChange(logData, event) {
    io.emit(event, logData);
}

// Function to read the last `maxLines` lines of a log file
function readLastLogLines(filePath, callback) {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading log file:', err);
        } else {
            const lines = data.split('\n');
            const lastLines = lines.slice(-maxLines);
            callback(lastLines.join('\n'));
        }
    });
}

// Watch the out log file for changes
fs.watch(outLogFilePath, (event, filename) => {
    if (event === 'change') {
        readLastLogLines(outLogFilePath, (lastLines) => {
            emitLogFileChange(lastLines, 'outLogFileChange');
        });
    }
});

// Watch the error log file for changes
fs.watch(errorLogFilePath, (event, filename) => {
    if (event === 'change') {
        readLastLogLines(errorLogFilePath, (lastLines) => {
            emitLogFileChange(lastLines, 'errorLogFileChange');
        });
    }
});


io.on('connection', (socket) => {
    console.log('Client connected');
    readLastLogLines(errorLogFilePath, (lastLines) => {
        emitLogFileChange(lastLines, 'errorLogFileChange');
    });
    // Read and emit the last `maxLines` lines for both logs when a client connects
    readLastLogLines(outLogFilePath, (lastLines) => {
        emitLogFileChange(lastLines, 'outLogFileChange');
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Add an endpoint to run the script
app.post('/run-script', (req, res) => {
    // Execute the script here
    exec('sh /var/www/html/pm2-log-dashboard-new-button-pm2/restart.sh', (error, stdout, stderr) => {
        if (error) {
            console.error('Error running script:', error.message);
            return res.status(500).send('Error running script.');
        }
        console.log('Script output:', stdout);
        res.status(200).send('Script executed successfully.');
    });
});

httpServer.listen(port, () => {
    console.log(`server started on port ${port}`);
});

