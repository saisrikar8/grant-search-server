const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch').default;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/api/opportunities', async (req, res) => {
    const apiUrl = 'https://api.grants.gov/v1/api/search2';

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(req.body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: `Grants.gov API error: ${errorText}` });
        }

        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Error contacting Grants.gov:', err);
        res.status(500).json({ error: 'Server error while contacting Grants.gov' });
    }
});

app.post('/api/search-grants', async (req, res) => {
    const { query } = req.body;

    if (!query || query.trim() === '') {
        return res.status(400).json({ error: 'Missing or empty query' });
    }

    try {
        // Call your existing proxy API to search grants
        const response = await fetch('http://localhost:3000/api/opportunities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                keyword: query,
                oppStatuses: 'forecasted|posted',
                sortBy: 'openDate|desc',
                rows: 5,   // limit results for chatbot
                startRecordNum: 0,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: `Grants API error: ${errorText}` });
        }

        const data = await response.json();
        const grants = data.data?.oppHits?.map((g) => ({
            id: g.id,
            title: g.title,
            agency: g.agency,
            openDate: g.openDate,
            closeDate: g.closeDate,
            link: `https://www.grants.gov/search-results-detail/${encodeURIComponent(g.id)}`,
        })) || [];

        res.json({ grants });
    } catch (error) {
        console.error('Error in /api/search-grants:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
