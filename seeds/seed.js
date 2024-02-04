require('dotenv').config()
const connection = require('../config/connection');
const { Odds } = require('../models');
const axios = require('axios')
const moment = require('moment')
const now = moment()


connection.on('error', (err) => err);

connection.once('open', async () => {
    console.log("DB CONNECTED ---- STARTING SEED")
    let sports = [{
        name: "basketball_nba",
        startMonth: 10,
        endMonth: 4,
        multiYear: true
    },
    {
        name: "americanfootball_nfl",
        startMonth: 9,
        endMonth: 1,
        multiYear: true
    },
    {
        name: "icehockey_nhl",
        startMonth: 10,
        endMonth: 4,
        multiYear: true
    },
    {
        name: "soccer_epl",
        startMonth: 8,
        endMonth: 5,
        multiYear: true
    },
    {
        name: "baseball_mlb",
        startMonth: 3,
        endMonth: 10,
        multiYear: false
    },  {
        name: "mma_mixed_martial_arts",
        startMonth: 12,
        endMonth: 12,
        multiYear: false
    }, {
        name: "soccer_usa_mls",
        startMonth: 2,
        endMonth: 10,
        multiYear: false
    },
]
    let searchSports = []
    let events = []
    sports.map((sport) => {
      if(sport.endMonth < sport.startMonth){ //if true, sport has multi year season
        if(now.month()+1 >= sport.startMonth || now.month()+1 <= sport.endMonth){
            searchSports.push(sport)
        }
      }else if(sport.startMonth === sport.endMonth){ // if true, sport is year round
        searchSports.push(sport)
      }else{ // else case covers single year seasons
        if(now.month()+1 <= sport.startMonth && now.month()+1 >= sport.endMonth){
            searchSports.push(sport)
        }
      }
    })

    await Odds.deleteMany()
    await axios.all(sports.map((sport) =>
    axios.get(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.API_KEY}&regions=us&oddsFormat=american&markets=h2h,spreads`)
    )).then(async (data) => {
        try {
            data.map(async (item) => {
                item.data.map((event) => {
                    events.push(event)
                })
            })
            await Odds.insertMany(events)
            console.info('Odds Seeding complete! 🌱');
        } catch (err) {
            if (err) throw (err)
        }

    })
    console.info('Full Seeding complete! 🌱');
    process.exit(0);
})

