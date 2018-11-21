'use strict';

const express = require('express');
const path = require('path');
const routes = require('./routes/routes');

let staticPath = path.join(__dirname, '/static/');
let app = express();

// point for static assets
app.use(express.static(staticPath));
console.log(staticPath);

// view engine setup
app.set('views', path.join(__dirname, '/views/'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

// Set routes
routes(app);

app.listen(7000, function() {
    console.log('Express is running on port 7000');
})

module.exports = app;