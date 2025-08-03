const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const OpenAI = require('openai');
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/api/opportunities', async (req, res) => {
    try {
        const response = await fetch('https://api.grants.gov/v1/api/search2', {
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
        const grantsGovResponse = await fetch('https://api.grants.gov/v1/api/search2', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                keyword: "",
                oppStatuses: 'forecasted|posted',
                sortBy: 'openDate|desc',
                rows: 50,
                startRecordNum: 0,
            }),
        });

        if (!grantsGovResponse.ok) {
            const errorText = await grantsGovResponse.text();
            return res.status(grantsGovResponse.status).json({ error: `Grants.gov API error: ${errorText}` });
        }

        const data = await grantsGovResponse.json();

        const grants = data.data?.oppHits?.map(g => ({
            title: g.title,
            agency: g.agency,
        })) || [];

        const titlesAndAgencies = grants.map((g, i) => `${i + 1}. "${g.title}" — ${g.agency}`).join('\n');

        const messages = [
            {
                role: 'system',
                content:
                    `You are a strategic advisor helping people win U.S. federal grants.\n\n` +
                    `The user is searching for grants related to: "${query}".\n\n` +
                    `Here are 50 relevant grants:\n${titlesAndAgencies}\n\n` +
                    `Based on this, your job is to give 3 creative, high-level strategies someone could use to increase their odds of winning one of these.`,
            },
            {
                role: 'user',
                content: `What strategies would you suggest to someone interested in these types of grants?`,
            },
        ];

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0.9,
            messages,
            max_tokens: 25
        });

        const aiSuggestions = completion.choices[0].message.content.trim();

        res.json({ grants, aiSuggestions });

    } catch (error) {
        console.error('Error in /api/search-grants:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
