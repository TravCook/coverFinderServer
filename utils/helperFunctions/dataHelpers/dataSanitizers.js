const normalizeTeamName = (teamName, league) => {

    const knownTeamNames = {
        "SE Missouri State Redhawks": "Southeast Missouri State Redhawks",
        "Arkansas-Little Rock Trojans": "Little Rock Trojans",
        "GW Revolutionaries": "George Washington Revolutionaries",
        "Loyola (Chi) Ramblers": "Loyola Chicago Ramblers",
        "IUPUI Jaguars": "IU Indianapolis Jaguars",
        "Fort Wayne Mastodons": "Purdue Fort Wayne Mastodons",
        "Boston Univ. Terriers": "Boston University Terriers",
        "Army Knights": "Army Black Knights",
        "Gardner-Webb Bulldogs": "Gardner-Webb Runnin' Bulldogs",
        "Albany Great Danes": "UAlbany Great Danes",
        "Florida Int'l Golden Panthers": "Florida International Panthers",
        "N Colorado Bears": "Northern Colorado Bears",
        "Long Beach State 49ers": "Long Beach State Beach",
        "SIU-Edwardsville Cougars": "SIU Edwardsville Cougars",
        "Grand Canyon Antelopes": "Grand Canyon Lopes",
        "Tenn-Martin Skyhawks": "UT Martin Skyhawks",
        "Seattle Redhawks": "Seattle U Redhawks",
        "CSU Northridge Matadors": "Cal State Northridge Matadors",
        "UT-Arlington Mavericks": "UT Arlington Mavericks",
        "Appalachian State Mountaineers": "App State Mountaineers",
        "Mt. St. Mary's Mountaineers": "Mount St. Mary's Mountaineers",
        "Sam Houston State Bearkats": "Sam Houston Bearkats",
        "UMKC Kangaroos": "Kansas City Roos",
        "Cal Baptist Lancers": "California Baptist Lancers",
        "CSU Fullerton Titans": "Cal State Fullerton Titans",
        "LIU Sharks": "Long Island University Sharks",
        "Nicholls State Colonels": "Nicholls Colonels",
        "Texas A&M-Commerce Lions": "East Texas A&M Lions",
        "Prairie View Panthers": "Prairie View A&M Panthers",
        "St. Thomas (MN) Tommies": "St. Thomas-Minnesota Tommies",
        "CSU Bakersfield Roadrunners": "Cal State Bakersfield Roadrunners",
        "Loyola (MD) Greyhounds": "Loyola Maryland Greyhounds",
        "American Eagles": "American University Eagles",
        "Central Connecticut State Blue Devils": "Central Connecticut Blue Devils",
        "Grambling State Tigers": "Grambling Tigers",
        "Miss Valley State Delta Devils": "Mississippi Valley State Delta Devils",
        "Texas A&M-CC Islanders": "Texas A&M-Corpus Christi Islanders",
        "Maryland-Eastern Shore Hawks": "Maryland Eastern Shore Hawks"

    }



    if (league === 'basketball_ncaab' || league === 'basketball_wncaab') {
        // Replace common abbreviations or patterns
        teamName = teamName.replace(/\bst\b(?!\.)/gi, 'State'); // Match "St" or "st" as a separate word, not followed by a perio
    }

    if (knownTeamNames[teamName]) {
        teamName = knownTeamNames[teamName];
    }

    if (league === 'basketball_wncaab') {
        if (teamName === 'Penn State Nittany Lions') {
            teamName = 'Penn State Lady Lions'
        } else if (teamName === 'Georgia Bulldogs') {
            teamName = 'Georgia Lady Bulldogs'
        } else if (teamName === 'Tennessee Volunteers') {
            teamName = 'Tennessee Lady Volunteers'
        } else if (teamName === "Oklahoma State Cowboys") {
            teamName = "Oklahoma State Cowgirls"
        } else if (teamName === ' UNLV Rebels') {
            teamName = 'UNLV Lady Rebels'
        } else if (teamName === 'Texas Tech Red Raiders') {
            teamName = 'Texas Tech Lady Raiders'
        } else if (teamName === `Hawaii Rainbow Warriors`) {
            teamName === `Hawaii Rainbow Wahine`
        }
    }

    // // Replace hyphens with spaces
    // teamName = teamName.replace(/-/g, ' '); // Replace all hyphens with spaces

    // // Remove all punctuation and extra spaces
    // teamName = teamName.replace(/[^\w\s&]/g, ''); // Removes non-alphanumeric characters except spaces and ampersands
    // teamName = teamName.replace(/\s+/g, ' ').trim(); // Remove extra spaces and trim leading/trailing spaces

    return teamName;
}

const getDynamicStatYear = (startMonth, endMonth, currentDate) => {
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // Months are 0-indexed, so add 1.

    // For sports that start late in the year (e.g., NFL, NBA), we'll base the statYear on the start month.
    if (currentMonth >= startMonth && currentMonth <= endMonth) {
        // In season, statYear is the start year of the season.
        return currentYear;
    } else if (currentMonth < startMonth) {
        // Before the season starts, we use the previous year as statYear.
        return currentYear - 1;
    } else {
        // After the season ends, use the start year of the season.
        return currentYear;
    }
}
const checkNaNValues = (data, game) => {
    data.forEach((row, index) => {
        // console.log(row)
        if (isNaN(row) || row === Infinity || row === -Infinity || row === null || row === undefined) {
            console.log(game.id)
            console.log(`NaN or Infinity found in row ${index}`);
        }
    });
};

module.exports = {checkNaNValues, getDynamicStatYear, normalizeTeamName}