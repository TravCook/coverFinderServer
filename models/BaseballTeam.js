const mongoose = require('mongoose')

const { Schema } = mongoose

const BaseballTeamSchema = new Schema({
    teamName: {
        type: String,
        required: true,
    },
    logo: {
        type: String,
        required: false,
    },
    school: {
        type: String,
        required: false
    }, //college sports only
    league: {
        type: String,
        required: true,
    },
    espnID: {
        type: String,
        required: true,
    },
    abbreviation: {
        type: String,
        required: true
    },
    espnDisplayName: {
        type: String,
        required: true,
    },
    seasonWinLoss: {
        type: String,
        required: false,
    },
    homeWinLoss: {
        type: String,
        required: false,
    },
    awayWinLoss: {
        type: String,
        required: false,
    },
    pointDiff: {
        type: Number,
        required: false
    },
    stats: {
        BSBbattingStrikeouts: {
            type: Number,
            required: false,
            category: 'batting'
        },
        BSBrunsBattedIn: {
            type: Number,
            required: false,
            category: 'batting'
        },
        BSBsacrificeHits: {
            type: Number,
            required: false,
            category: 'batting'
        },
        BSBHitsTotal: {
            type: Number,
            required: false,
            category: 'batting'
        },
        BSBwalks: {
            type: Number,
            required: false,
            category: 'batting'
        },
        BSBruns: {
            type: Number,
            required: false,
            category: 'batting'
        },
        BSBhomeRuns: {
            type: Number,
            required: false,
            category: 'batting'
        },
        BSBdoubles: {
            type: Number,
            required: false,
            category: 'batting'
        },
        BSBtotalBases: {
            type: Number,
            required: false,
            category: 'batting'
        },
        BSBextraBaseHits: {
            type: Number,
            required: false,
            category: 'batting'
        },
        BSBbattingAverage: {
            type: Number,
            required: false,
            category: 'batting'
        },
        BSBsluggingPercentage: {
            type: Number,
            required: false,
            category: 'batting'
        },
        BSBonBasePercentage: {
            type: Number,
            required: false,
            category: 'batting'
        },
        BSBonBasePlusSlugging: {
            type: Number,
            required: false,
            category: 'batting'
        },
        BSBgroundToFlyRatio: {
            type: Number,
            required: false,
            category: 'batting'
        },
        BSBatBatsPerHomeRun: {
            type: Number,
            required: false,
            category: 'batting'
        },
        BSBstolenBasePercentage: {
            type: Number,
            required: false,
            category: 'batting'
        },
        BSBbatterWalkToStrikeoutRatio: {
            type: Number,
            required: false,
            category: 'batting'
        },
        BSBsaves: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBpitcherStrikeouts: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBhitsGivenUp: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBearnedRuns: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBbattersWalked: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBrunsAllowed: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBhomeRunsAllowed: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBwins: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBshutouts: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBearnedRunAverage: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBwalksHitsPerInningPitched: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBwinPct: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBpitcherCaughtStealingPct: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBpitchesPerInning: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBrunSupportAverage: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBopponentBattingAverage: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBopponentSlugAverage: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBopponentOnBasePct: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBopponentOnBasePlusSlugging: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBsavePct: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBstrikeoutsPerNine: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBpitcherStrikeoutToWalkRatio: {
            type: Number,
            required: false,
            category: 'pitching'
        },
        BSBdoublePlays: {
            type: Number,
            required: false,
            category: 'fielding'
        },
        BSBerrors: {
            type: Number,
            required: false,
            category: 'fielding'
        },
        BSBpassedBalls: {
            type: Number,
            required: false,
            category: 'fielding'
        },
        BSBassists: {
            type: Number,
            required: false,
            category: 'fielding'
        },
        BSBputouts: {
            type: Number,
            required: false,
            category: 'fielding'
        },
        BSBcatcherCaughtStealing: {
            type: Number,
            required: false,
            category: 'fielding'
        },
        BSBcatcherCaughtStealingPct: {
            type: Number,
            required: false,
            category: 'fielding'
        },
        BSBcatcherStolenBasesAllowed: {
            type: Number,
            required: false,
            category: 'fielding'
        },
        BSBfieldingPercentage: {
            type: Number,
            required: false,
            category: 'fielding'
        },
        BSBrangeFactor: {
            type: Number,
            required: false,
            category: 'fielding'
        }
    }
    
})

const BaseballTeam = mongoose.model('BaseballTeam', BaseballTeamSchema)

module.exports = BaseballTeam