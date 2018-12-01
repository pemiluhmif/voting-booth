/**
 * Database layer
 *
 * @author Muhammad Aditya Hilmy, NIM 18217025
 * @author Joshua C. Randiny
 */

const sqlite3 = require('better-sqlite3');
const fs = require('fs');
const crypto = require('crypto');

var db = null;

var nodeId = null;
var machineKey = null;
var originHash = null;
var amqpUrl = null;

/**
 * Initializes database object
 * Load SQLite database
 * @param dbUrl SQLite database URL
 */
exports.init = function(dbUrl) {
    try {
        db = new sqlite3(dbUrl);
        return {
            "status": true
        };
    } catch (err) {
        console.error(err.message);
        return {
            "status": false,
            "msg": err.message
        };
    }
};

/**
 * Setup table for first time use
 */
exports.setupTable = function() {
    console.log("Setting up table");

    try {
        db.exec('DROP TABLE IF EXISTS vote_record');
        db.exec(`CREATE TABLE vote_record (
            vote_id TEXT NOT NULL PRIMARY KEY,
            node_id TEXT NOT NULL,
            previous_signature BLOB NOT NULL,
            voted_candidate TEXT NOT NULL,
            signature BLOB NOT NULL
        );
        `);

        db.exec('DROP TABLE IF EXISTS last_signature');
        db.exec(`CREATE TABLE last_signature (
            node_id TEXT PRIMARY KEY NOT NULL,
            last_signature BLOB NOT NULL,
            last_signature_signature BLOB NOT NULL
            );
         `);

        db.prepare(`INSERT INTO
                        last_signature(node_id,last_signature,last_signature_signature) 
                        VALUES(?,?,?)`).run(nodeId, originHash, generateSig(originHash));

        return {
            "status":true
        }
    } catch (e) {
        return{
            "status":false,
            "msg":e.message
        }
    }
};

/**
 * Load JSON file
 * Note : Handle error on caller
 * @param fileName filename to be loaded
 */
exports.loadJSON = function(fileName){
    return fs.readFileSync(fileName);
};

/**
 * Get config from database or memory
 * @param key key to retrieve
 */
exports.getConfig = function (key) {
    if(db!=null){
        let stmt;
        let data;

        switch(key){
            case "amqp_url":
                return amqpUrl;
            case "machine_key":
                return machineKey;
            case "voting_types":
                stmt  = db.prepare("SElECT * FROM voting_types");
                data = stmt.all();
                if(data===undefined){
                    return null;
                }else {
                    return data;
                }
            default:
                stmt  = db.prepare("SElECT value FROM config WHERE key = ?");
                data = stmt.get(key);
                if(data===undefined){
                    return null;
                }else {
                    return data['value'];
                }
        }
    }else{
        console.error("DB not loaded");
        return null;
    }
};

exports.getLastSignature = function() {
    if(db!=null && nodeId!=null){
        let stmt  = db.prepare("SElECT last_signature FROM last_signature WHERE node_id = ?");
        let data = stmt.get(nodeId);
        if(data===undefined){
            return null;
        }else {
            return data['last_signature'];
        }
    }
};

exports.getCandidates = function (type) {
    let stmt  = db.prepare("SElECT * FROM candidates WHERE voting_type=?");
    let data = stmt.all(type);
    if(data===undefined){
        return null;
    }else {
        return data;
    }

};

exports.getVoters = function (nim) {
    let stmt  = db.prepare("SElECT * FROM voters WHERE nim=?");
    let data = stmt.get(nim);
    if(data===undefined){
        return null;
    }else {
        return data;
    }
};

/**
 * generate signature
 * @param input data to hash
 */
function generateSig(input) {
    let signer = crypto.createHmac('sha256', machineKey);
    return signer.update(input).digest('hex');
};

/**
 * Close the database connection
 */
exports.close = function() {
    db.close();
};

