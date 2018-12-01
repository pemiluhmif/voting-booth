const database = require('../../database');

// TODO UI - home should be idle screen
module.exports = (app) => {
    app.get('/', (req, res) => {
        res.render('home.ejs');
    });

    app.get('/ins', (req, res) => {
        res.render('instructions.ejs', {"voter_name": req.query.name, "voter_nim": req.query.nim});
    });

    app.get('/finished', (req, res) => {
        res.render('thank.ejs');
    });

    let votes = database.getConfig("voting_types");

    votes.forEach(data => {
        data.candidates = database.getCandidates(data.type);
        app.get(`/vote/${data['type']}`, (req, res) => {
            res.render('voter.ejs', {data});
        })
    });
};