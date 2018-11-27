/**
 * Database layer
 *
 * @author Muhammad Aditya Hilmy, NIM 18217025
 * @author Joshua C. Randiny
 */

const sqlite3 = require('sqlite3');
const fs = require('fs');

var db = null;

var nodeId = null;
var machineKey = null;
var RSAkey = null;
var originHash = null;

/**
 * Initializes database object
 * Load SQLite database
 * @param dbUrl SQLite database URL
 * @param cbfunc callback function when done
 */
exports.init = function(dbUrl,cbfunc) {
    db = new sqlite3.Database(dbUrl,(err)=>{
        if(err){
            console.error(err.message);
            cbfunc('loadDbDone',false,err.message);
        }else{
            console.log("Sukses");
            cbfunc('loadDbDone',true,'');
        }
    });


};

exports.setupTable = function(cbfunc) {
    if(initKey(cbfunc)){
        initTable();
    }
};

exports.loadJSON = function(fileName){
    return fs.readFileSync(fileName);
};

function generateSig(data){
    if(RSAkey!=null){
        return RSAkey.sign(data);
    }else{
        console.error("Key not loaded");
    }
}

function initTable(){
    console.log("Setting up table");

    db.run(`CREATE TABLE IF NOT EXISTS vote_record (
    	vote_id INTEGER NOT NULL,
        node_id TETX NOT NULL,
        previous_signature BLOB NOT NULL,
        voted_candidate INTEGER NOT NULL,
        signature BLOB NOT NULL
    );
    `);

    db.serialize(()=>{
        db.run(`CREATE TABLE IF NOT EXISTS last_signature (
        node_id TEXT NOT NULL,
        last_signature BLOB NOT NULL,
        last_signature_signature BLOB NOT NULL
        );
        `);

        db.get("SELECT Count(*) FROM last_signature", (err, row) => {
            var dbCount = 0;

            if (err) {
                console.error(err.message);
            }else {
                dbCount = row['Count(*)'];
                if(dbCount==0){
                    console.log("Empty last_signature, inserting origin")
                    /* INSERT ORIGIN */
                    db.run(`INSERT INTO
                    last_signature(node_id,last_signature,last_signature_signature) 
                    VALUES(?,?,?)`,[nodeId,originHash,generateSig(originHash)]);
                }
            }
        });
    });
}

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
exports.loadInitManifest = function(initDataRaw,cbfunc) {
    // TODO persists
    if(db!=null){
        db.serialize(()=>{
            db.run(`DROP TABLE IF EXISTS config;`);
            db.run(`CREATE TABLE config (
                "key" TEXT NOT NULL,
                value TEXT NOT NULL
            );`);

            db.run('DROP TABLE IF EXISTS voters');
            db.run(`CREATE TABLE IF NOT EXISTS voters (
                nim INTEGER NOT NULL,
                name TEXT NOT NULL,
                last_queued TIMESTAMP,
                voted INTEGER DEFAULT 0 NOT NULL,
                last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
            );
            `);

            db.run('DROP TABLE IF EXISTS voting_types');
            db.run(`CREATE TABLE IF NOT EXISTS voting_types (
                type  TEXT NOT NULL,
                title TEXT NOT NULL
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
                stmt.run(data['type'],data['title']);
            }

            stmt.finalize();

            console.log("done voting_types");

            cbfunc('initJSONDone',true,'');

        });

    }else{
        cbfunc('initJSONDone',false,'Database not initialized');
    }
};

/**
 * Load Authorization Manifest
 * @param JSONdata authorization manifest JSON object
 */
exports.loadAuthorizationManifest= function(JSONdata,cbfunc){
    let JSONcontent = JSON.parse(JSONdata);
    if(nodeId!=JSONcontent["node_id"]){
        console.error(`Node id doesn't match`);
        cbfunc('initAuthDone',false,`Node id doesn't match`);
    }else{
        machineKey = JSONcontent['machine_key'];
        // TODO Set amqp url
        cbfunc('initAuthDone',true,'');
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
 */
exports.performVoteDataUpdate = function(node_id, vote_records) {
    /* TODO perform data update.
     * Data coming in from this method belongs to an individual node, one at a time.
     * If a record of the same vote_id exists, prioritize the data coming from the node of which the data is generated.
     */

};

/**
 * Update person data
 * @param node_id node ID the data coming from
 * @param person_records JSON of vote records
 */
exports.performPersonDataUpdate = function(node_id, person_records) {
    /* TODO perform data update.
     * Data coming in from this method belongs to an individual node, one at a time.
     * If a record of the same NIM exists, prioritize the most recent data
     */


};