/**
 * Load Initialization Manifest and persists it to SQLite
 * @param initData initialization manifest JSON object
 */
exports.loadInitManifest = function(initDataRaw) {
    if(db!=null){
        db.exec(`DROP TABLE IF EXISTS config;`);
        db.exec(`CREATE TABLE config (
            "key" TEXT NOT NULL PRIMARY KEY,
            value TEXT NOT NULL
        );`);

        db.exec('DROP TABLE IF EXISTS voters');
        db.exec(`CREATE TABLE IF NOT EXISTS voters (
            nim INTEGER NOT NULL PRIMARY KEY,
            name TEXT NOT NULL,
            last_queued TIMESTAMP,
            voted INTEGER DEFAULT 0 NOT NULL,
            last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        `);

        db.exec('DROP TABLE IF EXISTS voting_types');
        db.exec(`CREATE TABLE IF NOT EXISTS voting_types (
            type  TEXT NOT NULL PRIMARY KEY,
            title TEXT NOT NULL
        );
        `);


        db.exec('DROP TABLE IF EXISTS candidates');
        db.exec(`CREATE TABLE IF NOT EXISTS candidates (
            candidate_no INTEGER NOT NULL,
            voting_type TEXT NOT NULL,
            name TEXT NOT NULL,
            NIM INTEGER NOT NULL,
            image_file_path TEXT NOT NULL,
            PRIMARY KEY (candidate_no, voting_type)
        );
        `);

        console.log("Trying to load JSON config");

        let initData = JSON.parse(initDataRaw);

        console.log(initData);

        var stmt = db.prepare("INSERT INTO config VALUES (?,?)");

        // Node id
        nodeId = initData['node_id'];
        stmt.run('node_id',nodeId);

        // origin hash
        originHash = initData['origin_hash'];
        stmt.run('origin_hash',originHash);

        // voting name
        stmt.run('voting_name',initData['voting_name']);

        // background url
        stmt.run('background_url',initData['background_url']);

        // logo_url
        stmt.run('logo_url',initData['logo_url']);

        // color
        stmt.run('color',JSON.stringify(initData['color']));


        console.log("done config");


        stmt = db.prepare("INSERT INTO voters (nim,name,last_queued) VALUES (?,?,null)");

        for (var key in initData['voters']) {
            let data = initData['voters'][key];

            stmt.run(data['nim'],data['name']);
        }

        console.log("done voters");

        stmt = db.prepare("INSERT INTO voting_types VALUES (?,?)");

        for (var key in initData['voting_types']) {
            let data = initData['voting_types'][key];
            stmt.run(data['type'], data['title']);
        }

        console.log("done voting_types");

        stmt = db.prepare("INSERT INTO candidates VALUES (?,?,?,?,?)");

        for (var key in initData['candidates']) {
            let data = initData['candidates'][key];
            stmt.run(data['candidate_no'],
                data['voting_type'],
                data['name'],
                data['nim'],
                data['image_url']);
        }

        console.log("done candidates");

        return {
            "status": true
        };
    }else{
        return {
            "status": false,
            "msg": "Database not initialized"
        };
    }
};

/**
 * Load Authorization Manifest
 * @param JSONdata authorization manifest JSON object
 */
exports.loadAuthorizationManifest= function(JSONdata){
    let JSONcontent = JSON.parse(JSONdata);
    if(nodeId==null){
        nodeId = this.getConfig("node_id");
    }
    if(nodeId!==JSONcontent["node_id"]){
        console.error(`Node id doesn't match`);
        return {
            "status": false,
            "msg": "Node id doesn't match"
        };
    }else{
        machineKey = JSONcontent['machine_key'];
        amqpUrl = JSONcontent['amqp_url'];

        return {
            "status": true
        };
    }
};

/**
 * Loads machine key to memory
 * @param machine_key machine key
 */
exports.authorize = function(machine_key) {
    machineKey = machine_key;
    // TODO do authorize
};

