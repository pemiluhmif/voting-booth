let config = require('./../config');
let votes = config.votes;

module.exports = (app) => {
    app.get('/', (req, res) => {
        res.render('home.ejs');
    })
    votes.forEach(data => {
        app.get(`/${data.route}`, (req, res) => {
            res.render('voter.ejs', {data});
        })
    });
}