const { app, BrowserWindow } = require('electron')
const Messaging = require('./messaging');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

let RMQ_URL = "amqp://gxqzgwoj:hXDR_7ciQm93nouQGRC_YGLPbIYnFCid@mustang.rmq.cloudamqp.com/gxqzgwoj";
let NODE_ID = "TPS02";

function createWindow () {
    // Create the browser window.
    win = new BrowserWindow({ width: 800, height: 600 })

    // and load the index.html of the app.
    win.loadFile('index.html')

    // Open the DevTools.
    //win.webContents.openDevTools()

    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null
    });

    enableNode(NODE_ID, "", "", RMQ_URL);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow()
    }
})

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
                console.log(msg.content.toString())
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.