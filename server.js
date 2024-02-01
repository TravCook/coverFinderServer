const express = require('express')
require('dotenv').config()
const cors = require('cors')
const cron = require('node-cron')
const { Odds } = require('./models');
const axios = require('axios')
const path = require('path')
const routes = require('./routes');
const db = require('./config/connection')
// Initialize the app and create a port
const app = express();
const PORT = process.env.PORT || 3001;
// Set up body parsing, static, and route middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use(cors())

app.use(express.static(path.join(__dirname, '../client/build')));

app.use(routes);

const dbCron =  () => {
    cron.schedule('* */6 * * *', async () => {
        console.log("CRON JOB REPEAT")
            console.log("DB CONNECTED ---- STARTING SEED")
            let sports = ["basketball_nba", "americanfootball_nfl", "icehockey_nhl", "football_epl"]
            let events = []
            await Odds.deleteMany({})
            await axios.all(sports.map((sport) =>
            axios.get(`https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${process.env.API_KEY}&regions=us&oddsFormat=american&markets=h2h,spreads,totals`)
            )).then(async (data) => {
                try {
                    data.map(async (item) => {
                        console.log("item.data: ")
                        item.data.map((event) => {
                            events.push(event)
                        })
                    })
                    events.map((sport) => {
                        console.log(sport)
                    })
                    await Odds.collection.insertMany(events)
                    console.info('Odds Seeding complete! 🌱');
                } catch (err) {
                    if (err) throw (err)
                }
        
            })
            console.info('Full Seeding complete! 🌱');
    })
}     


// Start the server on the port
db.once('open', () => {
    // dbCron()
    app.listen(PORT, () => console.log(`Listening on PORT: ${PORT}`));
})