/**
 * Update vote data
 * @param node_id node ID the data coming from
 * @param vote_records JSON of vote records
 * @param signature_records JSON of signature records
 */
exports.performVoteDataUpdate = function(node_id, vote_records) {
    /* Data coming in from this method belongs to an individual node, one at a time.
     * If a record of the same vote_id exists, prioritize the data coming from the node of which the data is generated.
     */

    let stmtCount = db.prepare("SELECT * FROM vote_record WHERE vote_id = ?");
    let stmtInsert = db.prepare("INSERT INTO vote_record VALUES (?,?,?,?,?)");
    let stmtUpdate = db.prepare("UPDATE vote_record SET node_id = ?, previous_signature = ?, voted_candidate = ?, signature = ? WHERE vote_id = ?");

    let transaction = db.transaction((dataInsert)=>{
        let voteData = stmtCount.get(dataInsert['vote_id']);
        if(voteData===undefined){
            stmtInsert.run(dataInsert['vote_id'],
                dataInsert['node_id'],
                dataInsert['previous_signature'],
                dataInsert['voted_candidate'],
                dataInsert['signature']);
        }else{
            if(node_id === dataInsert['node_id']){
                stmtUpdate.run(dataInsert['node_id'],
                    dataInsert['previous_signature'],
                    dataInsert['voted_candidate'],
                    dataInsert['signature'],
                    dataInsert['vote_id']);
            }
        }
    });

    transaction(vote_records);
};

exports.performSigDataUpdate = function(node_id,sigData){
    let stmtUpdateSig = db.prepare(`INSERT OR REPLACE INTO last_signature (node_id, last_signature, last_signature_signature) VALUES (  ?, ?, ? );`);

    let transaction = db.transaction((sigInsert)=>{
        stmtUpdateSig.run(sigInsert['node_id'],
            sigInsert['last_signature'],
            sigInsert['signature']);
    });

    transaction(sigData);

};

/**
 * Update person data (all)
 * @param node_id node ID the data coming from
 * @param person_records JSON of vote records
 */
exports.performPersonDataUpdate = function(node_id, person_records) {
    /* Data coming in from this method belongs to an individual node, one at a time.
     * If a record of the same NIM exists, prioritize the most recent data
     */

    console.log("update person");
    let stmtCount = db.prepare("SELECT * FROM voters WHERE nim = ?");
    let stmtInsert = db.prepare("INSERT INTO voters VALUES (?,?,?,?,?)");
    let stmtUpdate = db.prepare("UPDATE voters SET name = ?, last_queued = ?, voted = ?, last_modified = ? WHERE nim = ?");

    let transaction = db.transaction((dataInsert)=>{
        let voteData = stmtCount.get(dataInsert['nim']);

        if(voteData===undefined){
            stmtInsert.run(dataInsert['nim'],
                dataInsert['name'],
                dataInsert['last_queued'],
                dataInsert['voted'],
                dataInsert['last_modified']);
        }else{
            let voteDate = new Date(voteData['last_modified'] );
            let dataDate = new Date(dataInsert['last_modified']);
            if(voteDate < dataDate){
                stmtUpdate.run(dataInsert['name'],
                    dataInsert['last_queued'],
                    dataInsert['voted'],
                    dataInsert['last_modified'],
                    dataInsert['nim']);
            }
        }
    });

    transaction(person_records);

};

/**
 * Update person data (specific key)
 * @param nim node ID the data coming from
 * @param key key to change
 * @param data new data for key
 */
exports.updatePersonData = function (nim,key,data) {
    let stmt;

    switch (key) {
        case "last_queued":
            stmt = db.prepare('UPDATE voters SET last_queued = ? WHERE nim = ?');
            stmt.run(data,nim);
            break;
        case "voted":
            stmt = db.prepare('UPDATE voters SET voted = ? WHERE nim = ?');
            stmt.run(data,nim);
            break;
    }
};