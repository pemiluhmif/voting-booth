/**
 * Database layer
 *
 * @author Muhammad Aditya Hilmy, NIM 18217025
 */

var amqp = require('amqplib/callback_api');
var nodeId = null;
var amqpConn;
var nodeType = null;
var amqpCh;

const EX_NODE_UPDATED = "node_updated";
const EX_PING = "ping";
const EX_HEARTBEAT = "heartbeat";
const EX_VOTER_QUEUED = "voter_queued";
const EX_VOTER_QUEUED_SHARED = "voter_queued_shared";
const EX_VOTER_SERVED = "voter_served";
const EX_VOTE_CASTED = "vote_casted";

const EX_REQUEST_DATA_BROADCAST = "request_data_broadcast";
const EX_VOTE_DATA_REPLY = "vote_data_reply";
const EX_PERSON_DATA_REPLY = "person_data_reply";

const NODE_TYPE_REGDESK = "regdesk";
const NODE_TYPE_VOTING_BOOTH = "voting_booth";

exports.EX_NODE_JOINED = EX_NODE_UPDATED;
exports.EX_PING = EX_PING;
exports.EX_HEARTBEAT = EX_HEARTBEAT;
exports.EX_VOTER_QUEUED = EX_VOTER_QUEUED;
exports.EX_VOTER_QUEUED_SHARED = EX_VOTER_QUEUED_SHARED;
exports.EX_VOTER_SERVED = EX_VOTER_SERVED;
exports.EX_VOTE_CASTED = EX_VOTE_CASTED;
exports.EX_REQUEST_DATA_BROADCAST = EX_REQUEST_DATA_BROADCAST;
exports.EX_VOTE_DATA_REPLY = EX_VOTE_DATA_REPLY;
exports.EX_PERSON_DATA_REPLY = EX_PERSON_DATA_REPLY;

exports.NODE_TYPE_REGDESK = NODE_TYPE_REGDESK;
exports.NODE_TYPE_VOTING_BOOTH = NODE_TYPE_VOTING_BOOTH;

var listeners = [];

exports.init = function(nid, ntype) {
    nodeId = nid;
    nodeType = ntype;
};

exports.connect = function(url, callback) {
    if(nodeId != null) {
        amqp.connect(url, function (err, conn) {
            conn.createChannel(function (err, ch) {
                assertExchanges(ch);
                if(callback != null) callback();

                // Publish node status
                exports.publish(EX_NODE_UPDATED, '', JSON.stringify({'node_id': nodeId, 'node_type': nodeType, 'status': 'JOIN'}));
            });

            amqpConn = conn;
        });
    } else {
        throw "Node is not initialized";
    }
};

exports.close = function() {
    if(amqpConn !== undefined) {
        this.publish(EX_NODE_UPDATED, JSON.stringify({'node_id': nodeId, 'node_type': nodeType, 'status': 'LEAVE'}), function() {
            amqpConn.close();
        });
    }
};

function assertExchanges(ch) {
    amqpCh = ch;
    assertNodeManagementExchanges(ch);
    assertDataManagementExchanges(ch);

    /**
     * Voter served queue
     * Message published when a voting booth accepts a vote request, as a reply.
     * The node publishing the original vote request message will show the serving node ID to the screen
     */

    if(nodeType === NODE_TYPE_REGDESK) {
        ch.assertQueue(buildQueueName(EX_VOTER_SERVED), {durable: true, exclusive: false}, function (err, q) {
            ch.consume(q.queue, function (msg) {
                //console.log(" [x] %s", msg.content.toString());
                let callback = listeners[EX_VOTER_SERVED];
                if (callback !== undefined)
                    callback(msg, ch);
            }, {noAck: true});
        });
    }

    /**
     * Voter queued exchange
     * Message published when a voter is queued in the registration desk
     * There will be N+1 queues, where N is the number of nodes
     * Every node will have its own VOTER_QUEUED queue to keep track of when the voter is queued in each databases
     * The voting booth nodes will have a shared VOTER_QUEUED queue to determine which voting booth should be activated
     */
    ch.assertExchange(EX_VOTER_QUEUED, 'topic', {durable: true});

    ch.assertQueue(buildQueueName(EX_VOTER_QUEUED), {durable: true, exclusive: false}, function (err, q) {
        ch.bindQueue(q.queue, EX_VOTER_QUEUED);
        ch.consume(q.queue, function(msg) {
            //console.log(" [x] %s", msg.content.toString());
            let callback = listeners[EX_VOTER_QUEUED];
            if(callback !== undefined)
                callback(msg, ch);
        }, {noAck: true});
    });

    if(nodeType === NODE_TYPE_VOTING_BOOTH) {
        // In voting booth, build a shared Queue
        ch.assertQueue(EX_VOTER_QUEUED_SHARED, {durable: true, exclusive: false}, function (err, q) {
            ch.bindQueue(q.queue, EX_VOTER_QUEUED);
            // No auto acknowledge, since voting can take a long time (machine wise)
            ch.consume(q.queue, function(msg) {
                // console.log(" [x] %s", msg.content.toString());
                let callback = listeners[EX_VOTER_QUEUED_SHARED];
                if(callback !== undefined)
                    callback(msg, ch);
            }, {noAck: false});
        });
    }

    /**
     * Vote casted exchange
     * Message published when a vote is casted
     * Every node keeps track of the votes
     */
    ch.assertExchange(EX_VOTE_CASTED, 'topic', {durable: true});
    ch.assertQueue(buildQueueName(EX_VOTE_CASTED), {durable: true, exclusive: true}, function (err, q) {
        ch.bindQueue(q.queue, EX_VOTE_CASTED, '');

        // No auto acknowledge, since delivery is important
        ch.consume(q.queue, function (msg) {
            //console.log(" [x] %s", msg.content.toString());
            let callback = listeners[EX_VOTE_CASTED];
            if (callback !== undefined)
                callback(msg, ch);
        }, {noAck: false});
    });


}

