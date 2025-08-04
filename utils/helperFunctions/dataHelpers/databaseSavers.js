const { normalizeTeamName } = require("./dataSanitizers")
const { getImpliedProbability } = require("../../constants")
const db = require('../../../models_sql');
const { exists } = require("../../../models/Odds");
const Odds = require("../../../models/Odds");

const gameDBSaver = async (game, sport, past) => {
    let homeTeam = await db.Teams.findOne({ where: { espnDisplayName: normalizeTeamName(game.home_team, game.sport_key), league: sport.name }, raw: true })
    let awayTeam = await db.Teams.findOne({ where: { espnDisplayName: normalizeTeamName(game.away_team, game.sport_key), league: sport.name }, raw: true })
    if (!homeTeam) console.log(game.home_team, normalizeTeamName(game.home_team, game.sport_key), 'failed at saving')
    if (!awayTeam) console.log(game.away_team, normalizeTeamName(game.away_team, game.sport_key), 'failed at saving')

    if (homeTeam && awayTeam) {
        let dbGame
        const existingGame = await db.Games.findOne({
            where: {
                homeTeam: homeTeam.id,
                awayTeam: awayTeam.id,
                commence_time: game.commence_time,
                sport: sport.id
            }
        });

        if (existingGame) {
            dbGame = existingGame
        } else {
            dbGame = game
        }

        let upsertPayload = {
            oddsApiID: game.id, // Use the Odds API ID as the unique identifier
            sport: sport.id,
            homeTeam: homeTeam.id,
            awayTeam: awayTeam.id,
            commence_time: game.commence_time,
            sport_title: sport.league,
            sport_key: sport.name,
        }
        if (dbGame.homeTeamIndex !== undefined) upsertPayload.homeTeamIndex = dbGame.homeTeamIndex;
        if (dbGame.awayTeamIndex !== undefined) upsertPayload.awayTeamIndex = dbGame.awayTeamIndex;
        if (dbGame.homeTeamScaledIndex !== undefined) upsertPayload.homeTeamScaledIndex = dbGame.homeTeamScaledIndex;
        if (dbGame.awayTeamScaledIndex !== undefined) upsertPayload.awayTeamScaledIndex = dbGame.awayTeamScaledIndex;
        if (dbGame.winPercent !== undefined) upsertPayload.winPercent = dbGame.winPercent;
        if (dbGame.predictedWinner !== undefined) upsertPayload.predictedWinner = dbGame.predictedWinner;
        if (dbGame.predictionStrength !== undefined || dbGame.predictionConfidence !== undefined) {
            upsertPayload.predictionConfidence = dbGame.predictionStrength || dbGame.predictionConfidence;
        }
        if (dbGame.timeRemaining !== undefined) upsertPayload.timeRemaining = dbGame.timeRemaining;
        if (dbGame.homeScore !== undefined || dbGame.homeScore === 0) upsertPayload.homeScore = dbGame.homeScore;
        if (dbGame.awayScore !== undefined || dbGame.awayScore === 0) upsertPayload.awayScore = dbGame.awayScore;
        if (dbGame.winner !== undefined) upsertPayload.winner = dbGame.winner;
        if (dbGame.predictionCorrect === true || dbGame.predictionCorrect === false) {
            upsertPayload.predictionCorrect = dbGame.predictionCorrect;
        }
        upsertPayload.complete = past ? true : false;

        const [gameSQL, createdGame] = await db.Games.upsert(upsertPayload, {
            where: { oddsApiID: game.id }
        })
        for (let bookmaker of game.bookmakers) {
            const [SQLbookmaker, createdSQLBookmaker] = await db.Bookmakers.upsert({
                gameId: gameSQL.id, // Use the SQL game ID
                key: bookmaker.key, // Ensure uniqueness by key and gameID
                title: bookmaker.title, // Include the title of the bookmaker
                sport: sport.id, // Use the SQL sport ID
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
                    let outcomeTeam = await db.Teams.findOne({ where: { espnDisplayName: normalizeTeamName(outcome.name, game.sport_key), league: sport.name }, raw: true })
                    await db.Outcomes.upsert({
                        name: normalizeTeamName(outcome.name, sport.name), // Ensure uniqueness by name and marketKey
                        price: outcome.price, // Include the price of the outcome
                        impliedProbability: outcome.impliedProb ? outcome.impliedProb : await getImpliedProbability(outcome.price), // Include the implied probability of the outcome
                        marketId: SQLmarket.id, // Use the SQL market ID
                        teamId: outcomeTeam ? outcomeTeam.id : null, // Use the SQL team ID if available
                        point: outcome.point ? outcome.point : null
                    }, {
                        where: { name: outcome.name, marketId: SQLmarket.id } // Ensure uniqueness by name and marketKey
                    })
                }
            }
        }

        return gameSQL
    }
}

const statDBSaver = async (game, team, sport, gameSQL) => {
    await db.Stats.upsert({
        gameId: gameSQL.id, // Use the SQL game ID
        teamId: team.id, // Use the SQL team ID
        sport: sport.id, // Use the SQL sport ID
        data: {
            ...team.currentStats, // Spread the home team stats
        }
    })

}

module.exports = { gameDBSaver, statDBSaver }
