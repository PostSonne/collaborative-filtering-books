const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const app = express();
const cors = require('cors');
const PORT = 3001;

let allRatings = [];
let trainRatings = [];
let testRatings = [];

let userBookTrain = {};
let userBookTest = {};

function loadAndSplitRatings() {
    return new Promise((resolve, reject) => {
        fs.createReadStream('ratings.csv')
            .pipe(csv())
            .on('data', (row) => {
                const userId = row['user_id'];
                const bookId = row['book_id'];
                const rating = parseFloat(row['rating']);
                allRatings.push({ userId, bookId, rating });
            })
            .on('end', () => {
                const userRatingsMap = {};

                // Group all ratings by user
                allRatings.forEach(({ userId, bookId, rating }) => {
                    if (!userRatingsMap[userId]) userRatingsMap[userId] = [];
                    userRatingsMap[userId].push({ bookId, rating });
                });

                // Split each user's ratings
                Object.entries(userRatingsMap).forEach(([userId, ratings]) => {
                    if (ratings.length < 2) return; // Skip users with < 2 ratings

                    const shuffled = ratings.sort(() => Math.random() - 0.5);
                    const splitIdx = Math.floor(shuffled.length * 0.8);
                    const trainSet = shuffled.slice(0, splitIdx);
                    const testSet = shuffled.slice(splitIdx);

                    trainSet.forEach(({ bookId, rating }) => {
                        if (!userBookTrain[userId]) userBookTrain[userId] = {};
                        userBookTrain[userId][bookId] = rating;
                        trainRatings.push({ userId, bookId, rating });
                    });

                    testSet.forEach(({ bookId, rating }) => {
                        if (!userBookTest[userId]) userBookTest[userId] = {};
                        userBookTest[userId][bookId] = rating;
                        testRatings.push({ userId, bookId, rating });
                    });
                });

                fs.writeFileSync('userBookTrain.json', JSON.stringify(userBookTrain));
                fs.writeFileSync('trainRatings.json', JSON.stringify(trainRatings));
                fs.writeFileSync('userBookTest.json', JSON.stringify(userBookTest));
                fs.writeFileSync('testRatings.json', JSON.stringify(testRatings));

                resolve();
            });
    });
}

app.use(cors());

(async () => {
    await loadAndSplitRatings();
})();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});