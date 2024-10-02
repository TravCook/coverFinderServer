require('dotenv').config()
const connection = require('../config/connection');
const { Odds, Teams } = require('../models');
const axios = require('axios')
const moment = require('moment')
const cheerio = require('cheerio')
const now = moment()


connection.on('error', (err) => err);

connection.once('open', async () => {
    //     console.log("DB CONNECTED ---- STARTING SEED")
    let sports = [{
        name: "americanfootball_nfl",
        espnSport: 'football',
        league: 'nfl',
        startMonth: 9,
        endMonth: 1,
        multiYear: true

    },
        {
            name: "basketball_nba",
            espnSport: 'basketball',
            league: 'nba',
            startMonth: 10,
            endMonth: 4,
            multiYear: true
        },
        {
            name: "icehockey_nhl",
            espnSport: 'hockey',
            league: 'nhl',
            startMonth: 10,
            endMonth: 4,
            multiYear: true
        },
        {
            name: "baseball_mlb",
            espnSport: 'baseball',
            league: 'mlb',
            startMonth: 3,
            endMonth: 10,
            multiYear: false
        }, 
    ]
        // let searchSports = []
        // let events = []
        // sports.map((sport) => {
        //   if(sport.endMonth < sport.startMonth){ //if true, sport has multi year season
        //     if(now.month()+1 >= sport.startMonth || now.month()+1 <= sport.endMonth){
        //         searchSports.push(sport)
        //     }
        //   }else if(sport.startMonth === sport.endMonth){ // if true, sport is year round
        //     searchSports.push(sport)
        //   }else{ // else case covers single year seasons
        //     if(now.month()+1 <= sport.startMonth && now.month()+1 >= sport.endMonth){
        //         searchSports.push(sport)
        //     }
        //   }
        // })

        // await Odds.deleteMany()
        // await axios.all(sports.map((sport) =>
        // axios.get(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.API_KEY}&regions=us&oddsFormat=american&markets=h2h,spreads,totals`)
        // )).then(async (data) => {
        //     try {
        //         data.map(async (item) => {
        //             item.data.map((event) => {
        //                 events.push(event)
        //             })
        //         })
        //         await Odds.insertMany(events)
        //         console.info('Odds Seeding complete! 🌱');
        //     } catch (err) {
        //         if (err) throw (err)
        //     }
        // })
    console.log('BEGINNING TEAM SEEDING')
    await Teams.deleteMany()
    
    for (i = 0; i < sports.length; i++) {
        // DETERMINE SPORT
        let teams = []
        // RETRIEVE LIST OF TEAMS
        console.log(sports[i].espnSport)
        console.log(sports[i].league)
        const TeamListresponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sports[i].espnSport}/${sports[i].league}/teams`)
        const teamListjson = await TeamListresponse.json()
        // console.log(teamListjson)
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
            teams.push({ espnID, espnDisplayName, location, teamName, league, abbreviation, logo, h2hIndex })
        })
        
        //RETRIEVE TEAM WIN LOSS RECORD
        for (x = 0; x < teams.length; x++){
          const teamRecordResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/${sports[i].espnSport}/leagues/${sports[i].league}/seasons/2024/types/2/teams/${teams[i].espnID}/record?lang=en&region=us`)
            const teamRecordjson = await teamRecordResponse.json()
            teams[x]= {
                seasonWinLoss : teamRecordjson.items[0].displayValue,
                homeWinLoss : teamRecordjson.items[1].displayValue,
                awayWinLoss : teamRecordjson.items[2].displayValue,
                ...teams[x]
            }  
        }
        
        
        // RETRIEVE TEAM BETTING STATS
        //UNDERDOG STATS
        if(sports[i].league !== 'nhl'){
        const dogRequest = await axios.get(`https://www.teamrankings.com/${sports[i].league}/trend/win_trends/is_dog?range=yearly_since_2021&sc=is_dog`,{
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
        const favRequest = await axios.get(`https://www.teamrankings.com/${sports[i].league}/trend/win_trends/is_fav?range=yearly_since_2021&sc=is_fav`,{
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
                const teamStatResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2024/types/2/teams/${teams[m].espnID}/statistics?lang=en&region=us`)
                const teamStatjson = await teamStatResponse.json()
                teams[m] = {
                    thirdDownConvRate: teamStatjson.splits.categories[10].stats[15].value,
                    yardsPerPlay: teamStatjson.splits.categories[2].stats[28].value + teamStatjson.splits.categories[1].stats[38].value,
                    ...teams[m]
                }
            }
            const ypgRequest = await axios.get('https://www.teamrankings.com/nfl/stat/opponent-yards-per-game',{
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
                    if (teamItem.location === team) {
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
            const giveawaysRequest = await axios.get('https://www.teamrankings.com/nfl/stat/giveaways-per-game',{
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
                    if (teamItem.location === team) {
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
            const takeawaysRequest = await axios.get('https://www.teamrankings.com/nfl/stat/takeaways-per-game',{
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
                    if (teamItem.location === team) {
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
            const avgTimeofPossessionRequest = await axios.get('https://www.teamrankings.com/nfl/stat/average-time-of-possession-net-of-ot',{
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
                    if (teamItem.location === team) {
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
            const penYardsPerGameRequest = await axios.get('https://www.teamrankings.com/nfl/stat/penalty-yards-per-game',{
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
                    if (teamItem.location === team) {
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
        }else if (sports[i].espnSport ==='hockey'){
            // GET ADVANCED STATS FROM MONEYPUCK
            // const moneyPuckRequest = await axios.get('https://moneypuck.com/teams.htm',{
            //     headers: {
            //         "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
            //         "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4"
            //     }
            // })
            // const $moneyPuck = await cheerio.load(moneyPuckRequest.data)
            // console.log($moneyPuck)
        //    $moneyPuck('td').each((i, elem) => {
                // const test = $moneyPuck(elem)
                // console.log(test)
            // })
            // $moneyPuck('div.includedContent').each((i, elem) => {
                // console.log($moneyPuck(elem))
                // const index = $moneyPuck(elem).find('td:first-child').text()
                // const team = $moneyPuck(elem).find('td:nth-child(2)').text()
                // console.log(i)
                // const xGoals = $moneyPuck(elem).find('td:nth-child(3)').text()
                // teams.map((teamItem, idx) => {
                //     if (teamItem.location === team) {
                //         teams[idx] = {
                //             penYardsPerGame: penYardsPerGame,
                //             ...teams[idx]
                //         }
                //     } else if (teamItem.teamName === team.split(' ')[1]) {
                //         teams[idx] = {
                //             penYardsPerGame: penYardsPerGame,
                //             ...teams[idx]
                //         }
                //     }
                // })
            // })
            // Xgoals
            // goal diff
            // XGoalsAgainst
            for (m = 0; m < teams.length; m++) {
                const teamStatResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/hockey/leagues/nhl/seasons/2024/types/2/teams/${teams[m].espnID}/statistics?lang=en&region=us`)
                const teamStatjson = await teamStatResponse.json()
                if(teams[m].espnID != 129764){
                    teams[m] = {
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
        }else if (sports[i].espnSport ==='baseball'){
            for (m = 0; m < teams.length; m++) {
                const teamStatResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/2024/types/2/teams/${teams[m].espnID}/statistics?lang=en&region=us`)
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
                    fieldingErrors : teamStatjson.splits.categories[2].stats[4].value,
                    fieldingPercentage: teamStatjson.splits.categories[2].stats[29].value,
                    ...teams[m]
                }
            }
        }else if (sports[i].espnSport ==='basketball'){
            for (m = 0; m < teams.length; m++) {
                const teamStatResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2024/types/2/teams/${teams[m].espnID}/statistics?lang=en&region=us`)
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
        await Teams.insertMany(teams).then(()=>{
            console.log(`Successfuly saved ${sports[i].league} teams`)
        }).catch((err) => console.log(err))
        console.log(`${sports[i].league} seeding done`)
    }

    console.info('Full Seeding complete! 🌱');
    process.exit(0);
})

