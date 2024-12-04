require('dotenv').config()
const connection = require('../config/connection');
const { Odds, Teams, PastGameOdds, WinRate } = require('../models');
const axios = require('axios')
const moment = require('moment')
const cheerio = require('cheerio');

const oddsSeed = async () => {
    let sports = [
        {
            name: "americanfootball_nfl",
            espnSport: 'football',
            league: 'nfl',
            startMonth: 9,
            endMonth: 2,
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
            statYear: 2025,
            prevstatYear: 2024
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
    // RETRIEVE ODDS
    console.log('BEGINNING ODDS SEEDING')
    await axios.all(sports.map((sport) =>
        axios.get(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.ODDS_KEY_TCDEV}&regions=us&oddsFormat=american&markets=h2h`)
    )).then(async (data) => {
        try {
            data.map(async (item) => {
                item.data.map(async (event) => {
                    let oddExist = await Odds.findOne({ id: event.id })

                    if (event.sport_key === 'americanfootball_nfl') {
                        if (oddExist) {
                            await Odds.findOneAndReplace({ id: event.id }, {
                                sport: 'football',
                                ...event
                            })

                        } else {
                            await Odds.create({
                                sport: 'football',
                                ...event
                            })
                        }
                    } else if (event.sport_key === 'americanfootball_ncaaf') {
                        if (oddExist) {
                            await Odds.findOneAndReplace({ id: event.id }, {
                                sport: 'football',
                                ...event
                            })

                        } else {
                            await Odds.create({
                                sport: 'football',
                                ...event
                            })
                        }
                    } else if (event.sport_key === 'basketball_nba') {
                        if (oddExist) {
                            await Odds.findOneAndReplace({ id: event.id }, {
                                sport: 'basketball',
                                ...event
                            })

                        } else {
                            await Odds.create({
                                sport: 'basketball',
                                ...event
                            })

                        }
                    } else if (event.sport_key === 'icehockey_nhl') {
                        if (oddExist) {
                            await Odds.findOneAndReplace({ id: event.id }, {
                                sport: 'hockey',
                                ...event
                            })
                        } else {
                            await Odds.create({
                                sport: 'hockey',
                                ...event
                            })
                        }
                    } else if (event.sport_key === 'baseball_mlb') {
                        if (oddExist) {
                            await Odds.findOneAndReplace({ id: event.id }, {
                                sport: 'baseball',
                                ...event
                            })

                        } else {
                            await Odds.create({
                                sport: 'baseball',
                                ...event
                            })

                        }
                    }       //WRITE ODDS TO DB
                })
            })
            console.info('Odds Seeding complete! 🌱');
        } catch (err) {
            if (err) throw (err)
        }
    })
}

const winSeed = async () => {
    console.log('BEGINNING WIN RATE RECORDING')
    let allPastGames = await PastGameOdds.find({})
    let teams = await Teams.find({})
    let teamWRArray = []

    teams.map((team) => {
        if (team.espnDisplayName === 'St Louis Blues') {
            teamWRArray.push({
                team: team.espnDisplayName,
                winRate: allPastGames.filter((game) => game.home_team === 'St. Louis Blues' || game.away_team === 'St. Louis Blues').filter((game) => game.predictionCorrect === true).length / allPastGames.filter((game) => game.home_team === 'St. Louis Blues' || game.away_team === 'St. Louis Blues').length
            })
        } else if (team.espnDisplayName === 'Montreal Canadiens') {
            teamWRArray.push({
                team: team.espnDisplayName,
                winRate: allPastGames.filter((game) => game.home_team === 'Montréal Canadiens' || game.away_team === 'Montréal Canadiens').filter((game) => game.predictionCorrect === true).length / allPastGames.filter((game) => game.home_team === 'Montréal Canadiens' || game.away_team === 'Montréal Canadiens').length
            })
        } else if (team.espnDisplayName === 'LA Clippers') {
            teamWRArray.push({
                team: team.espnDisplayName,
                winRate: allPastGames.filter((game) => game.home_team === 'Los Angeles Clippers' || game.away_team === 'Los Angeles Clippers').filter((game) => game.predictionCorrect === true).length / allPastGames.filter((game) => game.home_team === 'Los Angeles Clippers' || game.away_team === 'Los Angeles Clippers').length
            })
        } else if (team.espnDisplayName === 'San José State Spartans') {
            teamWRArray.push({
                team: team.espnDisplayName,
                winRate: allPastGames.filter((game) => game.home_team === 'San Jose State Spartans' || game.away_team === 'San Jose State Spartans').filter((game) => game.predictionCorrect === true).length / allPastGames.filter((game) => game.home_team === 'San Jose State Spartans' || game.away_team === 'San Jose State Spartans').length
            })
        } else if (team.espnDisplayName === 'Massachusetts Minutemen') {
            teamWRArray.push({
                team: team.espnDisplayName,
                winRate: allPastGames.filter((game) => game.home_team === 'UMass Minutemen' || game.away_team === 'UMass Minutemen').filter((game) => game.predictionCorrect === true).length / allPastGames.filter((game) => game.home_team === 'UMass Minutemen' || game.away_team === 'UMass Minutemen').length
            })
        } else if (team.espnDisplayName === 'Southern Miss Golden Eagles') {
            teamWRArray.push({
                team: team.espnDisplayName,
                winRate: allPastGames.filter((game) => game.home_team === 'Southern Mississippi Golden Eagles' || game.away_team === 'Southern Mississippi Golden Eagles').filter((game) => game.predictionCorrect === true).length / allPastGames.filter((game) => game.home_team === 'Southern Mississippi Golden Eagles' || game.away_team === 'Southern Mississippi Golden Eagles').length
            })
        } else if (team.espnDisplayName === `Hawai'i Rainbow Warriors`) {
            teamWRArray.push({
                team: team.espnDisplayName,
                winRate: allPastGames.filter((game) => game.home_team === 'Hawaii Rainbow Warriors' || game.away_team === 'Hawaii Rainbow Warriors').filter((game) => game.predictionCorrect === true).length / allPastGames.filter((game) => game.home_team === 'Hawaii Rainbow Warriors' || game.away_team === 'Hawaii Rainbow Warriors').length
            })
        } else if (team.espnDisplayName === `Louisiana Ragin' Cajuns`) {
            teamWRArray.push({
                team: team.espnDisplayName,
                winRate: allPastGames.filter((game) => game.home_team === 'Louisiana Ragin Cajuns' || game.away_team === 'Louisiana Ragin Cajuns').filter((game) => game.predictionCorrect === true).length / allPastGames.filter((game) => game.home_team === 'Louisiana Ragin Cajuns' || game.away_team === 'Louisiana Ragin Cajuns').length
            })
        } else if (team.espnDisplayName === 'App State Mountaineers') {
            teamWRArray.push({
                team: team.espnDisplayName,
                winRate: allPastGames.filter((game) => game.home_team === `Appalachian State Mountaineers` || game.away_team === `Appalachian State Mountaineers`).filter((game) => game.predictionCorrect === true).length / allPastGames.filter((game) => game.home_team === `Appalachian State Mountaineers` || game.away_team === `Appalachian State Mountaineers`).length
            })
        } else if (team.espnDisplayName === 'Sam Houston Bearkats') {
            teamWRArray.push({
                team: team.espnDisplayName,
                winRate: allPastGames.filter((game) => game.home_team === `Sam Houston State Bearkats` || game.away_team === `Sam Houston State Bearkats`).filter((game) => game.predictionCorrect === true).length / allPastGames.filter((game) => game.home_team === `Sam Houston State Bearkats` || game.away_team === `Sam Houston State Bearkats`).length
            })
        } else if (allPastGames.filter((game) => game.home_team === team.espnDisplayName || game.away_team === team.espnDisplayName).length != 0) {
            teamWRArray.push({
                team: team.espnDisplayName,
                winRate: allPastGames.filter((game) => game.home_team === team.espnDisplayName || game.away_team === team.espnDisplayName).filter((game) => game.predictionCorrect === true).length / allPastGames.filter((game) => game.home_team === team.espnDisplayName || game.away_team === team.espnDisplayName).length
            })
        }

    })

    WinRate.create({
        date: JSON.stringify(moment().format('MM/DD/YYYY')),
        overallWinRate: (allPastGames.filter((game) => game.predictionCorrect === true).length / allPastGames.length),
        winrateByLeague: [{
            league: 'NFL',
            winRate: allPastGames.filter((game) => game.sport_title === 'NFL').filter((game) => game.predictionCorrect === true).length / allPastGames.filter((game) => game.sport_title === 'NFL').length
        }, {
            league: 'NCAAF',
            winRate: allPastGames.filter((game) => game.sport_title === 'NCAAF').filter((game) => game.predictionCorrect === true).length / allPastGames.filter((game) => game.sport_title === 'NCAAF').length
        }, {
            league: 'NBA',
            winRate: allPastGames.filter((game) => game.sport_title === 'NBA').filter((game) => game.predictionCorrect === true).length / allPastGames.filter((game) => game.sport_title === 'NBA').length
        }, {
            league: 'NHL',
            winRate: allPastGames.filter((game) => game.sport_title === 'NHL').filter((game) => game.predictionCorrect === true).length / allPastGames.filter((game) => game.sport_title === 'NHL').length
        }, {
            league: 'MLB',
            winRate: allPastGames.filter((game) => game.sport_title === 'MLB').filter((game) => game.predictionCorrect === true).length / allPastGames.filter((game) => game.sport_title === 'MLB').length
        }],
        winrateByTeam: teamWRArray,
        highIndexWinRate: allPastGames.filter((game) => game.awayTeamIndex > 5 || game.homeTeamIndex > 5).filter((game) => game.predictionCorrect === true).length / allPastGames.filter((game) => game.awayTeamIndex > 5 || game.homeTeamIndex > 5).length,
        lowIndexWinRate: allPastGames.filter((game) => game.awayTeamIndex < 5 || game.homeTeamIndex < 5).filter((game) => game.predictionCorrect === true).length / allPastGames.filter((game) => game.awayTeamIndex < 5 || game.homeTeamIndex < 5).length,
        // todaysWinrate: allPastGames.filter((game)=> moment(game.commence_time).local().format('MM/DD/YYYY') === moment().format('MM/DD/YYYY')).filter((game)=>game.predictionCorrect === true).length / allPastGames.filter((game)=> moment(game.commence_time).local().format('MM/DD/YYYY') === moment().format('MM/DD/YYYY')).length,
    })

    console.log('FINISHED WINRATE RECORDING ')

}


const dataSeed = async () => {
    console.log('starting seed')
    // DETERMINE SPORTS
    console.log("DB CONNECTED ---- STARTING SEED")
    let sports = [
        {
            name: "americanfootball_nfl",
            espnSport: 'football',
            league: 'nfl',
            startMonth: 9,
            endMonth: 2,
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
            statYear: 2025
        },
        {
            name: "icehockey_nhl",
            espnSport: 'hockey',
            league: 'nhl',
            startMonth: 10,
            endMonth: 4,
            multiYear: true,
            statYear: 2025,
            prevstatYear: 2024
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

    for (i = 0; i < sports.length; i++) {
        // DETERMINE SPORT
        let teams = []
        if (sports[i].name === 'americanfootball_ncaaf') {
            // RETRIEVE LIST OF TEAMS
            const TeamListresponse = await fetch(`https://api.collegefootballdata.com/teams/fbs?year=${sports[i].statYear}`, {
                headers: {
                    "Authorization": `Bearer ${process.env.CFB_API_KEY}`,
                    "Accept": "application/json"
                }
            })
            const teamListjson = await TeamListresponse.json()
            try {
                teamListjson.map((team) => {
                    let espnID = team.id
                    let league = sports[i].league
                    let location = team.location.city
                    let teamName = team.mascot
                    let abbreviation = team.abbreviation
                    let school = team.school
                    let logo = team.logos[0]
                    let espnDisplayName
                    if (`${school} ${team.mascot}` === 'San José State Spartans') {
                        espnDisplayName = 'San Jose State Spartans'
                    } else if (`${school} ${team.mascot}` === 'Massachusetts Minutemen') {
                        espnDisplayName = 'UMass Minutemen'
                    } else if (`${school} ${team.mascot}` === 'Southern Miss Golden Eagles') {
                        espnDisplayName = 'Southern Mississippi Golden Eagles'
                    } else if (`${school} ${team.mascot}` === `Hawai'i Rainbow Warriors`) {
                        espnDisplayName = 'Hawaii Rainbow Warriors'
                    } else if (`${school} ${team.mascot}` === `Louisiana Ragin' Cajuns`) {
                        espnDisplayName = 'Louisiana Ragin Cajuns'
                    } else if (`${school} ${team.mascot}` === `App State Mountaineers`) {
                        espnDisplayName = 'Appalachian State Mountaineers'
                    } else if (`${school} ${team.mascot}` === `Sam Houston Bearkats`) {
                        espnDisplayName = 'Sam Houston State Bearkats'
                    }else {
                        espnDisplayName = `${school} ${team.mascot}`
                    }
                    teams.push({ espnID, espnDisplayName, location, teamName, league, abbreviation, logo, school })
                })
            } catch (err) {
                console.log(err)
            }

        } else {
            // RETRIEVE LIST OF TEAMS
            const TeamListresponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sports[i].espnSport}/${sports[i].league}/teams`)
            const teamListjson = await TeamListresponse.json()
            let teamList = teamListjson.sports[0].leagues[0].teams
            teamList.map((team) => {
                let league = sports[i].league
                let espnID = team.team.id
                let espnDisplayName
                let location = team.team.location
                let teamName = team.team.name
                let abbreviation = team.team.abbreviation
                let logo = team.team.logos[0].href
                if (team.team.displayName === "St. Louis Blues") {
                    espnDisplayName = 'St Louis Blues'
                } else if (team.team.displayName === 'Montreal Canadiens') {
                    espnDisplayName = 'Montréal Canadiens'
                } else if (team.team.displayName === 'LA Clippers') {
                    espnDisplayName = 'Los Angeles Clippers'
                }else {
                    espnDisplayName = team.team.displayName
                } 
                teams.push({ espnID, espnDisplayName, location, teamName, league, abbreviation, logo })
            })
        }
        //RETRIEVE TEAM WIN LOSS RECORD
        for (x = 0; x < teams.length; x++) {
            //check month of sport to determine pre or post season
            let teamRecordResponse
            if (moment().format('M') === sports[i].startMonth) {
                teamRecordResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/${sports[i].espnSport}/leagues/${sports[i].league}/seasons/${sports[i].statYear}/types/1/teams/${teams[x].espnID}/record?lang=en&region=us`)
            } else if (moment().format('M') === sports[i].endMonth) {
                teamRecordResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/${sports[i].espnSport}/leagues/${sports[i].league}/seasons/${sports[i].statYear}/types/3/teams/${teams[x].espnID}/record?lang=en&region=us`)
            } else {
                teamRecordResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/${sports[i].espnSport}/leagues/${sports[i].league}/seasons/${sports[i].statYear}/types/2/teams/${teams[x].espnID}/record?lang=en&region=us`)
            }
            if (teamRecordResponse.status === 404) {
                teamRecordResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/${sports[i].espnSport}/leagues/${sports[i].league}/seasons/${sports[i].prevstatYear}/types/2/teams/${teams[x].espnID}/record?lang=en&region=us`)
            }
            teamRecordjson = await teamRecordResponse.json()
            //check for current year
            //if 404 check prev year
            //check for values to exist before writing
            try {
                teamRecordjson.items.map((item) => {
                    if (item.name === 'overall') {
                        item.stats.map((stat) => {
                            if (stat.name === 'differential') {
                                teams[x] = {
                                    pointDiff: stat.value,
                                    ...teams[x]
                                }
                            }
                        })
                        teams[x] = {
                            seasonWinLoss: item.displayValue,
                            ...teams[x]
                        }
                    } else if (item.name === 'Home') {
                        teams[x] = {
                            homeWinLoss: item.displayValue,
                            ...teams[x]
                        }
                    } else if (item.name === 'Road' || item.name === 'Away') {
                        teams[x] = {
                            awayWinLoss: item.displayValue,
                            ...teams[x]
                        }
                    }
                })
            } catch (err) {
                console.log(err)
            }

        }
        // RETRIEVE TEAM SPECIFIC STATS
        if (sports[i].espnSport === 'football') {
            for (m = 0; m < teams.length; m++) {
                const teamStatResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/football/leagues/${sports[i].league}/seasons/${sports[i].statYear}/types/2/teams/${teams[m].espnID}/statistics?lang=en&region=us`)
                const teamStatjson = await teamStatResponse.json()
                let passYardsPerPlay = 0
                let rushYardsPerPlay = 0
                for (category = 0; category < teamStatjson.splits.categories.length; category++) {
                    let statCategory = category
                    for (stat = 0; stat < teamStatjson.splits.categories[statCategory].stats.length; stat++) {
                        if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'turnOverDifferential') {
                            teams[m] = {
                                turnoverDiff: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'totalPointsPerGame') {
                            teams[m] = {
                                pointsPerGame: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'yardsPerCompletion') { // calculated
                            passYardsPerPlay = teamStatjson.splits.categories[statCategory].stats[stat].value
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'yardsPerRushAttempt') { // calculated
                            rushYardsPerPlay = teamStatjson.splits.categories[statCategory].stats[stat].value
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'thirdDownConvPct') {
                            teams[m] = {
                                thirdDownConvRate: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'redzoneEfficiencyPct') {
                            teams[m] = {
                                redZoneEfficiency: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'sacks' && teamStatjson.splits.categories[statCategory].name === 'defensive') {
                            teams[m] = {
                                sackRate: teamStatjson.splits.categories[statCategory].stats[stat].perGameValue,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'completionPct') {
                            teams[m] = {
                                completionPercentage: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'rushingYardsPerGame') {
                            teams[m] = {
                                rushingYardsPerGame: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'possessionTimeSeconds') {
                            teams[m] = {
                                avgTimeofPossession: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        }
                    }
                }
                teams[m] = {
                    yardsPerPlay: (passYardsPerPlay + rushYardsPerPlay) / 2,
                    ...teams[m]
                }

            }
            // yardsAllowedPerGame
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
            // // penaltyYardsPerGame
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
                            penaltyYardsPerGame: penYardsPerGame,
                            ...teams[idx]
                        }
                    } else if (teamItem.teamName === team.split(' ')[1]) {
                        teams[idx] = {
                            penaltyYardsPerGame: penYardsPerGame,
                            ...teams[idx]
                        }
                    }
                })
            })
        } else if (sports[i].espnSport === 'hockey') {
            for (m = 0; m < teams.length; m++) {
                let teamStatResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/hockey/leagues/nhl/seasons/${sports[i].statYear}/types/2/teams/${teams[m].espnID}/statistics?lang=en&region=us`)
                if (teamStatResponse.status === 404) {
                    teamStatResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/hockey/leagues/nhl/seasons/${sports[i].prevstatYear}/types/2/teams/${teams[m].espnID}/statistics?lang=en&region=us`)
                }
                const teamStatjson = await teamStatResponse.json()
                for (category = 0; category < teamStatjson.splits.categories.length; category++) {
                    let statCategory = category
                    for (stat = 0; stat < teamStatjson.splits.categories[statCategory].stats.length; stat++) {
                        if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'powerPlayPct') {
                            teams[m] = {
                                powerPlayPct: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'penaltyKillPct') {
                            teams[m] = {
                                penKillPct: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        }
                        else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'avgShots') {
                            teams[m] = {
                                shotsTaken: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        }
                        else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'savePct') {
                            teams[m] = {
                                savePct: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        }
                        else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'avgGoals') {
                            teams[m] = {
                                goalsforPerGame: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        }
                        else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'faceoffsWon') {
                            teams[m] = {
                                faceoffsWon: teamStatjson.splits.categories[statCategory].stats[stat].perGameValue,
                                ...teams[m]
                            }
                        }
                        else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'avgGoalsAgainst') {
                            teams[m] = {
                                goalsAgainstAverage: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        }
                        else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'shootingPct') {
                            teams[m] = {
                                shootingPct: teamStatjson.splits.categories[statCategory].stats[stat].perGameValue,
                                ...teams[m]
                            }
                        }
                        else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'blockedShots') {
                            teams[m] = {
                                shotsBlocked: teamStatjson.splits.categories[statCategory].stats[stat].perGameValue,
                                ...teams[m]
                            }
                        }
                        else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'giveaways') {
                            teams[m] = {
                                giveaways: teamStatjson.splits.categories[statCategory].stats[stat].perGameValue,
                                ...teams[m]
                            }
                        }
                        else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'takeaways') {
                            teams[m] = {
                                takeaways: teamStatjson.splits.categories[statCategory].stats[stat].perGameValue,
                                ...teams[m]
                            }
                        }
                    }
                }
            }
        } else if (sports[i].espnSport === 'baseball') {
            for (m = 0; m < teams.length; m++) {
                let teamStatResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/${sports[i].statYear}/types/3/teams/${teams[m].espnID}/statistics?lang=en&region=us`)
                if (teamStatResponse.status === 404) {
                    teamStatResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/${sports[i].statYear}/types/2/teams/${teams[m].espnID}/statistics?lang=en&region=us`)
                }
                const teamStatjson = await teamStatResponse.json()
                for (category = 0; category < teamStatjson.splits.categories.length; category++) {
                    let statCategory = category
                    for (stat = 0; stat < teamStatjson.splits.categories[statCategory].stats.length; stat++) {
                        if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'onBasePct') {
                            teams[m] = {
                                onBasePct: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'slugAvg') {
                            teams[m] = {
                                sluggingPct: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'ERA') {
                            teams[m] = {
                                earnedRunAverage: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'strikeoutToWalkRatio') {
                            teams[m] = {
                                strikeoutWalkRatio: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'fieldingPct') {
                            teams[m] = {
                                fieldingPercentage: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'stolenBasePct') {
                            teams[m] = {
                                stolenBasePercentage: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'errors') {
                            teams[m] = {
                                fieldingErrors: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'qualityStarts') {
                            teams[m] = {
                                qualityStarts: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'homeRuns') {
                            teams[m] = {
                                homeRuns: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        }
                    }
                }
            }
        } else if (sports[i].espnSport === 'basketball') {
            for (m = 0; m < teams.length; m++) {
                const teamStatResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/${sports[i].statYear}/types/2/teams/${teams[m].espnID}/statistics?lang=en&region=us`)
                const teamStatjson = await teamStatResponse.json()
                for (category = 0; category < teamStatjson.splits.categories.length; category++) {
                    let statCategory = category
                    for (stat = 0; stat < teamStatjson.splits.categories[statCategory].stats.length; stat++) {
                        if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'effectiveFGPct') {
                            teams[m] = {
                                effectiveFieldGoalPct: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'turnoverRatio') {
                            teams[m] = {
                                turnoverDiff: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'threePointFieldGoalPct') {
                            teams[m] = {
                                threePointPct: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'avgOffensiveRebounds') {
                            teams[m] = {
                                avgOffensiveRebounds: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'freeThrowPct') {
                            teams[m] = {
                                freeThrowPct: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'assistTurnoverRatio') {
                            teams[m] = {
                                assistTurnoverRatio: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'pointsInPaint') {
                            teams[m] = {
                                pointsInPaint: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'avgDefensiveRebounds') {
                            teams[m] = {
                                avgDefensiveRebounds: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        } else if (teamStatjson.splits.categories[statCategory].stats[stat].name === 'paceFactor') {
                            teams[m] = {
                                pace: teamStatjson.splits.categories[statCategory].stats[stat].value,
                                ...teams[m]
                            }
                        }
                    }
                }
            }
        }
        // WRITE TEAMS TO DB
        for (team = 0; team < teams.length; team++) {
            let currentTeam = await Teams.findOne({ 'espnDisplayName': teams[team].espnDisplayName })
            if (currentTeam != null) {
                await Teams.findOneAndReplace({ 'espnDisplayName': teams[team].espnDisplayName }, {
                    ...teams[team]
                })
            } else {
                await Teams.create({ ...teams[team] })
            }
        }
        console.log(`Successfuly saved ${sports[i].league} teams @ ${moment().format('HH:mm:ss')}`)
    }

    // let events = []
    let currentOdds = await Odds.find() //USE THIS TO POPULATE UPCOMING GAME ODDS

    //DETERMINE H2H INDEXES FOR EVERY GAME IN ODDS
    console.log(`DETERMINING INDEXES @ ${moment().format('HH:mm:ss')}`)
    currentOdds = await Odds.find()
    currentOdds.map(async (game) => {
        let homeTeam = await Teams.findOne({ 'espnDisplayName': game.home_team })
        let awayTeam = await Teams.findOne({ 'espnDisplayName': game.away_team })
        let homeIndex = 0
        let awayIndex = 0
        if (homeTeam && awayTeam) {
            if (game.home_team === homeTeam.espnDisplayName) { //home team
                if (homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0]) {
                    homeIndex++
                } else if (homeTeam.homeWinLoss.split("-")[0] < awayTeam.awayWinLoss.split("-")[0]) {
                    homeIndex--
                }
            }
            else if (game.away_team === awayTeam.espnDisplayName) { //away team
                if (awayTeam.awayWinLoss.split("-")[0] > homeTeam.homeWinLoss.split("-")[0]) {
                    awayIndex++
                } else if (awayTeam.awayWinLoss.split("-")[0] <= homeTeam.homeWinLoss.split("-")[0]) {
                    awayIndex--
                }
            }
            homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex++ : homeIndex-- //total win loss for home team
            awayTeam.seasonWinLoss.split("-")[0] > homeTeam.seasonWinLoss.split("-")[0] ? awayIndex++ : awayIndex-- //total win loss for away team
            homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex++ : homeIndex-- //total win loss for home team
            awayTeam.pointDiff > homeTeam.pointDiff ? awayIndex++ : awayIndex-- //total win loss for away team
            if (game.sport_key === 'americanfootball_nfl' || game.sport_key === 'americanfootball_ncaaf') {
                homeTeam.turnoverDiff >= awayTeam.turnoverDiff ? homeIndex++ : homeIndex--//turnoverDiff
                homeTeam.pointsPerGame >= awayTeam.pointsPerGame ? homeIndex++ : homeIndex--//pointsPerGame
                homeTeam.yardsPerPlay >= awayTeam.yardsPerPlay ? homeIndex++ : homeIndex--//yardsPerPlay
                homeTeam.thirdDownConvRate >= awayTeam.thirdDownConvRate ? homeIndex++ : homeIndex--//thirdDownConvRate
                homeTeam.redZoneEfficiency >= awayTeam.redZoneEfficiency ? homeIndex++ : homeIndex--//redZoneEfficiency
                homeTeam.avgTimeofPossession >= awayTeam.avgTimeofPossession ? homeIndex++ : homeIndex--//avgTimeofPossession
                homeTeam.sackRate >= awayTeam.sackRate ? homeIndex++ : homeIndex--//sackRate
                homeTeam.completionPercentage >= awayTeam.completionPercentage ? homeIndex++ : homeIndex--//completionPercentage
                homeTeam.rushingYardsPerGame >= awayTeam.rushingYardsPerGame ? homeIndex++ : homeIndex--//rushingYardsPerGame
                homeTeam.yardsAllowedPerGame <= awayTeam.yardsAllowedPerGame ? homeIndex++ : homeIndex--//yardsAllowedPerGame
                homeTeam.penaltyYardsPerGame <= awayTeam.penaltyYardsPerGame ? homeIndex++ : homeIndex--//penaltyYardsPerGame

                awayTeam.turnoverDiff > homeTeam.turnoverDiff ? awayIndex++ : awayIndex--//turnoverDiff
                awayTeam.pointsPerGame > homeTeam.pointsPerGame ? awayIndex++ : awayIndex--//pointsPerGame
                awayTeam.yardsPerPlay > homeTeam.yardsPerPlay ? awayIndex++ : awayIndex--//yardsPerPlay
                awayTeam.thirdDownConvRate > homeTeam.thirdDownConvRate ? awayIndex++ : awayIndex--//thirdDownConvRate
                awayTeam.redZoneEfficiency > homeTeam.redZoneEfficiency ? awayIndex++ : awayIndex--//redZoneEfficiency
                awayTeam.avgTimeofPossession > homeTeam.avgTimeofPossession ? awayIndex++ : awayIndex--//avgTimeofPossession
                awayTeam.sackRate > homeTeam.sackRate ? awayIndex++ : awayIndex--//sackRate
                awayTeam.completionPercentage > homeTeam.completionPercentage ? awayIndex++ : awayIndex--//completionPercentage
                awayTeam.rushingYardsPerGame > homeTeam.rushingYardsPerGame ? awayIndex++ : awayIndex--//rushingYardsPerGame
                awayTeam.yardsAllowedPerGame < homeTeam.yardsAllowedPerGame ? awayIndex++ : awayIndex--//yardsAllowedPerGame
                awayTeam.penaltyYardsPerGame < homeTeam.penaltyYardsPerGame ? awayIndex++ : awayIndex--//penaltyYardsPerGame
            }
            else if (game.sport_key === 'icehockey_nhl') {
                homeTeam.powerPlayPct >= awayTeam.powerPlayPct ? homeIndex++ : homeIndex-- // powerPlayPct
                homeTeam.penKillPct >= awayTeam.penKillPct ? homeIndex++ : homeIndex-- // penKillPct
                homeTeam.shotsTaken >= awayTeam.shotsTaken ? homeIndex++ : homeIndex-- // shotsTaken
                homeTeam.savePct >= awayTeam.savePct ? homeIndex++ : homeIndex-- // savePct
                homeTeam.goalsforPerGame >= awayTeam.goalsforPerGame ? homeIndex++ : homeIndex-- // goalsforPerGame
                homeTeam.faceoffsWon <= awayTeam.faceoffsWon ? homeIndex++ : homeIndex-- // faceoffsWon
                homeTeam.goalsAgainstAverage <= awayTeam.goalsAgainstAverage ? homeIndex++ : homeIndex--// goalsAgainstAverage
                homeTeam.shootingPct >= awayTeam.shootingPct ? homeIndex++ : homeIndex-- // shootingPct
                homeTeam.shotsBlocked >= awayTeam.shotsBlocked ? homeIndex++ : homeIndex-- // shotsBlocked
                homeTeam.giveaways <= awayTeam.giveaways ? homeIndex++ : homeIndex-- // giveaways
                homeTeam.takeaways >= awayTeam.takeaways ? homeIndex++ : homeIndex-- // takeAways

                awayTeam.powerPlayPct >= homeTeam.powerPlayPct ? homeIndex++ : homeIndex-- // powerPlayPct
                awayTeam.penKillPct >= homeTeam.penKillPct ? homeIndex++ : homeIndex-- // penKillPct
                awayTeam.shotsTaken >= homeTeam.shotsTaken ? homeIndex++ : homeIndex-- // shotsTaken
                awayTeam.savePct >= homeTeam.savePct ? homeIndex++ : homeIndex-- // savePct
                awayTeam.goalsforPerGame >= homeTeam.goalsforPerGame ? homeIndex++ : homeIndex-- // goalsforPerGame
                awayTeam.faceoffsWon <= homeTeam.faceoffsWon ? homeIndex++ : homeIndex-- // faceoffsWon
                awayTeam.goalsAgainstAverage <= homeTeam.goalsAgainstAverage ? homeIndex++ : homeIndex--// goalsAgainstAverage
                awayTeam.shootingPct >= homeTeam.shootingPct ? homeIndex++ : homeIndex-- // shootingPct
                awayTeam.shotsBlocked >= homeTeam.shotsBlocked ? homeIndex++ : homeIndex-- // shotsBlocked
                awayTeam.giveaways <= homeTeam.giveaways ? homeIndex++ : homeIndex-- // giveaways
                awayTeam.takeaways >= homeTeam.takeaways ? homeIndex++ : homeIndex-- // takeAways
            } else if (game.sport_key === 'basketball_nba') {
                homeTeam.effectiveFieldGoalPct >= awayTeam.effectiveFieldGoalPct ? homeIndex++ : homeIndex-- //effectiveFieldGoalPct
                homeTeam.turnoverDiff >= awayTeam.turnoverDiff ? homeIndex++ : homeIndex-- //turnoverDiff
                homeTeam.threePointPct >= awayTeam.threePointPct ? homeIndex++ : homeIndex-- //threePointPct
                homeTeam.avgOffensiveRebounds >= awayTeam.avgOffensiveRebounds ? homeIndex++ : homeIndex-- //avgOffensiveRebounds
                homeTeam.freeThrowPct >= awayTeam.freeThrowPct ? homeIndex++ : homeIndex-- //freeThrowPct
                homeTeam.assistTurnoverRatio >= awayTeam.assistTurnoverRatio ? homeIndex++ : homeIndex-- //assistTurnoverRatio
                homeTeam.pointsInPaint >= awayTeam.pointsInPaint ? homeIndex++ : homeIndex-- //pointsInPaint
                homeTeam.avgDefensiveRebounds >= awayTeam.avgDefensiveRebounds ? homeIndex++ : homeIndex-- //avgDefensiveRebounds
                homeTeam.pace >= awayTeam.pace ? homeIndex++ : homeIndex-- //pace

                awayTeam.effectiveFieldGoalPct > homeTeam.effectiveFieldGoalPct ? awayIndex++ : awayIndex-- //effectiveFieldGoalPct
                awayTeam.turnoverDiff > homeTeam.turnoverDiff ? awayIndex++ : awayIndex-- //turnoverDiff
                awayTeam.threePointPct > homeTeam.threePointPct ? awayIndex++ : awayIndex-- //threePointPct
                awayTeam.avgOffensiveRebounds > homeTeam.avgOffensiveRebounds ? awayIndex++ : awayIndex-- //avgOffensiveRebounds
                awayTeam.freeThrowPct > homeTeam.freeThrowPct ? awayIndex++ : awayIndex-- //freeThrowPct
                awayTeam.assistTurnoverRatio > homeTeam.assistTurnoverRatio ? awayIndex++ : awayIndex-- //assistTurnoverRatio
                awayTeam.pointsInPaint > homeTeam.pointsInPaint ? awayIndex++ : awayIndex-- //pointsInPaint
                awayTeam.avgDefensiveRebounds > homeTeam.avgDefensiveRebounds ? awayIndex++ : awayIndex-- // avgDefensiveRebounds
                homeTeam.pace >= awayTeam.pace ? homeIndex++ : homeIndex-- //pace
            } else if (game.sport_key === 'baseball_mlb') {
                homeTeam.onBasePct >= awayTeam.onBasePct ? homeIndex++ : homeIndex-- //onBasePct
                homeTeam.sluggingPct >= awayTeam.sluggingPct ? homeIndex++ : homeIndex--//sluggingPct
                homeTeam.earnedRunAverage <= awayTeam.earnedRunAverage ? homeIndex++ : homeIndex--//earnedRunAverage
                homeTeam.strikeoutWalkRatio <= awayTeam.strikeoutWalkRatio ? homeIndex++ : homeIndex--//strikeoutWalkRatio
                homeTeam.fieldingPercentage >= awayTeam.fieldingPercentage ? homeIndex++ : homeIndex--//fieldingPercentage
                homeTeam.stolenBasePercentage >= awayTeam.stolenBasePercentage ? homeIndex++ : homeIndex--//stolenBasePercentage
                homeTeam.fieldingErrors <= awayTeam.fieldingErrors ? homeIndex++ : homeIndex--//fieldingErrors
                homeTeam.qualityStarts >= awayTeam.qualityStarts ? homeIndex++ : homeIndex--//qualityStarts
                homeTeam.homeRuns >= awayTeam.homeRuns ? homeIndex++ : homeIndex--//homeRuns

                awayTeam.onBasePct >= homeTeam.onBasePct ? homeIndex++ : homeIndex-- //onBasePct
                awayTeam.sluggingPct >= homeTeam.sluggingPct ? homeIndex++ : homeIndex--//sluggingPct
                awayTeam.earnedRunAverage <= homeTeam.earnedRunAverage ? homeIndex++ : homeIndex--//earnedRunAverage
                awayTeam.strikeoutWalkRatio <= homeTeam.strikeoutWalkRatio ? homeIndex++ : homeIndex--//strikeoutWalkRatio
                awayTeam.fieldingPercentage >= homeTeam.fieldingPercentage ? homeIndex++ : homeIndex--//fieldingPercentage
                awayTeam.stolenBasePercentage >= homeTeam.stolenBasePercentage ? homeIndex++ : homeIndex--//stolenBasePercentage
                awayTeam.fieldingErrors <= homeTeam.fieldingErrors ? homeIndex++ : homeIndex--//fieldingErrors
                awayTeam.qualityStarts >= homeTeam.qualityStarts ? homeIndex++ : homeIndex--//qualityStarts
                awayTeam.homeRuns >= homeTeam.homeRuns ? homeIndex++ : homeIndex--//homeRuns
            }
        }
        if (homeIndex > 10) homeIndex = 10
        if (homeIndex < -10) homeIndex = -10
        if (awayIndex > 10) awayIndex = 10
        if (awayIndex < -10) awayIndex = -10
        await Odds.findOneAndUpdate({ 'id': game.id },
            {
                homeTeamIndex: homeIndex,
                awayTeamIndex: awayIndex
            })
    })
    console.log('CALCULATING WIN RATES')
    let allPastGames = await PastGameOdds.find({})
    currentOdds.map(async (game) => {
        let homeTeamWinRate = allPastGames.filter((pastGame) => pastGame.home_team === game.home_team || pastGame.away_team === game.home_team).filter((pastGame) => pastGame.predictionCorrect === true).length / allPastGames.filter((pastGame) => pastGame.home_team === game.home_team || pastGame.away_team === game.home_team).length
        let awayTeamWinRate = allPastGames.filter((pastGame) => pastGame.home_team === game.away_team || pastGame.away_team === game.away_team).filter((pastGame) => pastGame.predictionCorrect === true).length / allPastGames.filter((pastGame) => pastGame.home_team === game.away_team || pastGame.away_team === game.away_team).length
        let leagueWinRate = allPastGames.filter((pastGame) => pastGame.sport_key === game.sport_key).filter((pastGame) => pastGame.predictionCorrect === true).length / allPastGames.filter((pastGame) => pastGame.sport_key === game.sport_key).length
        if(homeTeamWinRate && awayTeamWinRate && leagueWinRate){
            await Odds.findOneAndUpdate({ 'id': game.id }, {
                winPercent: (homeTeamWinRate + awayTeamWinRate + leagueWinRate) / 3
            }) 
        }else if(homeTeamWinRate && leagueWinRate){
            await Odds.findOneAndUpdate({ 'id': game.id }, {
                winPercent: (homeTeamWinRate + leagueWinRate) / 2
            }) 
        }else if(awayTeamWinRate && leagueWinRate){
            await Odds.findOneAndUpdate({ 'id': game.id }, {
                winPercent: (awayTeamWinRate + leagueWinRate) / 2
            }) 
        }else{
            await Odds.findOneAndUpdate({ 'id': game.id }, {
                winPercent: leagueWinRate
            }) 
        }

    })
    console.log(`REMOVING PAST GAMES @ ${moment().format('HH:mm:ss')}`)
    let pastGames = []
    currentOdds = await Odds.find()
    currentOdds.map(async (game) => {
        let homeScore
        let awayScore
        let predictionCorrect
        let winner

        if (moment(game.commence_time).local().isBefore(moment().local())) {  //DETERMINE A GAME HAPPENED IN THE PAST
            let { _id, ...newGame } = game._doc


            let homeTeam
            let awayTeam
                homeTeam = await Teams.findOne({ 'espnDisplayName': game.home_team })
                awayTeam = await Teams.findOne({ 'espnDisplayName': game.away_team })
            //DETERMINE A WINNER
            let homeTeamSchedule = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${game.sport}/${homeTeam.league}/teams/${homeTeam.espnID}/schedule`)
            let homeTeamSchedJSON = await homeTeamSchedule.json()
            homeTeamSchedJSON.events.map(async (event) => {
                if (moment(event.date).local().format('MM/DD/YYYY') === moment(game.commence_time).local().format('MM/DD/YYYY')) {

                    if (event.competitions[0].status.type.completed === true) {
                        let deletedGame = await Odds.findOneAndDelete({ _id: game._doc._id })//delete from Odds table
                        if (deletedGame) {
                            console.log(`deleted game: ${deletedGame.home_team} vs ${deletedGame.away_team}`)
                        }
                        event.competitions[0].competitors.map((team) => {
                            if (team.homeAway === 'home') {

                                homeScore = team.score.value//home score
                            } else if (team.homeAway === 'away') {

                                awayScore = team.score.value//away score
                            }
                        })
                        homeScore > awayScore ? winner = 'home' : winner = 'away' //winner
                        if (game.homeTeamIndex >= game.awayTeamIndex) { // predicted home to win
                            winner === 'home' ? predictionCorrect = true : predictionCorrect = false
                        } else if (game.awayTeamIndex > game.homeTeamIndex) {//predicted away to win
                            winner === 'away' ? predictionCorrect = true : predictionCorrect = false
                        }//prediction correct 



                        await PastGameOdds.create({
                            homeScore: homeScore,
                            awayScore: awayScore,
                            winner: winner,
                            predictionCorrect: predictionCorrect,
                            ...newGame
                        })//SAVE GAME TO PREVIOUSGAMES DB WITH WINNER



                    }

                }
            })

        }

    })
    console.info(`Full Seeding complete! 🌱 @ ${moment().format('HH:mm:ss')}`);
}




module.exports = { dataSeed, oddsSeed, winSeed }