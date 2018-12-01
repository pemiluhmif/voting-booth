const { app, BrowserWindow } = require('electron')
const Messaging = require('./messaging');

require('electron-reload')(__dirname)

let win;
let serv = require('./src/app');

let RMQ_URL = "amqp://gxqzgwoj:hXDR_7ciQm93nouQGRC_YGLPbIYnFCid@mustang.rmq.cloudamqp.com/gxqzgwoj";
let NODE_ID = "TPS02";

app.on('ready', function() {
    'use strict';

    win = new BrowserWindow({
        width: 1024,
        height: 600,
        resizable: true
    })
    // win.setMenu(null);
    win.loadURL('http://localhost:7000/');
    win.focus();

    enableNode(NODE_ID, "", "", RMQ_URL);
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});
app.on('activate', () => {
    if (win === null) {
        createWindow()
    }
});

/**
 * TODO Enable node (invoked after loading Authorization Mainfest)
 */
function enableNode(nodeId, originHash, machineKey, amqpUrl) {
    NODE_ID = nodeId;

    // Connect to broker
    Messaging.init(nodeId, Messaging.NODE_TYPE_VOTING_BOOTH);
    Messaging.connect(amqpUrl, function() {
        Messaging.setMessageListener(Messaging.EX_VOTER_QUEUED_SHARED, function(msg, ch) {
            try {
                console.log(msg.content);
                let data = JSON.parse(msg.content.toString());
                console.log("Vote request: " + data.voter_name + " (" + data.voter_nim + ")");
                Messaging.sendToQueue(data.reply, JSON.stringify({node_id: NODE_ID, request_id: data.request_id}));

                // Acknowledge message WHEN VOTING IS COMPLETE
                ch.ack(msg);
            } catch (e) {
                console.log(e);
            }
        });
    });
}