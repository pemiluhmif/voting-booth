/**
 * Vote payload abstraction
 *
 * @author Muhammad Aditya Hilmy, NIM 18217025
 */

const uuid4 = require('uuid4');
const crypto = require('crypto');

var machineKey;
var latestHash;

var tempLatestHash;

/**
 * Initialize vote payload abstraction
 * @param latest_hash Latest hash
 * @param machine_key machine AES key
 */
exports.init = function(latest_hash, machine_key) {
    latestHash = latest_hash;
    machineKey = machine_key;
};

/**
 * Create vote payload
 * @param data object, with the key being the voting type and the value being the candidate no
 *        e.g. {'kahim':3, 'senator':2}
 * @returns an object containing the vote payloads:
 *              vote data (in JSON string), the previous hash, the current hash,
 *          and the Last Hash payloads:
 *              last hash and its HMAC using Machine Key
 */
exports.createVotePayload = function(data) {
    let vote_id = uuid4();

    // Append previous hash and generate vote ID to vote data
    let vpayload = {
        previous_hash: latestHash,
        vote_data: data,
        vote_id: vote_id
    };

    let vpayloadstr = JSON.stringify(vpayload);
    let vpayloadhash = crypto.createHash('sha256').update(vpayloadstr).digest('hex');
    let objret = {};
    objret.votePayload = {
        vote_data: vpayloadstr,
        previous_hash: latestHash,
        current_hash: vpayloadhash,
        vote_id: vote_id
    };

    objret.lastHashPayload = {
        last_hash: vpayloadhash,
        last_hash_hmac: crypto.createHmac('sha256', machineKey).update(vpayloadhash).digest('hex')
    };

    tempLatestHash = vpayloadhash;

    return objret;
};

/**
 * Acknowledge that the vote_id is published and stored, and update the latestHash to be the commited hash
 */
exports.commitVotePayload = function() {
    if(tempLatestHash !== undefined) {
        latestHash = tempLatestHash;
    }
};