function assertNodeManagementExchanges(ch) {
    // Assert exchanges
    ch.assertExchange(EX_NODE_UPDATED, 'topic', {durable: false});
    ch.assertExchange(EX_PING, 'topic', {durable: false});
    ch.assertExchange(EX_HEARTBEAT, 'topic', {durable: false});

    // Assert queues
    ch.assertQueue(buildQueueName(EX_NODE_UPDATED), {durable: false, exclusive: true}, function(err, q) {
        ch.bindQueue(q.queue, EX_NODE_UPDATED, '');

        ch.consume(q.queue, function(msg) {
            //console.log(" [x] %s", msg.content.toString());
            let callback = listeners[EX_NODE_UPDATED];
            if(callback !== undefined)
                callback(msg, ch);
        }, {noAck: true});
    });

    ch.assertQueue(buildQueueName(EX_PING), {durable: false, exclusive: true}, function(err, q) {
        ch.bindQueue(q.queue, EX_PING, '');

        ch.consume(q.queue, function(msg) {
            //console.log(" [x] %s", msg.content.toString());
            let callback = listeners[EX_PING];
            if(callback !== undefined)
                callback(msg, ch);

            ch.sendToQueue(buildQueueName(EX_HEARTBEAT), new Buffer({'nodeId': nodeId, 'nodeType': nodeType}));
        }, {noAck: true});
    });

    ch.assertQueue(buildQueueName(EX_HEARTBEAT), {durable: false, exclusive: true}, function(err, q) {
        ch.bindQueue(q.queue, EX_HEARTBEAT, '');

        ch.consume(q.queue, function(msg) {
            //console.log(" [x] %s", msg.content.toString());
            let callback = listeners[EX_HEARTBEAT];
            if(callback !== undefined)
                callback(msg, ch);
        }, {noAck: true});
    });
}

function assertDataManagementExchanges(ch) {
    ch.assertExchange(EX_REQUEST_DATA_BROADCAST, 'topic', {durable: false});

    ch.assertQueue(buildQueueName(EX_REQUEST_DATA_BROADCAST), {durable: true, exclusive: true}, function(err, q) {
        ch.bindQueue(q.queue, EX_REQUEST_DATA_BROADCAST, '');

        ch.consume(q.queue, function(msg) {
            //console.log(" [x] %s", msg.content.toString());
            let callback = listeners[EX_REQUEST_DATA_BROADCAST];
            if(callback !== undefined)
                callback(msg, ch);
        }, {noAck: true});
    });

    ch.assertExchange(EX_VOTE_DATA_REPLY, 'topic', {durable: false});

    ch.assertQueue(buildQueueName(EX_VOTE_DATA_REPLY), {durable: true, exclusive: true}, function(err, q) {
        ch.bindQueue(q.queue, EX_VOTE_DATA_REPLY, '');

        ch.consume(q.queue, function(msg) {
            //console.log(" [x] %s", msg.content.toString());
            let callback = listeners[EX_VOTE_DATA_REPLY];
            if(callback !== undefined)
                callback(msg, ch);
        }, {noAck: true});
    });

    ch.assertExchange(EX_PERSON_DATA_REPLY, 'topic', {durable: false});

    ch.assertQueue(buildQueueName(EX_PERSON_DATA_REPLY), {durable: true, exclusive: true}, function(err, q) {
        ch.bindQueue(q.queue, EX_PERSON_DATA_REPLY, '');

        ch.consume(q.queue, function(msg) {
            //console.log(" [x] %s", msg.content.toString());
            let callback = listeners[EX_PERSON_DATA_REPLY];
            if(callback !== undefined)
                callback(msg, ch);
        }, {noAck: true});
    });
}

function buildQueueName(exName) {
    return exName + ":" + nodeId;
}

exports.setMessageListener = function(queue, callback) {
    listeners[queue] = callback;
};


exports.publish = function(exchange, queue, msg, callback) {
    if(amqpCh !== undefined) {
        amqpCh.publish(exchange, queue, Buffer.from(msg), {}, function () {
            if(callback !== undefined) callback();
        });

        console.log(" [x] Sent to exchange %s", exchange);
    }
};

exports.sendToQueue = function(queueName, msg, callback) {
    if(amqpCh !== undefined) {
        amqpCh.sendToQueue(queueName, Buffer.from(msg), {}, function () {
            if(callback !== undefined) callback();
        });

        console.log(" [x] Sent to queue %s", queueName);
    }
};

exports.getQueueName = function(exName) {
    return buildQueueName(exName);
};