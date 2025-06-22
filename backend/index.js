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

                allRatings.forEach(({ userId, bookId, rating }) => {
                    if (!userRatingsMap[userId]) userRatingsMap[userId] = [];
                    userRatingsMap[userId].push({ bookId, rating });
                });

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

function loadBookMetaData() {
    return new Promise((resolve, reject) => {
        fs.readFile('bookMetadata.json', 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading the file:', err);
                return;
            }

            try {
                bookMetadata = JSON.parse(data);
                fullBookMetadata = JSON.parse(data);

                bookMetadata = Object.fromEntries(
                    Object.entries(bookMetadata).filter(([bookId, book]) =>
                        book.country?.some(c => c !== null)
                    )
                );
            } catch (parseErr) {
                console.error('Error parsing JSON:', parseErr);
            }
            resolve();
        });
    });
}

function loadAuthorsData() {
    return new Promise((resolve, reject) => {
        fs.readFile('authors.json', 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading the file:', err);
                return;
            }

            try {
                authors = JSON.parse(data);
            } catch (parseErr) {
                console.error('Error parsing JSON:', parseErr);
            }
            resolve();
        });
    });
}

function updateBookMetaData() {
    return new Promise((resolve, reject) => {
        fs.createReadStream('books.csv')
            .pipe(csv())
            .on('data', (row) => {
                const id = row['id'];
                const authors = row['authors'];
                const title = row['original_title'];
                const titleAlt = row['title'];
                const image_url = row['image_url'];
                const average_rating = row['average_rating'];
                bookMetadata[id] = {authors: authors, originalTitle: title || titleAlt, image: image_url, average_rating: average_rating};
            })
            .on('end', async () => {
                const allBooks = Object.keys(bookMetadata);

                for (let i = 0; i < allBooks.length; i++) {
                    const bookId = allBooks[i];
                    const {authors: authorStr} = bookMetadata[bookId];
                    const names = authorStr.split(',').map(name => name.trim());

                    const allKnown = names.every(name => authors[name]?.country !== undefined);
                    if (allKnown) {
                        bookMetadata[bookId].country = names.map(name => authors[name].country);
                        fs.writeFileSync('bookMetadata.json', JSON.stringify(bookMetadata, null, 2));
                        console.log(`Skipped ${bookId} (cached)`);
                        continue;
                    }

                    try {
                        const res = await getCountriesForAuthors(authorStr);
                        bookMetadata[bookId].country = res.countries;

                        names.forEach((name, idx) => {
                            authors[name] = {country: res.countries[idx]};
                        });

                        fs.writeFileSync('bookMetadata.json', JSON.stringify(bookMetadata, null, 2));
                        fs.writeFileSync('authors.json', JSON.stringify(authors, null, 2));

                        console.log(`Processed: ${bookId}`);
                    } catch (err) {
                        console.error(`Error processing ${bookId}: ${err.message}`);
                    }

                }
                resolve();
            });
    });
}

app.use(cors());

(async () => {
    await loadAndSplitRatings();
    await loadBookMetaData();
    await loadAuthorsData();
    await updateBookMetaData();
    await loadAndSplitRatings();
})();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});