const { dialog, app, BrowserWindow } = require('electron');
const Messaging = require('./messaging');
const Database = require('./database');
const yargs = require('yargs');
const ipcMain = require('electron').ipcMain;
const VoteSys = require('./vote');
const VoteWindow = require('./votewindow');

let win;

let serv = null;

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
    win.setFullScreen(true);

    win.webContents.openDevTools();

    // Load main site
    win.loadURL('http://localhost:7000/');
    win.focus();

    // Emitted when the window is closed.
    win.on('closed', () => {
        win = null
    });

    VoteWindow.init(win);
}

/**
 *  This method will be called when Electron has finished
 *  initialization. Set up node and database
 */
app.on('ready', ()=>{
    let yargsSetting = yargs.usage("Usage: $0 [options]")
        .example("$0 -i --setting=myManifest.json --auth=myAuth.json --db=myDb.db")
        .example("$0")
        .alias("h","help")
        .alias("v","version")
        .alias("i","initial")
        .boolean("i")
        .describe("i","Initial load (load JSON config)")
        .default("config","manifest.json")
        .default("auth","auth.json")
        .default("db","pemilu.db");

    let argv;
    if(app.isPackaged){
        argv = yargsSetting.parse(process.argv.slice(1));
    }else{
        argv = yargsSetting.argv;
    }


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

                    VoteWindow.begin(data, msg, ch);
                    } catch (e) {
                    console.error(e.message);
                    ch.nack(msg);
                }
            } catch (e) {
                console.log(e);
            }
        });

        // Keeps track of casted votes
        Messaging.setMessageListener(Messaging.EX_VOTE_CASTED, (msg,ch)=>{
            let data = JSON.parse(msg.content.toString());
            console.log("Receive vote data");
            if(data.node_id !== Database.getConfig("node_id")) {
                Database.performVoteDataUpdate(data.node_id, data.vote_payload);
                Database.performSigDataUpdate(data.node_id, data.last_signature);
                Database.updatePersonData(data.voter_nim,"voted",1);
                Database.updatePersonData(data.voter_nim,"last_queued",null);
            }
            ch.ack(msg);
        });

        // Keeps track of queued voter
        Messaging.setMessageListener(Messaging.EX_VOTER_QUEUED, (msg,ch)=>{
            let data = JSON.parse(msg.content.toString());
            Database.updatePersonData(data.voter_nim, "last_queued", data.timestamp);
        });

        Messaging.setMessageListener(Messaging.EX_VOTE_DATA_REPLY,(msg,ch)=>{
            let data = JSON.parse(msg.content.toString());

            if(data.persons !== undefined){
                data.persons.forEach((item)=>{
                    Database.performPersonDataUpdate(data.node_id,item);
                })
            }
        });

        Messaging.setMessageListener(Messaging.EX_VOTE_DATA_REPLY,(msg,ch)=>{
            let data = JSON.parse(msg.content.toString());

            if(data.votes !== undefined){
                data.votes.forEach((item)=>{
                    Database.performVoteDataUpdate(data.node_id,item);
                });
            }

            if(data.last_hashes!==undefined){
                data.last_hashes.forEach((item)=>{
                    Database.performSigDataUpdate(data.node_id,item);
                });
            }

            console.log(data);
        });
        Messaging.setMessageListener(Messaging.EX_REQUEST_DATA_BROADCAST, (msg,ch)=>{
            let data = JSON.parse(msg.content.toString());
            console.log(data);
            let votes = Database.getVoteRecords();
            let lastSigs = Database.getLastSignatures();
            console.log(votes);
            console.log(lastSigs);
            let replyVote = {
                "node_id": Database.getConfig("node_id"),
                "votes": votes,
                "last_hashes": lastSigs
            };
            Messaging.sendToQueue(Messaging.EX_VOTE_DATA_REPLY+":"+data.node_id,JSON.stringify(replyVote));

            let persons = Database.getVoters();
            console.log(persons);
            let replyPerson = {
                "node_id": Database.getConfig("node_id"),
                "persons": persons
            };

            Messaging.sendToQueue(Messaging.EX_PERSON_DATA_REPLY+":"+data.node_id,JSON.stringify(replyPerson));
        });


        let data = {
            "node_id" : Database.getConfig("node_id")
        };

        Messaging.publish(Messaging.EX_REQUEST_DATA_BROADCAST,'',JSON.stringify(data),null);

        createWindow();
    });
}