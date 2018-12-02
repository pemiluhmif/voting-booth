#!/usr/bin/env node
'use strict';
const inquirer = require('inquirer');
var fs = require('fs-extra');
const assets_dir = "src/static/assets";
var syncHttp = require('sync-request');
const uuid4 = require('uuid4');

console.log("Pemilu HMIF Build Customizer\n");

var questions = [
    {
        type: 'input',
        name: 'manifest_filepath',
        message: "Specify manifest file path:"
    }];

inquirer.prompt(questions).then(answers => {
    console.log("Reading manifest...");
    let manifest_string = fs.readFileSync(answers['manifest_filepath'], 'utf8');
    let manifest = JSON.parse(manifest_string);

    // Delete assets directory, if any
    if (fs.existsSync(assets_dir))
        fs.removeSync(assets_dir);

    fs.mkdirSync(assets_dir);

    // Download logo
    let logoUrl = manifest.logo_url;
    let logoFilename = saveFile("logo", logoUrl);
    manifest.logo_url = "/assets/" + logoFilename;

    // Download background
    let backgroundUrl = manifest.background_url;

    let bgFilename = saveFile("bg", backgroundUrl);
    manifest.background_url = "/assets/" + bgFilename;

    // For each candidate, download image
    for(let i = 0; i < manifest.candidates.length; i++) {
        let cpfilename = saveFile("candidate_" + i, manifest.candidates[i].image_url);
        manifest.candidates[i].image_url = "/assets/" + cpfilename;
    }

    // Write file
    fs.writeFileSync("init_param.js", "exports.init_config = " + JSON.stringify(manifest));
});

function saveFile(file_prefix, url) {
    console.log("Downloading " + url + "...");
    let res = syncHttp('GET', url);

    let filename = file_prefix + "_" + getFileName(url);
    fs.writeFileSync(assets_dir + "/" + filename, res.body);

    return filename;
}

function getFileName(url) {
    //this removes the anchor at the end, if there is one
    url = url.substring(0, (url.indexOf("#") == -1) ? url.length : url.indexOf("#"));
    //this removes the query after the file name, if there is one
    url = url.substring(0, (url.indexOf("?") == -1) ? url.length : url.indexOf("?"));
    //this removes everything before the last slash in the path
    url = url.substring(url.lastIndexOf("/") + 1, url.length);

    return url;
}