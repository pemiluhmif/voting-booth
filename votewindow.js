const database = require('./database');
const ipcMain = require('electron').ipcMain;
const VoteSys = require('./vote');
const Messaging = require('./messaging');

const INACTIVITY_TIMEOUT = 60 * 1000; // 60 seconds
const INACTIVITY_WARNING_TIMEOUT = 10 * 1000; // 10 seconds

var timeoutTimer, warningTimer;

var win;
var vtypes = [];
var vote_data = {};
var i;
var voterData;
var voteOngoing = false;
var queue = [];

exports.init = function(window) {
    win = window;
    let votes = database.getConfig("voting_types");

    votes.forEach(data => {
        vtypes.push(data.type);
    });

    ipcMain.on('voted',function (event, arg) {
        if(voteOngoing) {
            event.sender.send("castVoteReply", castVote(arg.vote_type, arg.candidate_no));
        }
    });

    ipcMain.on('dismiss-instructions',function (event, arg) {
        if(voteOngoing) {
            dismissInstructions();
        }
    });

    ipcMain.on('defer-timeout',function (event, arg) {
        if(voteOngoing) {
            deferTimeout();
        }
    });
};

exports.receiveVoter = function(voter_data) {
    queue.push(voter_data);

    if(!voteOngoing) {
        acceptNextVote();
    }
};

function dismissInstructions() {
    i = 0;
    win.loadURL("http://localhost:7000/vote/" + vtypes[i]);
    resetInactivityTimer();
}

function resetInactivityTimer() {
    clearTimeout(timeoutTimer);
    clearTimeout(warningTimer);
    timeoutTimer = setTimeout(function() {
        // Show warning
        win.webContents.send("timeout-warning");

        warningTimer = setTimeout(function() {
            cancelVotingProcess();
        }, INACTIVITY_WARNING_TIMEOUT);
    }, INACTIVITY_TIMEOUT);
}

function deferTimeout() {
    resetInactivityTimer();
}

function cancelVotingProcess() {
    // Stop voting process
    voteOngoing = false;
    win.loadURL("http://localhost:7000/");
}

function castVote(vote_type, candidate_no) {
    console.log("Vote casted");
    deferTimeout();
    if(vtypes.includes(vote_type)) {
        vote_data[vote_type] = candidate_no;

        if(i < vtypes.length - 1) {
            // There is/are unvoted voting type
            i++;
            win.loadURL("http://localhost:7000/vote/" + vtypes[i]);
        } else {
            // Cast vote
            voteOngoing = false;
            clearTimeout(timeoutTimer);
            clearTimeout(warningTimer);
            finalizeVote(vote_data);

            win.loadURL("http://localhost:7000/finished");

            // Accept next vote in 10s
            setTimeout(acceptNextVote, 10000);
        }
    }
}

/**
 * Finalize vote
 * Update the database and publish vote casted message
 * @param data voting JSON object [{"type": <type>,"candidate_no":<number>}]
 * @returns true if succeed
 */
function finalizeVote(data){
    try {
        let objret = VoteSys.createVotePayload(data);

        let votePayload = objret['votePayload'];
        let sigData = objret['lastHashPayload'];

        let nodeId = database.getConfig("node_id");

        let voteCastedData = {
            "node_id": nodeId,
            "request_id": voterData.request_id,
            "voter_nim": voterData.voter_nim,
            "vote_payload": {
                "previous_signature": votePayload['previous_hash'],
                "node_id": nodeId,
                "vote_id": votePayload['vote_id'],
                "voted_candidate": votePayload['vote_data'],
                "signature": votePayload['current_hash']
            },
            "last_signature": {
                "node_id": nodeId,
                "last_signature": sigData['last_hash'],
                "signature": sigData['last_hash_hmac']
            }
        };

        Messaging.publish(Messaging.EX_VOTE_CASTED, '', JSON.stringify(voteCastedData), null);

        database.performVoteDataUpdate(database.getConfig("node_id"), voteCastedData['vote_payload']);
        database.performSigDataUpdate(database.getConfig("node_id"), voteCastedData['last_signature']);
        database.updatePersonData(voterData.voter_nim,"voted",1);

        VoteSys.commitVotePayload();

        return true;

    } catch (e) {
        console.error(e.message);
        return false;
    }
}

function acceptNextVote() {
    if(queue.length > 0) {
        let voter_data = queue.shift();

        Messaging.sendToQueue(voter_data.reply, JSON.stringify({
            node_id: Database.getConfig("node_id"),
            request_id: voter_data.request_id
        }));

        i = 0;
        vote_data = {};
        voterData = voter_data;

        voteOngoing = true;

        win.loadURL("http://localhost:7000/ins?name=" + voter_data.voter_name + "&nim=" + voter_data.voter_nim);

        resetInactivityTimer();
    }
}