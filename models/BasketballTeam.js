const mongoose = require('mongoose')

const { Schema } = mongoose

const BasketballTeamSchema = new Schema({
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
        //OFFENSIVE
        BSKBtotalPoints: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBpointsPerGame: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBassists: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBassistsPerGame: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBassistRatio: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBeffectiveFgPercent: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBfieldGoalPercent: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBfieldGoalsAttempted: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBfieldGoalsMade: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBfieldGoalsPerGame: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBfreeThrowPercent: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBfreeThrowsAttempted: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBfreeThrowsMade: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBfreeThrowsMadePerGame: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBoffensiveRebounds: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBoffensiveReboundsPerGame: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBoffensiveReboundRate: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBoffensiveTurnovers: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBturnoversPerGame: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBturnoverRatio: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBthreePointPct: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBthreePointsAttempted: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBthreePointsMade: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBtrueShootingPct: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBpace: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBpointsInPaint: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBshootingEfficiency: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        BSKBscoringEfficiency: {
            type: Number,
            required: false,
            category: 'offensive'
        }, 
        BSKBblocks: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        BSKBblocksPerGame: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        BSKBdefensiveRebounds: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        BSKBdefensiveReboundsPerGame: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        BSKBsteals: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        BSKBstealsPerGame: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        BSKBreboundRate: {
            type: Number,
            required: false,
            category: 'general'
        },
        BSKBreboundsPerGame: {
            type: Number,
            required: false,
            category: 'general'
        },
        BSKBfoulsPerGame: {
            type: Number,
            required: false,
            category: 'general'
        },
        BSKBteamAssistToTurnoverRatio: {
            type: Number,
            required: false,
            category: 'general'
        }
    },
    lastFiveGames: [
        {
            id: {
                type: String,
                required: false,
                trim: true
            },
            commence_time: {
                type: String,
                required: false
            },
            home_team: {
                type: String,
                required: false,
            },
            away_team: {
                type: String,
                required: false,
            } ,
            homeTeamIndex: {
                type: Number,
                required: false
            } ,
            awayTeamIndex: {
                type: Number,
                required: false
            } ,
            homeTeamLogo: {
                type: String,
                required: false,
            } ,
            awayTeamLogo: {
                type: String,
                required: false,
            } ,
            homeTeamAbbr: {
                type: String,
                required: false
            } ,
            awayTeamAbbr: {
                type: String,
                required: false
            } ,
            homeScore: {
                type: Number,
                required: false
            } ,
            awayScore: {
                type: Number,
                required: false
            } ,
            winner: {
                type: String,
                required: false
            } ,
        },
    ]
 
})

const BasketballTeam = mongoose.model('BasketballTeam', BasketballTeamSchema)

module.exports = BasketballTeam