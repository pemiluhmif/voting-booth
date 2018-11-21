module.exports = (app) => {
    // Index
    app.get('/', (req, res) => {
        res.render('index.ejs');
    })
}