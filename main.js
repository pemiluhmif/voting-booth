const { dialog, app, BrowserWindow } = require('electron');
const Messaging = require('./messaging');
const Database = require('./database');
const yargs = require('yargs');
const ipcMain = require('electron').ipcMain;
const VoteSys = require('./vote');

let win;

let serv = null;

var voterData = null;

var ackMsg = null;
var ackCh = null;
var interactTimer = null;

const voterTimeout = 10000;

/**
 *  Create new window, load view, and set up ipc
 */
function createWindow () {
    // Load express
    serv = require('./src/app');

    // Create window
    win = new BrowserWindow({
        width: 1024,
        height: 600,
        resizable: true
    });

    // Load main site
    win.loadURL('http://localhost:7000/');
    win.focus();

    // Open the DevTools.
    win.webContents.openDevTools()

    // Emitted when the window is closed.
    win.on('closed', () => {
        win = null
    });

    ipcMain.on('voted',function (event,arg) {
        event.sender.send("castVoteReply",castVote(arg));
        ackCh.ack(ackMsg);
    });

    ipcMain.on('voter-interact',function(event, arg){
        console.log("delete timer");
        clearTimeout(interactTimer);
    });


}

/**
 *  This method will be called when Electron has finished
 *  initialization. Set up node and database
 */
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

    let status = Database.init(argv.db);

    if(status["status"]){
        // Initial config
        if(argv.initial){
            try {
                let ret = Database.loadInitManifest(Database.loadJSON(argv.config));
                if(ret['status']===false){
                    dialog.showErrorBox("Error on JSON (manifest) load",ret['msg']);
                    process.exit(1);
                }
            } catch (e) {
                dialog.showErrorBox("Error on JSON (manifest) load",e.message);
                console.error(e.message);
                process.exit(1);
            }
        }

        // auth config
        try {
            ret = Database.loadAuthorizationManifest(Database.loadJSON(argv.auth));
            if(ret['status']===false){
                dialog.showErrorBox("Error on JSON (auth) load",ret['msg']);
                process.exit(1);
            }
            if(argv.initial){
                Database.setupTable();
            }
        } catch (e) {
            dialog.showErrorBox("Error on JSON (auth) load",e.message);
            console.error(e.message);
            process.exit(1);
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
 *  Enable node
 *  Setup message listener and voteSys
 *  @param nodeId Node id of this node
 *  @param machineKey machine key
 *  @param amqpUrl URL of rabbbitmq server
 */
function enableNode(nodeId, originHash, machineKey, amqpUrl) {
    console.log(Database.getLastSignature());
    VoteSys.init(Database.getLastSignature(),machineKey);

    // Connect to broker
    Messaging.init(nodeId, Messaging.NODE_TYPE_VOTING_BOOTH);
    Messaging.connect(amqpUrl, function() {
        Messaging.setMessageListener(Messaging.EX_VOTER_QUEUED_SHARED, function(msg, ch) {
            try {
                try {
                    let data = JSON.parse(msg.content.toString());
                    console.log("Vote request: " + data.voter_name + " (" + data.voter_nim + ")");
                    Messaging.sendToQueue(data.reply, JSON.stringify({node_id: Database.getConfig("node_id"), request_id: data.request_id}));

                    win.webContents.send("readyToVote",data.voter_nim);

                    voterData = data;
                    ackMsg = msg;
                    ackCh = ch;
                    interactTimer = setTimeout(()=>{
                        win.webContents.send("voterUnresponsive");
                        ackCh.ack(ackMsg);
                    },voterTimeout);
                } catch (e) {
                    console.error(e.message);
                    ch.nack(msg);
                }
            } catch (e) {
                console.log(e);
            }
        });
        Messaging.setMessageListener(Messaging.EX_VOTE_CASTED, (msg,ch)=>{
            let data = JSON.parse(msg.content.toString());
            console.log("Receive vote data");
            if(data.node_id!==Database.getConfig("node_id")) {
                Database.performVoteDataUpdate(Database.getConfig("node_id"), data.vote_payload, data.last_signature);
                Database.updatePersonData(data.voter_nim,"voted",1);
                Database.updatePersonData(data.voter_nim,"last_queued",null);
            }
            ch.ack(msg);
        });
    });
}

/**
 * Cast vote
 * Update the database and publish vote casted message
 * @param argument voting JSON object {"type": <type>,"candidate_no":<number>}
 * @returns true if succeed
 */
function castVote(argument){

    try {
        let data = {};
        data[argument.type] = argument.candidate_no;

        let objret = VoteSys.createVotePayload(data);

        let voteData = objret['votePayload'];
        voteData['vote_data'] = JSON.parse(voteData['vote_data']);
        let sigData = objret['lastHashPayload'];

        let nodeId = Database.getConfig("node_id");

        let voteCastedData = {
            "node_id": nodeId,
            "request_id": voterData.request_id,
            "voter_nim": voterData.voter_nim,
            "vote_payload": {
                "previous_signature": voteData['previous_hash'],
                "node_id": nodeId,
                "vote_id": voteData['vote_data']['vote_id'],
                "voted_candidate": JSON.stringify(voteData['vote_data']['vote_data']),
                "signature": voteData['current_hash']
            },
            "last_signature": {
                "node_id": nodeId,
                "last_signature": sigData['last_hash'],
                "signature": sigData['last_hash_hmac']
            }
        };

        Messaging.publish(Messaging.EX_VOTE_CASTED, '', JSON.stringify(voteCastedData), null);

        // Messaging.publish(Messaging.getQueueName(Messaging.EX_VOTE_CASTED), JSON.stringify(voteCastedData));

        Database.performVoteDataUpdate(Database.getConfig("node_id"), voteCastedData['vote_payload'], voteCastedData['last_signature']);
        Database.updatePersonData(voterData.voter_nim,"voted",1);

        VoteSys.commitVotePayload();

        return true;

    } catch (e) {
        console.error(e.message);
        return false;
    }
}