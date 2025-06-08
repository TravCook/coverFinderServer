const { normalizeTeamName } = require("./dataSanitizers")
const {getImpliedProbability} = require("../../constants")
const db = require('../../../models_sql');

const gameDBSaver = async (game, sport ,past) => {
    let homeTeam = await db.Teams.findOne({ where: { espnDisplayName: normalizeTeamName(game.home_team, game.sport_key), league: sport.name }, raw: true })
    let awayTeam = await db.Teams.findOne({ where: { espnDisplayName: normalizeTeamName(game.away_team, game.sport_key), league: sport.name }, raw: true })
    if (!homeTeam) console.log(game.home_team)
    if (!awayTeam) console.log(game.away_team)
    if (homeTeam && awayTeam) {
        const [gameSQL, createdGame] = await db.Games.upsert({
            sport: sport.id,
            homeTeam: homeTeam.id,
            awayTeam: awayTeam.id,
            commence_time: game.commence_time,
            sport_title: sport.league,
            sport_key: sport.name,
            homeTeamIndex: game.homeTeamIndex ? game.homeTeamIndex : 0, // Default to 0 if not set
            awayTeamIndex: game.awayTeamIndex ? game.awayTeamIndex : 0, // Default to 0 if not set
            homeTeamScaledIndex: game.homeTeamScaledIndex ? game.homeTeamScaledIndex : 0, // Default to 0 if not set
            awayTeamScaledIndex: game.awayTeamScaledIndex ? game.awayTeamScaledIndex : 0, // Default to 0 if not set
            winPercent: game.winPercent ? game.winPercent : 0, // Default to 0 if not set
            predictedWinner: game.predictedWinner ? game.predictedWinner : 'none', // Default to 'none' if not set
            predictionConfidence: game.predictionStrength ? game.predictionStrength : 0, // Default to 0 if not set
            complete: past ? true : false,
            timeRemaining: game.timeRemaining ? game.timeRemaining : null,
            homeScore: game.homeScore ? game.homeScore : null,
            awayScore: game.awayScore ? game.awayScore : null,
            winner: game.winner ? game.winner : null,
            predictionCorrect: game.predictionCorrect === true || game.predictionCorrect === false ? game.predictionCorrect : null
        }, {
            where: { id: game.id }
        })

        for (let bookmaker of game.bookmakers) {
            const [SQLbookmaker, createdSQLBookmaker] = await db.Bookmakers.upsert({
                gameId: gameSQL.id, // Use the SQL game ID
                key: bookmaker.key, // Ensure uniqueness by key and gameID
                title: bookmaker.title, // Include the title of the bookmaker
            }, {
                where: { key: bookmaker.key, gameId: gameSQL.id } // Ensure uniqueness by key and gameID
            })
            for (let market of bookmaker.markets) {
                const [SQLmarket, createdSQLmarket] = await db.Markets.upsert({
                    key: market.key, // Ensure uniqueness by key and bookmakerKey
                    bookmakerId: SQLbookmaker.id, // Use the SQL bookmaker ID
                }, {
                    where: { key: market.key, bookmakerId: SQLbookmaker.id } // Ensure uniqueness by key, bookmakerKey, and gameID
                })
                for (let outcome of market.outcomes) {
                    let outcomeTeam = await db.Teams.findOne({ where: { espnDisplayName: outcome.name, league: sport.league }, raw: true })

                    db.Outcomes.upsert({
                        name: normalizeTeamName(outcome.name, sport.name), // Ensure uniqueness by name and marketKey
                        price: outcome.price, // Include the price of the outcome
                        impliedProbability: outcome.impliedProb ? outcome.impliedProb : await getImpliedProbability(outcome.price), // Include the implied probability of the outcome
                        marketId: SQLmarket.id, // Use the SQL market ID
                        teamId: outcomeTeam ? outcomeTeam.id : null, // Use the SQL team ID if available
                    }, {
                        where: { name: outcome.name, marketId: SQLmarket.id } // Ensure uniqueness by name and marketKey
                    })
                }
            }
        }

        return gameSQL
    }
}

const statDBSaver = (game, team, sport) => {
    db.Stats.upsert({
        gameId: game.id, // Use the SQL game ID
        teamId: team.id, // Use the SQL team ID
        sport: sport.id, // Use the SQL sport ID
        data: {
            ...game.homeTeamStats, // Spread the home team stats
            //TEMP FOR DB SWITCH, STAT LOGIC WILL GO HERE, OR STAT OBJECT DEPENDING ON HOW ITS BUILT
        }
    }, {
        where: { gameId: gameSQL.id, teamId: homeTeam.id }
    })
}

module.exports = { gameDBSaver, statDBSaver }
