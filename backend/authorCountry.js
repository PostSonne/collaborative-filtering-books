const axios = require('axios');

const fs = require('fs').promises;

const sleep = ms => new Promise(res => setTimeout(res, ms));

async function fetchAndSortAuthors(query) {
    const url = `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(query)}`;
    const res = await axios.get(url);
    const authors = res.data.docs;

    const sorted = authors.sort((a, b) => {
        const ratingDiff = (b.ratings_count || 0) - (a.ratings_count || 0);
        if (ratingDiff !== 0) return ratingDiff;

        const workDiff = (b.work_count || 0) - (a.work_count || 0);
        if (workDiff !== 0) return workDiff;

        return (b.readinglog_count || 0) - (a.readinglog_count || 0);
    });

    return sorted;
}

async function fetchWithRetry(url, options = {}, retries = 4, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(url, options);
            if (!response || !response.data) throw new Error("Empty response");
            return response;
        } catch (e) {
            const isRateLimit = e.response?.status === 429;
            const isTLS = e.code === 'ECONNRESET' || e.message.includes('TLS');
            const isNetworkError = !e.response || isTLS;

            if (i === retries - 1) {
                throw new Error(`Failed after ${retries} attempts: ${e.message}`);
            }

            const wait = delay * Math.pow(2, i); // exponential backoff
            console.warn(`Retry ${i + 1}/${retries} (${isRateLimit ? "rate limit" : isNetworkError ? "network error" : "other error"}): waiting ${wait}ms`);
            await sleep(wait);
        }
    }
}

async function getCountryFromWikidata(wikidataId) {
    const sparqlQuery = `
    SELECT ?countryLabel WHERE {
      wd:${wikidataId} wdt:P27 ?country .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    } LIMIT 1
  `;
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}`;
    const res = await fetchWithRetry(url, {
        headers: { 'Accept': 'application/sparql-results+json' }
    });
    const bindings = res.data.results.bindings;
    return bindings[0]?.countryLabel?.value || null;
}

async function getCountriesForAuthors(authorString) {
    const names = authorString.split(',').map(name => name.trim());
    const countries = [];

    for (const name of names) {
        try {
            const docs = await fetchAndSortAuthors(name);
            if (!docs.length) {
                console.warn(` Author not found: ${name}`);
                countries.push(null);
                continue;
            }

            const authorKey = docs[0].key;
            console.log(authorKey);
            const detailUrl = `https://openlibrary.org/authors/${authorKey}.json`;
            const detailsRes = await fetchWithRetry(detailUrl);
            const wikidataId = detailsRes.data?.remote_ids?.wikidata;
            console.log(wikidataId);
            if (!wikidataId) {
                countries.push(null);
                continue;
            }

            const country = await getCountryFromWikidata(wikidataId);
            console.log(country);
            countries.push(country || null);
        } catch (e) {
            console.error(`Error fetching country for ${name}:`, e.message);
            countries.push(null);
        }
    }

    return {
        authors: authorString,
        countries
    };
}

module.exports.getCountriesForAuthors = getCountriesForAuthors;