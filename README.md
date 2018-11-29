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
To pass arguments to the app, run it using standard electron
```
./node_modules/.bin/electron . --help
```

## Configuration

### Initialization

Sample config can be found in `sample_manifest.json`
```
{
  "node_id": "tps01",
  "origin_hash": "abcdefghijklmn",
  "voting_name": "Pemilihan Umum HMIF 2019",
  "logo_url": "LOGO_URL",
  "background_url": "BACKGROUND_URL",
  "color": {
    "primary": "#eeeeee",
    "accent": "#eeeeee",
    "text_dark": "#000000",
    "text_light": "#ffffff"
  },
  "voting_types": [
    {
      "type": "kahim",
      "title": "Ketua himpunan"
    }
  ],
  "voters": [
    {
      "name": "Joni",
      "nim": "13517999"
    },
    {
      "name": "Toni",
      "nim": "18217999"
    }
  ],
  "candidates": [
    {
      "candidate_no": "1",
      "name": "Budi",
      "nim":13516999,
      "image_url": "IMAGE_URL1",
      "voting_type": "kahim"
    },
    {
      "candidate_no": "2",
      "name": "Badu",
      "nim":18217999,
      "image_url": "IMAGE_URL2",
      "voting_type": "kahim"
    }
  ]
}
```

### Authentication

Sample manifest can be found in `sample_auth.json`
```
{
  "node_id" : "tps01",
  "amqp_url": <url>,
  "machine_key" : "test_key"
}
```

<!--
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
-->
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