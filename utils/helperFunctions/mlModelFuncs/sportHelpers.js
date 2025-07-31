const isSportInSeason = (sport) => {
    let inSeason = false
    const { startMonth, endMonth, multiYear } = sport;
    // Get current month (1-12)
    const currentMonth = new Date().getMonth() + 1;
    if (multiYear) {
        if (startMonth <= currentMonth || currentMonth <= endMonth) {
            inSeason = true
        }
    } else {
        if (currentMonth >= startMonth && currentMonth <= endMonth) {
            inSeason = true
        }
    }
    return inSeason

}

module.exports = {isSportInSeason}