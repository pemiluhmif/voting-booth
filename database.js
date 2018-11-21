/**
 * Database layer
 *
 * @author Muhammad Aditya Hilmy, NIM 18217025
 * @author Joshua C. Randiny
 */

var nodeId = null;
var nodeType = null;
var machineKey = null;
var originHash = null;
var dbUrl = null;

/**
 * Initializes database object
 * Load SQLite database
 * @param dbUrl SQLite database URL
 */
exports.init = function(dbUrl) {
    // TODO load database and all necessary resources
};

/**
 * Load Initialization Manifest and persists it to SQLite
 * @param initData initialization manifest JSON object
 */
exports.loadInitManifest = function(initData) {
    // TODO persists
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