const database = require('../../database');

module.exports = (app) => {
    app.get('/', (req, res) => {
        res.render('home.ejs');
    });

    let votes = database.getConfig("voting_types");

    votes.forEach(data => {
        data.candidates = database.getCandidates(data.type);
        app.get(`/${data['type']}`, (req, res) => {
            res.render('voter.ejs', {data});
        })
    });


};