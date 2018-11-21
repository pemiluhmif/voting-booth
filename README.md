# voting-booth

## Getting Started

### Requirements
First, you need to install these:
- [NodeJS](https://nodejs.org/en/)
- [NPM](https://www.npmjs.com/)

### Installation
You need to install all of the dependencies required. It can be done with `npm`, by typing this command
```
npm install
```
If done, you can run the app by typing
```
npm start
```

## Configuration
This app supports multiple votes in one time. You need to set up the config file found on `src/config.js`. For example,
```
{
    name: 'Calon Kahim',
    route: 'vote-kahim',
    candidates: [
        {
            name: 'Candidate Name 1',
            nim: '1991XYYY',
            photo: "<some photo url>"
        },
        {
            name: 'Candidate Name 2',
            nim: '1991XYYY',
            photo: '<some photo url>'
        }
    ]
},
{
    name: 'Calon Senator',
    route: 'vote-senator'
}
```
Explanation:
- Attribute `name` is for the vote title
- Attribute `route` is for the page route
- Attribute `candidates` consists of individual candidate data with attributes `name`, `nim`, and `photo`

## Packaging The App
Run
```
npm run dist
```
On ubuntu, just type
```
./voting-booth
```
to run the app.

## Authors
IT Pemilu HMIF 2019