const {getDynamicStatYear} = require('./helperFunctions/dataHelpers/dataSanitizers')
const nodemailer = require('nodemailer');
require('dotenv').config();

const sports = [
    {
        name: "americanfootball_nfl",
        espnSport: 'football',
        league: 'nfl',
        startMonth: 9,
        endMonth: 2,
        multiYear: true,
        statYear: getDynamicStatYear(9, 2, new Date()), // NFL starts in 2024 but extends into 2025, so statYear = 2024
        prevstatYear: getDynamicStatYear(9, 2, new Date()), // NHL also uses the same logic for prevstatYear
    },
    {
        name: "americanfootball_ncaaf",
        espnSport: 'football',
        league: 'college-football',
        startMonth: 9,
        endMonth: 1,
        multiYear: true,
        statYear: getDynamicStatYear(9, 1, new Date()), // NCAA Football starts in 2024 but ends in 2025, so statYear = 2024
        prevstatYear: getDynamicStatYear(9, 1, new Date()), // NHL also uses the same logic for prevstatYear
    },
    {
        name: "basketball_nba",
        espnSport: 'basketball',
        league: 'nba',
        startMonth: 10,
        endMonth: 4,
        multiYear: true,
        statYear: getDynamicStatYear(10, 4, new Date()), // NBA starts in 2024 but extends into 2025, so statYear = 2025
        prevstatYear: getDynamicStatYear(10, 4, new Date()), // NHL also uses the same logic for prevstatYear
    },
    {
        name: "icehockey_nhl",
        espnSport: 'hockey',
        league: 'nhl',
        startMonth: 10,
        endMonth: 4,
        multiYear: true,
        statYear: getDynamicStatYear(10, 4, new Date()), // NHL starts in 2024 but extends into 2025, so statYear = 2025
        prevstatYear: getDynamicStatYear(10, 4, new Date()), // NHL also uses the same logic for prevstatYear
    },
    {
        name: "baseball_mlb",
        espnSport: 'baseball',
        league: 'mlb',
        startMonth: 2,
        endMonth: 10,
        multiYear: false,
        statYear: getDynamicStatYear(2, 10, new Date()), // MLB starts in 2024 but ends in 2024, so statYear = 2024
        prevstatYear: getDynamicStatYear(2, 10, new Date()), // NHL also uses the same logic for prevstatYear
    },
    {
        name: "basketball_ncaab",
        espnSport: 'basketball',
        league: 'mens-college-basketball',
        startMonth: 11,
        endMonth: 4,
        multiYear: true,
        statYear: getDynamicStatYear(11, 4, new Date()), // NCAA Basketball starts in 2024 but ends in 2025, so statYear = 2025
        prevstatYear: getDynamicStatYear(11, 4, new Date()), // NHL also uses the same logic for prevstatYear
    },
    {
        name: "basketball_wncaab",
        espnSport: 'basketball',
        league: 'womens-college-basketball',
        startMonth: 11,
        endMonth: 4,
        multiYear: true,
        statYear: getDynamicStatYear(11, 4, new Date()), // Same as men's college basketball
        prevstatYear: getDynamicStatYear(11, 4, new Date()), // NHL also uses the same logic for prevstatYear
    },
]


// Calculate the index difference
const indexCondition = (game, indexDifSmall, indexDiffRange) => {
    const indexDiff = game.predictedWinner === 'home'
      ? Math.abs(game.homeTeamScaledIndex - game.awayTeamScaledIndex)
      : Math.abs(game.awayTeamScaledIndex - game.homeTeamScaledIndex);
  
    return indexDiff >= indexDifSmall && indexDiff <= (indexDifSmall + indexDiffRange);
  };
  
  const strengthCondition = (game, confidenceLow, confidenceRange) => {
    return game.predictionStrength > confidenceLow && game.predictionStrength < (confidenceLow + confidenceRange);
  };
  
  const probabilityCondition = (o, game) => {
    return (o.impliedProb * 100) < (game.winPercent);
  };
  
  
  
  // You can also combine them into a single condition
  const combinedCondition = (game, o, indexDifSmall, indexDiffRange, confidenceLow, confidenceRange) => {
    return probabilityCondition(o, game)
     && indexCondition(game, indexDifSmall, indexDiffRange)
     && strengthCondition(game, confidenceLow, confidenceRange)
  };
  
  const transporter = nodemailer.createTransport({
    service: 'Gmail', // or your SMTP provider
    auth: {
      type: 'OAuth2',
      user: process.env.NODEMAILER_SENDER, // Your email address
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    },
  });



module.exports = {sports, combinedCondition, transporter}