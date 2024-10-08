require('dotenv').config()
const connection = require('../config/connection');
const { Odds, Teams, PastGameOdds } = require('../models');
const axios = require('axios')
const moment = require('moment')
const cheerio = require('cheerio');
const pastGameOdds = require('../models/pastGameOdds');
const now = moment()

const dataSeed = async () => {
    console.log('starting seed')
    connection.on('error', (err) => err);

    // connection.once('open', async () => {

    // DETERMINE SPORTS
    console.log("DB CONNECTED ---- STARTING SEED")
    let sports = [
        {
            name: "americanfootball_nfl",
            espnSport: 'football',
            league: 'nfl',
            startMonth: 9,
            endMonth: 1,
            multiYear: true,
            statYear: 2024
        },
        {
            name: "americanfootball_ncaaf",
            espnSport: 'football',
            league: 'college-football',
            startMonth: 9,
            endMonth: 1,
            multiYear: true,
            statYear: 2024
        },
        {
            name: "basketball_nba",
            espnSport: 'basketball',
            league: 'nba',
            startMonth: 10,
            endMonth: 4,
            multiYear: true,
            statYear: 2024
        },
        {
            name: "icehockey_nhl",
            espnSport: 'hockey',
            league: 'nhl',
            startMonth: 10,
            endMonth: 4,
            multiYear: true,
            statYear: 2024
        },
        {
            name: "baseball_mlb",
            espnSport: 'baseball',
            league: 'mlb',
            startMonth: 3,
            endMonth: 10,
            multiYear: false,
            statYear: 2024
        },
    ]
    // DETERMINE TEAMS
    console.log(`BEGINNING TEAM SEEDING @ ${moment().format('HH:mm:ss')}`)
    await Teams.deleteMany()

    for (i = 0; i < sports.length; i++) {
        // DETERMINE SPORT
        let teams = []
        if (sports[i].name === 'americanfootball_ncaaf') {
            // RETRIEVE LIST OF TEAMS
            const TeamListresponse = await fetch(`https://api.collegefootballdata.com/teams/fbs?year=2024`, {
                headers: {
                    "Authorization": `Bearer ${process.env.CFB_API_KEY}`,
                    "Accept": "application/json"
                }
            })
            const teamListjson = await TeamListresponse.json()
            teamListjson.map((team) => {
                let espnID = team.id
                let league = sports[i].league
                let location = team.location.city
                let teamName = team.mascot
                let abbreviation = team.abbreviation
                let school = team.school
                let logo = team.logos[0]
                let h2hIndex = 0
                let espnDisplayName = `${school} ${team.mascot}`
                h2hIndexUpdatedAt = now
                teams.push({ espnID, espnDisplayName, location, teamName, league, abbreviation, logo, h2hIndex, school })
            })
        } else {
            // RETRIEVE LIST OF TEAMS
            const TeamListresponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sports[i].espnSport}/${sports[i].league}/teams`)
            const teamListjson = await TeamListresponse.json()
            let teamList = teamListjson.sports[0].leagues[0].teams
            teamList.map((team) => {
                let league = sports[i].league
                let espnID = team.team.id
                let espnDisplayName = team.team.displayName
                let location = team.team.location
                let teamName = team.team.name
                let abbreviation = team.team.abbreviation
                let logo = team.team.logos[0].href
                let h2hIndex = 0
                h2hIndexUpdatedAt = now
                teams.push({ espnID, espnDisplayName, location, teamName, league, abbreviation, logo, h2hIndex })
            })
        }


        //RETRIEVE TEAM WIN LOSS RECORD
        for (x = 0; x < teams.length; x++) {
            const teamRecordResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/${sports[i].espnSport}/leagues/${sports[i].league}/seasons/${sports[i].statYear}/types/2/teams/${teams[i].espnID}/record?lang=en&region=us`)
            const teamRecordjson = await teamRecordResponse.json()
            teams[x] = {
                seasonWinLoss: teamRecordjson.items[0].displayValue,
                homeWinLoss: teamRecordjson.items[1].displayValue,
                awayWinLoss: teamRecordjson.items[2].displayValue,
                ...teams[x]
            }
        }


        // RETRIEVE TEAM BETTING STATS
        //UNDERDOG STATS
        if (sports[i].league !== 'nhl') {
            const dogRequest = await axios.get(`https://www.teamrankings.com/${sports[i].league}/trend/win_trends/is_dog?range=yearly_since_2021&sc=is_dog`, {
                headers: {
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4"
                }
            })
            const $dog = await cheerio.load(dogRequest.data)
            $dog('tr').each((i, elem) => {
                const team = $dog(elem).find('td:first-child').text()
                const winLossAsDog = $dog(elem).find('td:nth-child(2)').text()
                const winPAsDog = $dog(elem).find('td:nth-child(3)').text()
                teams.map((teamItem, idx) => {
                    if (teamItem.location === team) {
                        teams[idx] = {
                            winLossAsDog: winLossAsDog,
                            winPAsDog: winPAsDog,
                            ...teams[idx]
                        }
                    } else if (teamItem.teamName === team.split(' ')[1]) {
                        teams[idx] = {
                            winLossAsDog: winLossAsDog,
                            winPAsDog: winPAsDog,
                            ...teams[idx]
                        }
                    }
                })
            })

            // //FAVORITE STATS
            const favRequest = await axios.get(`https://www.teamrankings.com/${sports[i].league}/trend/win_trends/is_fav?range=yearly_since_2021&sc=is_fav`, {
                headers: {
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4"
                }
            })
            const $fav = await cheerio.load(favRequest.data)
            $fav('tr').each((i, elem) => {
                const team = $fav(elem).find('td:first-child').text()
                const winLossAsFav = $fav(elem).find('td:nth-child(2)').text()
                const winPAsFav = $fav(elem).find('td:nth-child(3)').text()
                teams.map((teamItem, idx) => {
                    if (teamItem.location === team) {
                        teams[idx] = {
                            winLossAsFav: winLossAsFav,
                            winPAsFav: winPAsFav,
                            ...teams[idx]
                        }
                    } else if (teamItem.teamName === team.split(' ')[1]) {
                        teams[idx] = {
                            winLossAsFav: winLossAsFav,
                            winPAsFav: winPAsFav,
                            ...teams[idx]
                        }
                    }
                })
            })
        }

        if (sports[i].espnSport === 'football') {
            // RETRIEVE TEAM SPECIFIC STATS
            for (m = 0; m < teams.length; m++) {
                const teamStatResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/football/leagues/${sports[i].league}/seasons/${sports[i].statYear}/types/2/teams/${teams[m].espnID}/statistics?lang=en&region=us`)
                const teamStatjson = await teamStatResponse.json()
                teams[m] = {
                    thirdDownConvRate: teamStatjson.splits.categories[10].stats[15].value,
                    yardsPerPlay: teamStatjson.splits.categories[2].stats[28].value + teamStatjson.splits.categories[1].stats[38].value,
                    ...teams[m]
                }
            }
            const ypgRequest = await axios.get(`https://www.teamrankings.com/${sports[i].league}/stat/opponent-yards-per-game`, {
                headers: {
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4"
                }
            })
            const $ypg = await cheerio.load(ypgRequest.data)
            $ypg('tr').each((i, elem) => {
                const index = $ypg(elem).find('td:first-child').text()
                const team = $ypg(elem).find('td:nth-child(2)').text()
                const yardsAllowedPerGame = $ypg(elem).find('td:nth-child(3)').text()

                teams.map((teamItem, idx) => {
                    if (teamItem.location === team || teamItem.school === team) {
                        teams[idx] = {
                            yardsAllowedPerGame: yardsAllowedPerGame,
                            ...teams[idx]
                        }
                    } else if (teamItem.teamName === team.split(' ')[1]) {
                        teams[idx] = {
                            yardsAllowedPerGame: yardsAllowedPerGame,
                            ...teams[idx]
                        }
                    }
                })
            })
            const giveawaysRequest = await axios.get(`https://www.teamrankings.com/${sports[i].league}/stat/giveaways-per-game`, {
                headers: {
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4"
                }
            })
            const $giveaways = await cheerio.load(giveawaysRequest.data)
            $giveaways('tr').each((i, elem) => {
                const index = $giveaways(elem).find('td:first-child').text()
                const team = $giveaways(elem).find('td:nth-child(2)').text()
                const giveawaysPerGame = $giveaways(elem).find('td:nth-child(3)').text()
                teams.map((teamItem, idx) => {
                    if (teamItem.location === team || teamItem.school === team) {
                        teams[idx] = {
                            giveawaysPerGame: giveawaysPerGame,
                            ...teams[idx]
                        }
                    } else if (teamItem.teamName === team.split(' ')[1]) {
                        teams[idx] = {
                            giveawaysPerGame: giveawaysPerGame,
                            ...teams[idx]
                        }
                    }
                })
            })
            const takeawaysRequest = await axios.get(`https://www.teamrankings.com/${sports[i].league}/stat/takeaways-per-game`, {
                headers: {
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4"
                }
            })
            const $takeaways = await cheerio.load(takeawaysRequest.data)
            $takeaways('tr').each((i, elem) => {
                const index = $takeaways(elem).find('td:first-child').text()
                const team = $takeaways(elem).find('td:nth-child(2)').text()
                const takeawaysPerGame = $takeaways(elem).find('td:nth-child(3)').text()
                teams.map((teamItem, idx) => {
                    if (teamItem.location === team || teamItem.school === team) {
                        teams[idx] = {
                            takeawaysPerGame: takeawaysPerGame,
                            turnoverDiff: takeawaysPerGame - teams[idx].giveawaysPerGame,
                            ...teams[idx]
                        }
                    } else if (teamItem.teamName === team.split(' ')[1]) {
                        teams[idx] = {
                            takeawaysPerGame: takeawaysPerGame,
                            turnoverDiff: takeawaysPerGame - teams[idx].giveawaysPerGame,
                            ...teams[idx]
                        }
                    }
                })
            })
            const avgTimeofPossessionRequest = await axios.get(`https://www.teamrankings.com/${sports[i].league}/stat/average-time-of-possession-net-of-ot`, {
                headers: {
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4"
                }
            })
            const $avgTimeofPossession = await cheerio.load(avgTimeofPossessionRequest.data)
            $avgTimeofPossession('tr').each((i, elem) => {
                const index = $avgTimeofPossession(elem).find('td:first-child').text()
                const team = $avgTimeofPossession(elem).find('td:nth-child(2)').text()
                const avgTimeofPossessionPerGame = $avgTimeofPossession(elem).find('td:nth-child(3)').text()
                teams.map((teamItem, idx) => {
                    if (teamItem.location === team || teamItem.school === team) {
                        teams[idx] = {
                            avgTimeofPossessionPerGame: avgTimeofPossessionPerGame,
                            ...teams[idx]
                        }
                    } else if (teamItem.teamName === team.split(' ')[1]) {
                        teams[idx] = {
                            avgTimeofPossessionPerGame: avgTimeofPossessionPerGame,
                            ...teams[idx]
                        }
                    }
                })
            })
            const penYardsPerGameRequest = await axios.get(`https://www.teamrankings.com/${sports[i].league}/stat/penalty-yards-per-game`, {
                headers: {
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4"
                }
            })
            const $penYardsPerGame = await cheerio.load(penYardsPerGameRequest.data)
            $penYardsPerGame('tr').each((i, elem) => {
                const index = $penYardsPerGame(elem).find('td:first-child').text()
                const team = $penYardsPerGame(elem).find('td:nth-child(2)').text()
                const penYardsPerGame = $penYardsPerGame(elem).find('td:nth-child(3)').text()
                teams.map((teamItem, idx) => {
                    if (teamItem.location === team || teamItem.school === team) {
                        teams[idx] = {
                            penYardsPerGame: penYardsPerGame,
                            ...teams[idx]
                        }
                    } else if (teamItem.teamName === team.split(' ')[1]) {
                        teams[idx] = {
                            penYardsPerGame: penYardsPerGame,
                            ...teams[idx]
                        }
                    }
                })
            })
        } else if (sports[i].espnSport === 'hockey') {
            for (m = 0; m < teams.length; m++) {
                const teamStatResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/hockey/leagues/nhl/seasons/${sports[i].statYear}/types/2/teams/${teams[m].espnID}/statistics?lang=en&region=us`)
                const teamStatjson = await teamStatResponse.json()
                if (teams[m].espnID != 129764) {
                    teams[m] = {
                        goalsforPerGame: teamStatjson.splits.categories[2].stats[1].value,
                        goalsAgainstPerGame: teamStatjson.splits.categories[0].stats[1].value,
                        goalDiff: teamStatjson.splits.categories[2].stats[0].value - teamStatjson.splits.categories[0].stats[0].value,
                        savePct: teamStatjson.splits.categories[0].stats[14].value,
                        shotsTaken: teamStatjson.splits.categories[2].stats[10].value,
                        shotsAgainst: teamStatjson.splits.categories[0].stats[3].value,
                        penaltiesInMinutes: teamStatjson.splits.categories[3].stats[1].value,
                        shotsBlocked: teamStatjson.splits.categories[0].stats[16].value,
                        faceoffsWon: teamStatjson.splits.categories[2].stats[26].value,
                        giveaways: teamStatjson.splits.categories[2].stats[32].value,
                        takeaways: teamStatjson.splits.categories[0].stats[18].value,
                        ...teams[m]
                    }
                }
            }
        } else if (sports[i].espnSport === 'baseball') {
            for (m = 0; m < teams.length; m++) {
                const teamStatResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/${sports[i].statYear}/types/2/teams/${teams[m].espnID}/statistics?lang=en&region=us`)
                const teamStatjson = await teamStatResponse.json()
                teams[m] = {
                    hits: teamStatjson.splits.categories[0].stats[7].value,
                    walks: teamStatjson.splits.categories[0].stats[9].value,
                    strikeouts: teamStatjson.splits.categories[1].stats[4].value,
                    runsBattedIn: teamStatjson.splits.categories[0].stats[5].value,
                    homeRuns: teamStatjson.splits.categories[0].stats[15].value,
                    runsVsEra: teamStatjson.splits.categories[0].stats[11].value / teamStatjson.splits.categories[1].stats[8].value,
                    strikeouts: teamStatjson.splits.categories[1].stats[4].value,
                    saves: teamStatjson.splits.categories[1].stats[2].value,
                    groundballs: teamStatjson.splits.categories[1].stats[3].value,
                    fieldingErrors: teamStatjson.splits.categories[2].stats[4].value,
                    fieldingPercentage: teamStatjson.splits.categories[2].stats[29].value,
                    ...teams[m]
                }
            }
        } else if (sports[i].espnSport === 'basketball') {
            for (m = 0; m < teams.length; m++) {
                const teamStatResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/${sports[i].statYear}/types/2/teams/${teams[m].espnID}/statistics?lang=en&region=us`)
                const teamStatjson = await teamStatResponse.json()
                teams[m] = {
                    Pace: teamStatjson.splits.categories[2].stats[25].value,
                    freeThrowPct: teamStatjson.splits.categories[2].stats[7].value,
                    effectiveFieldGoalPct: teamStatjson.splits.categories[2].stats[1].value,
                    reboundRate: teamStatjson.splits.categories[1].stats[3].value,
                    fieldGoalsAttempted: teamStatjson.splits.categories[2].stats[3].value,
                    stealsPerGame: teamStatjson.splits.categories[0].stats[7].value,
                    blocksPerGame: teamStatjson.splits.categories[0].stats[6].value,
                    assistTurnoverRation: teamStatjson.splits.categories[1].stats[18].value,
                    ...teams[m]
                }
            }
        }
        // WRITE TEAMS TO DB
        await Teams.insertMany(teams).then(() => {
            console.log(`Successfuly saved ${sports[i].league} teams @ ${moment().format('HH:mm:ss')}`)
        }).catch((err) => console.log(err))
    }




    // // RETRIEVE ODDS
    console.log('BEGINNING ODDS SEEDING')
    let events = []
    let currentOdds = await Odds.find() //USE THIS TO POPULATE UPCOMING GAME ODDS
    await axios.all(sports.map((sport) =>
        axios.get(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.API_KEY}&regions=us&oddsFormat=american&markets=h2h,spreads,totals`)
    )).then(async (data) => {
        try {
            data.map(async (item) => {
                item.data.map(async (event) => {
                    let oddExist = await Odds.findOne({ id: event.id })
                    switch (event.sport_key) {             //WRITE ODDS TO DB
                        case 'americanfootball_nfl':
                            if (!oddExist) {
                                Odds.create({
                                    sport: 'football',
                                    ...event
                                })

                            }
                        case 'americanfootball_ncaaf':
                            if (!oddExist) {
                                Odds.create({
                                    sport: 'football',
                                    ...event
                                })

                            }
                        case 'basketball_nba':
                            if (!oddExist) {
                                Odds.create({
                                    sport: 'basketball',
                                    ...event
                                })

                            }
                        case 'icehockey_nhl':
                            if (!oddExist) {
                                Odds.create({
                                    sport: 'hockey',
                                    ...event
                                })

                            }
                        case 'baseball_mlb':
                            if (!oddExist) {
                                Odds.create({
                                    sport: 'baseball',
                                    ...event
                                })

                            }
                    }

                })
            })

            console.info('Odds Seeding complete! 🌱');
        } catch (err) {
            if (err) throw (err)
        }
    })

    //     //DETERMINE H2H INDEXES FOR EVERY GAME IN ODDS
        console.log(`DETERMINING INDEXES @ ${moment().format('HH:mm:ss')}`)
        currentOdds = await Odds.find()
        currentOdds.map(async (game) => {
            let homeTeam = await Teams.findOne({'espnDisplayName': game.home_team})
            let awayTeam = await Teams.findOne({'espnDisplayName': game.away_team})
            if(game.home_team === 'St Louis Blues'){
                homeTeam = await Teams.findOne({'espnDisplayName':  "St. Louis Blues"})
            }else if(game.home_team === 'Montréal Canadiens'){
                homeTeam = await Teams.findOne({'espnDisplayName':  'Montreal Canadiens'})
            }else if(game.home_team === 'Los Angeles Clippers'){
                homeTeam = await Teams.findOne({'espnDisplayName': 'LA Clippers'}) 
            }else if(game.home_team === 'San Jose State Spartans'){
                homeTeam = await Teams.findOne({'espnDisplayName': 'San José State Spartans'})
            }else if(game.home_team === 'UMass Minutemen'){
                homeTeam = await Teams.findOne({'espnDisplayName': 'Massachusetts Minutemen'})
            }else if(game.home_team === 'Southern Mississippi Golden Eagles'){
                homeTeam = await Teams.findOne({'espnDisplayName': 'Southern Miss Golden Eagles'})
            }else if(game.home_team === 'Hawaii Rainbow Warriors'){
                homeTeam = await Teams.findOne({'espnDisplayName': `Hawai'i Rainbow Warriors`})
            }else if(game.home_team === 'Louisiana Ragin Cajuns'){
                homeTeam = await Teams.findOne({'espnDisplayName':`Louisiana Ragin' Cajuns`})
            }else if(game.home_team === 'Appalachian State Mountaineers'){
                homeTeam = await Teams.findOne({'espnDisplayName': `App State Mountaineers`})
            }
            if(game.away_team === 'St Louis Blues'){
                awayTeam = await Teams.findOne({'espnDisplayName': "St. Louis Blues"})
            }else if(game.away_team === 'Montréal Canadiens'){
                awayTeam = await Teams.findOne({'espnDisplayName': 'Montreal Canadiens'})
            }else if(game.away_team === 'Los Angeles Clippers'){
                awayTeam = await Teams.findOne({'espnDisplayName': 'LA Clippers'})
            }else if(game.away_team === 'San Jose State Spartans'){
                awayTeam = await Teams.findOne({'espnDisplayName': 'San José State Spartans'})
            }else if(game.away_team === 'UMass Minutemen'){
                awayTeam = await Teams.findOne({'espnDisplayName': 'Massachusetts Minutemen'})
            }else if(game.away_team === 'Southern Mississippi Golden Eagles'){
                awayTeam = await Teams.findOne({'espnDisplayName': 'Southern Miss Golden Eagles'})
            }else if(game.away_team === 'Hawaii Rainbow Warriors'){
                awayTeam = await Teams.findOne({'espnDisplayName': `Hawai'i Rainbow Warriors`})
            }else if(game.away_team === 'Louisiana Ragin Cajuns'){
                awayTeam = await Teams.findOne({'espnDisplayName': `Louisiana Ragin' Cajuns`})
            }else if(game.away_team === 'Appalachian State Mountaineers'){
                awayTeam = await Teams.findOne({'espnDisplayName': `App State Mountaineers`})
            }
            let homeIndex = 0
            let awayIndex = 0
                if (game.home_team === homeTeam.espnDisplayName) { //home team
                    if(homeTeam.homeWinLoss.split("-")[0] > awayTeam.awayWinLoss.split("-")[0]){
                        homeIndex++
                    }else if(homeTeam.homeWinLoss.split("-")[0] < awayTeam.awayWinLoss.split("-")[0]){
                        homeIndex--
                    }
                }
                else if (game.away_team === awayTeam.espnDisplayName) { //away team
                    if(awayTeam.awayWinLoss.split("-")[0] > homeTeam.homeWinLoss.split("-")[0]){
                        awayIndex++
                    }else if(awayTeam.awayWinLoss.split("-")[0] < homeTeam.homeWinLoss.split("-")[0]){
                        awayIndex--
                    }
                }
            homeTeam.seasonWinLoss.split("-")[0] > awayTeam.seasonWinLoss.split("-")[0] ? homeIndex++ : homeIndex-- //total win loss for home team
            awayTeam.seasonWinLoss.split("-")[0] > homeTeam.seasonWinLoss.split("-")[0] ? awayIndex++ : awayIndex-- //total win loss for away team
            if (game.sport_key === 'americanfootball_nfl' || game.sport_key === 'americanfootball_ncaaf') {//determine stat indexes
                homeTeam.thirdDownConvRate > awayTeam.thirdDownConvRate ? homeIndex++ : homeIndex--//third down conv rate
                homeTeam.yardsPerPlay > awayTeam.yardsPerPlay ? homeIndex++ : homeIndex--//yards per play
                homeTeam.yardsAllowedPerGame < awayTeam.yardsAllowedPerGame ? homeIndex++ : homeIndex--//yards allowed per game
                homeTeam.giveawaysPerGame < awayTeam.takeawaysPerGame ? homeIndex++ : homeIndex--//giveaways per game
                homeTeam.takeawaysPerGame > awayTeam.giveawaysPerGame ? homeIndex++ : homeIndex--//takeaways per game
                homeTeam.avgTimeofPossessionPerGame > awayTeam.avgTimeofPossessionPerGame ? homeIndex++ : homeIndex--//time of possession
                homeTeam.penYardsPerGame < awayTeam.penYardsPerGame ? homeIndex++ : homeIndex--//penalty yards per game


                awayTeam.thirdDownConvRate > homeTeam.thirdDownConvRate ? awayIndex++ : awayIndex--//third down conv rate
                awayTeam.yardsPerPlay > homeTeam.yardsPerPlay ? awayIndex++ : awayIndex--//yards per play
                awayTeam.yardsAllowedPerGame < homeTeam.yardsAllowedPerGame ? awayIndex++ : awayIndex--//yards allowed per game
                awayTeam.giveawaysPerGame < homeTeam.takeawaysPerGame ? awayIndex++ : awayIndex--//giveaways per game
                awayTeam.takeawaysPerGame > homeTeam.giveawaysPerGame ? awayIndex++ : awayIndex--//takeaways per game
                awayTeam.avgTimeofPossessionPerGame > homeTeam.avgTimeofPossessionPerGame ? awayIndex++ : awayIndex--//time of possession
                awayTeam.penYardsPerGame < homeTeam.penYardsPerGame ? awayIndex++ : awayIndex--//penalty yards per game
            }else if (game.sport_key === 'icehockey_nhl') {
                homeTeam.goalDiff > 0 ? homeIndex++ : homeIndex-- // goalDifferential
                homeTeam.goalsforPerGame > awayTeam.goalsAgainstPerGame ? homeIndex++ : homeIndex-- // goals for per game
                homeTeam.goalsAgainstPerGame < awayTeam.goalsforPerGame ? homeIndex++ : homeIndex-- // goals against per game
                homeTeam.faceoffsWon > awayTeam.faceoffsWon ? homeIndex++ : homeIndex-- // faceoffsWon
                homeTeam.giveaways < awayTeam.giveaways ? homeIndex++ : homeIndex-- // giveaways
                homeTeam.penaltiesInMinutes < awayTeam.penaltiesInMinutes ? homeIndex++ : homeIndex-- // PIM
                homeTeam.savePct > awayTeam.savePct ? homeIndex++ : homeIndex--// save percent
                homeTeam.shotsAgainst < awayTeam.shotsAgainst ? homeIndex++ : homeIndex-- // shotsAgainst
                homeTeam.shotsBlocked > awayTeam.shotsBlocked ? homeIndex++ : homeIndex-- // shotsBlocked
                homeTeam.takeaways > awayTeam.takeaways ? homeIndex++ : homeIndex-- // takeAways

                awayTeam.goalDiff > 0 ? awayIndex++ : awayIndex-- // goalDifferential
                awayTeam.goalsforPerGame > homeTeam.goalsAgainstPerGame ? awayIndex++ : awayIndex-- // goals for per game
                awayTeam.goalsAgainstPerGame < homeTeam.goalsforPerGame ? awayIndex++ : awayIndex-- // goals against per game
                awayTeam.faceoffsWon > homeTeam.faceoffsWon ? awayIndex++ : awayIndex-- // faceoffsWon
                awayTeam.giveaways < homeTeam.giveaways ? awayIndex++ : awayIndex-- // giveaways
                awayTeam.penaltiesInMinutes < homeTeam.penaltiesInMinutes ? awayIndex++ : awayIndex-- // PIM
                awayTeam.savePct > homeTeam.savePct ? awayIndex++ : awayIndex--// save percent
                awayTeam.shotsAgainst < homeTeam.shotsAgainst ? awayIndex++ : awayIndex-- // shotsAgainst
                awayTeam.shotsBlocked > homeTeam.shotsBlocked ? awayIndex++ : awayIndex-- // shotsBlocked
                awayTeam.takeaways > homeTeam.takeaways ? awayIndex++ : awayIndex-- // takeAways
            }else if (game.sport_key === 'basketball_nba') {
                homeTeam.assistTurnoverRatio > awayTeam.assistTurnoverRatio ? homeIndex++ :homeIndex-- // assist to turnover ratio
                homeTeam.blocksPerGame > awayTeam.blocksPerGame ? homeIndex++ :homeIndex-- // blocks per game
                homeTeam.effectiveFieldGoalPct > awayTeam.effectiveFieldGoalPct ? homeIndex++ :homeIndex-- // effective fg percent
                homeTeam.fieldGoalsAttempted > awayTeam.fieldGoalsAttempted ? homeIndex++ :homeIndex-- // field goals attempted
                homeTeam.freeThrowPct > awayTeam.freeThrowPct ? homeIndex++ :homeIndex-- // free throw percent
                homeTeam.reboundRate > awayTeam.reboundRate ? homeIndex++ :homeIndex-- // rebound rate
                homeTeam.stealsPerGame > awayTeam.stealsPerGame ? homeIndex++ :homeIndex-- // steals per game
                homeTeam.pace > awayTeam.pace ? homeIndex++ :homeIndex-- // pace

                awayTeam.assistTurnoverRatio > homeTeam.assistTurnoverRatio ? awayIndex++ : awayIndex-- // assist to turnover ratio
                awayTeam.blocksPerGame > homeTeam.blocksPerGame ? awayIndex++ : awayIndex-- // blocks per game
                awayTeam.effectiveFieldGoalPct > homeTeam.effectiveFieldGoalPct ? awayIndex++ : awayIndex-- // effective fg percent
                awayTeam.fieldGoalsAttempted > homeTeam.fieldGoalsAttempted ? awayIndex++ : awayIndex-- // field goals attempted
                awayTeam.freeThrowPct > homeTeam.freeThrowPct ? awayIndex++ : awayIndex-- // free throw percent
                awayTeam.reboundRate > homeTeam.reboundRate ? awayIndex++ : awayIndex-- // rebound rate
                awayTeam.stealsPerGame > homeTeam.stealsPerGame ? awayIndex++ : awayIndex-- // steals per game
                awayTeam.pace > homeTeam.pace ? awayIndex++ : awayIndex-- // pace
            } else if (game.sport_key === 'baseball_mlb') {
                homeTeam.hits > awayTeam.hits ? homeIndex++ : homeIndex-- //hits
                homeTeam.runs > awayTeam.runs ? homeIndex++ : homeIndex--//runs
                homeTeam.walks > awayTeam.walks ? homeIndex++ : homeIndex--//walks
                homeTeam.homeRuns > awayTeam.hits ? homeIndex++ : homeIndex--//home runs
                homeTeam.runsBattedIn > awayTeam.runsBattedIn ? homeIndex++ : homeIndex--//runsbattedin
                homeTeam.strikeouts < awayTeam.strikeouts ? homeIndex++ : homeIndex--//strikeouts
                homeTeam.fieldingErrors < awayTeam.fieldingErrors ? homeIndex++ : homeIndex--//fieldingErrors
                homeTeam.fieldingPercentage > awayTeam.fieldingPercentage ? homeIndex++ : homeIndex--//fieldingPercentage
                homeTeam.runsVsEra > awayTeam.runsVsEra ? homeIndex++ : homeIndex--//runsVsEra

                awayTeam.hits > homeTeam.hits ? awayIndex++ : awayIndex-- //hits
                awayTeam.runs > homeTeam.runs ? awayIndex++ : awayIndex--//runs
                awayTeam.walks > homeTeam.walks ? awayIndex++ : awayIndex--//walks
                awayTeam.homeRuns > homeTeam.hits ? awayIndex++ : awayIndex--//home runs
                awayTeam.runsBattedIn > homeTeam.runsBattedIn ? awayIndex++ : awayIndex--//runsbattedin
                awayTeam.strikeouts < homeTeam.strikeouts ? awayIndex++ : awayIndex--//strikeouts
                awayTeam.fieldingErrors < homeTeam.fieldingErrors ? awayIndex++ : awayIndex--//fieldingErrors
                awayTeam.fieldingPercentage > homeTeam.fieldingPercentage ? awayIndex++ : awayIndex--//fieldingPercentage
                awayTeam.runsVsEra > homeTeam.runsVsEra ? awayIndex++ : awayIndex--//runsVsEra
            }
            // if (homeTeam.winLossAsDog && homeTeam.winLossAsFav && awayTeam.winLossAsFav && awayTeam.winLossAsDog) { //determine odds indexes -hockey
            //     {
            //        game.bookmakers.map((bookmaker) => {
            //             if (bookmaker.key === props.sportsbook) {
            //                 return (
            //                     bookmaker.markets.map((market) => {
            //                         if (market.key === props.market) {
            //                             return (
            //                                 market.outcomes.map((outcome) => {
            //                                     if (outcome.name === homeTeam.espnDisplayName && outcome.price < 0) {
            //                                         homeTeam.winLossAsFav.split('-')[0] > props.oppTeam.winLossAsDog.split('-')[0] ? index++ : index--//win as fav
            //                                     } else if (outcome.name === homeTeam.espnDisplayName && outcome.price > 0) {
            //                                         homeTeam.winLossAsDog.split('-')[0] > props.oppTeam.winLossAsFav.split('-')[0] ? index++ : index--//win as dog
            //                                     }
            //                                     if (outcome.name === awayTeam.espnDisplayName && outcome.price < 0) {
            //                                             awayTeam.winLossAsFav.split('-')[0] > props.oppTeam.winLossAsDog.split('-')[0] ? index++ : index--//win as fav
            //                                         } else if (outcome.name === awayTeam.espnDisplayName && outcome.price > 0) {
            //                                             awayTeam.winLossAsDog.split('-')[0] > props.oppTeam.winLossAsFav.split('-')[0] ? index++ : index--//win as dog
            //                                         }
            //                                 })
            //                             )
            //                         }
            //                     })
            //                 )
            //             }
            //         })
            //     }
            // }
            if(homeIndex > 10)homeIndex=10
            if(homeIndex < -10)homeIndex=-10
            if(awayIndex > 10)awayIndex=10
            if(awayIndex < -10)awayIndex=-10
            await Odds.findOneAndUpdate({'id': game.id}, 
                {
                    homeTeamIndex: homeIndex,
                    awayTeamIndex: awayIndex
                })
        })

    // //REMOVE PAST GAMES FROM DB
    console.log(`REMOVING PAST GAMES @ ${moment().format('HH:mm:ss')}`)
    let pastGames = []
    currentOdds.map(async (game)=> {
        let homeScore
        let awayScore
        let predictionCorrect
        let winner
        if(moment(game.commence_time).local().isBefore(moment().subtract(4, 'hours'))){  //DETERMINE A GAME HAPPENED IN THE PAST
            let homeTeam = await Teams.findOne({'espnDisplayName': game.home_team})
            let awayTeam = await Teams.findOne({'espnDisplayName': game.away_team})
            if(game.home_team === 'St Louis Blues'){
                homeTeam = await Teams.findOne({'espnDisplayName':  "St. Louis Blues"})
            }else if(game.home_team === 'Montréal Canadiens'){
                homeTeam = await Teams.findOne({'espnDisplayName':  'Montreal Canadiens'})
            }else if(game.home_team === 'Los Angeles Clippers'){
                homeTeam = await Teams.findOne({'espnDisplayName': 'LA Clippers'}) 
            }else if(game.home_team === 'San Jose State Spartans'){
                homeTeam = await Teams.findOne({'espnDisplayName': 'San José State Spartans'})
            }else if(game.home_team === 'UMass Minutemen'){
                homeTeam = await Teams.findOne({'espnDisplayName': 'Massachusetts Minutemen'})
            }else if(game.home_team === 'Southern Mississippi Golden Eagles'){
                homeTeam = await Teams.findOne({'espnDisplayName': 'Southern Miss Golden Eagles'})
            }else if(game.home_team === 'Hawaii Rainbow Warriors'){
                homeTeam = await Teams.findOne({'espnDisplayName': `Hawai'i Rainbow Warriors`})
            }else if(game.home_team === 'Louisiana Ragin Cajuns'){
                homeTeam = await Teams.findOne({'espnDisplayName':`Louisiana Ragin' Cajuns`})
            }else if(game.home_team === 'Appalachian State Mountaineers'){
                homeTeam = await Teams.findOne({'espnDisplayName': `App State Mountaineers`})
            }
            if(game.away_team === 'St Louis Blues'){
                awayTeam = await Teams.findOne({'espnDisplayName': "St. Louis Blues"})
            }else if(game.away_team === 'Montréal Canadiens'){
                awayTeam = await Teams.findOne({'espnDisplayName': 'Montreal Canadiens'})
            }else if(game.away_team === 'Los Angeles Clippers'){
                awayTeam = await Teams.findOne({'espnDisplayName': 'LA Clippers'})
            }else if(game.away_team === 'San Jose State Spartans'){
                awayTeam = await Teams.findOne({'espnDisplayName': 'San José State Spartans'})
            }else if(game.away_team === 'UMass Minutemen'){
                awayTeam = await Teams.findOne({'espnDisplayName': 'Massachusetts Minutemen'})
            }else if(game.away_team === 'Southern Mississippi Golden Eagles'){
                awayTeam = await Teams.findOne({'espnDisplayName': 'Southern Miss Golden Eagles'})
            }else if(game.away_team === 'Hawaii Rainbow Warriors'){
                awayTeam = await Teams.findOne({'espnDisplayName': `Hawai'i Rainbow Warriors`})
            }else if(game.away_team === 'Louisiana Ragin Cajuns'){
                awayTeam = await Teams.findOne({'espnDisplayName': `Louisiana Ragin' Cajuns`})
            }else if(game.away_team === 'Appalachian State Mountaineers'){
                awayTeam = await Teams.findOne({'espnDisplayName': `App State Mountaineers`})
            }
            //DETERMINE A WINNER
            let homeTeamSchedule = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${game.sport}/${homeTeam.league}/teams/${homeTeam.espnID}/schedule`)
            let homeTeamSchedJSON = await homeTeamSchedule.json()
            homeTeamSchedJSON.events.map((event) => {

                if(moment(event.date).format('MM/DD/YYYY') === moment(game.commence_time).format('MM/DD/YYYY')){
                    event.competitions[0].competitors.map((team) => {
                        if(team.homeAway === 'home'){

                            homeScore = team.score.value//home score
                        }else if(team.homeAway === 'away'){

                            awayScore = team.score.value//away score
                        }
                    })
                    homeScore > awayScore ? winner = 'home' : winner = 'away' //winner
                    if(game.homeTeamIndex > game.awayTeamIndex){ // predicted home to win
                        winner === 'home' ? predictionCorrect = true : predictionCorrect = false
                    }else if(game.awayTeamIndex > game.homeTeamIndex){//predicted away to win
                        winner === 'away' ? predictionCorrect = true : predictionCorrect = false
                    }//prediction correct
                }
            })
            await PastGameOdds.insertMany({
                homeScore: homeScore,
                awayScore: awayScore,
                winner: winner,
                predictionCorrect: predictionCorrect,
                ...game._doc
            })//SAVE GAME TO PREVIOUSGAMES DB WITH WINNER
            await Odds.findOneAndDelete({_id : game._doc._id})//delete from Odds table
        }

    })

    console.info(`Full Seeding complete! 🌱 @ ${moment().format('HH:mm:ss')}`);

}
// dataSeed()
module.exports = { dataSeed }