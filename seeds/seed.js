require('dotenv').config()
const connection = require('../config/connection');
const { Odds } = require('../models');
const axios = require('axios')


connection.on('error', (err) => err);

connection.once('open', async () => {
    console.log("DB CONNECTED ---- STARTING SEED")
    let sports = ["basketball_nba", "americanfootball_nfl", "icehockey_nhl", "soccer_epl"]
    let events = []
    await Odds.deleteMany()
    await axios.all(sports.map((sport) =>
    axios.get(`https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${process.env.API_KEY}&regions=us&oddsFormat=american&markets=h2h,spreads,totals`)
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

