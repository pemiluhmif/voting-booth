const { dialog, app, BrowserWindow } = require('electron');
const Messaging = require('./messaging');
const Database = require('./database');
const yargs = require('yargs');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

let serv = require('./src/app');

function createWindow () {
    // Create the browser window.

    win = new BrowserWindow({
        width: 1024,
        height: 600,
        resizable: true
    });

    // Load main site
    win.loadURL('http://localhost:7000/');
    win.focus();

    // Open the DevTools.
    //win.webContents.openDevTools()

    // Emitted when the window is closed.
    win.on('closed', () => {
        win = null
    });

    // enableNode(NODE_ID, "", "", RMQ_URL);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', ()=>{
    let argv = yargs.usage("Usage: $0 [options]")
        .example("$0 -i --setting=myManifest.json --auth=myAuth.json --db=myDb.db")
        .example("$0")
        .alias("h","help")
        .alias("v","version")
        .alias("i","initial")
        .boolean("i")
        .describe("i","Initial load (load JSON config)")
        .default("config","manifest.json")
        .default("auth","auth.json")
        .default("db","pemilu.db")
        .argv;

    let status = Database.init(argv.db)

    if(status["status"]){
        // Initial config
        if(argv.initial){
            try {
                Database.loadInitManifest(Database.loadJSON(argv.config));
                Database.loadAuthorizationManifest(Database.loadJSON(argv.auth));
                Database.setupTable();
            } catch (e) {
                dialog.showErrorBox("Error on JSON load",e.message);
                console.error(e.message);
                process.exit(1);
            }
        }

        // Setup node
        try{
            enableNode(Database.getConfig("node_id"),
                Database.getConfig("origin_hash"),
                Database.getConfig("machine_key"),
                Database.getConfig("amqp_url"));
        }catch (e) {
            dialog.showErrorBox("Error on node communication setup",e.message);
            console.error(e.message);
            process.exit(1);
        }

        createWindow();

    }else{
        dialog.showErrorBox("Error on init",status["msg"]);
    }

});

// Quit when all windows are closed.
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