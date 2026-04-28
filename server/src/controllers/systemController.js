import SystemConfig from '../models/SystemConfig.js';

// Simple in-memory cache
let commitCache = {
    data: null,
    lastFetch: 0
};
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export const getCommits = async (req, res) => {
    try {
        // Check cache first
        if (commitCache.data && (Date.now() - commitCache.lastFetch < CACHE_DURATION)) {
            console.log('Serving commits from cache');
            return res.json(commitCache.data);
        }

        console.log('Fetching commits from GitHub API...');
        
        const headers = {
            'Accept': 'application/vnd.github.v3+json'
        };

        // Use Token if available
        if (process.env.GITHUB_TOKEN) {
            headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
        }

        const response = await fetch('https://api.github.com/repos/voidx23/medicine-requirement-system/commits?per_page=100', {
            headers
        });
        
        if (!response.ok) {
            // If rate limited, try to serve stale cache as fallback
            if (response.status === 403 && commitCache.data) {
                console.warn('Rate limited, serving stale cache');
                return res.json(commitCache.data);
            }
            throw new Error(`GitHub API responded with ${response.status}`);
        }

        const data = await response.json();
        
        const commits = data.map(item => ({
            hash: item.sha.substring(0, 7),
            message: item.commit.message.split('\n')[0],
            date: item.commit.author.date,
            author: item.commit.author.name
        }));

        // Update cache
        commitCache = {
            data: commits,
            lastFetch: Date.now()
        };

        res.json(commits);
    } catch (apiError) {
        console.error('GitHub API failed:', apiError);
        res.status(500).json({ 
            message: 'Failed to fetch git history', 
            apiError: apiError.message 
        });
    }
};

export const getSystemVersion = async (req, res) => {
    try {
        let config = await SystemConfig.findOne();
        if (!config) {
            config = await SystemConfig.create({ clientVersion: 1 });
        }
        res.json({ clientVersion: config.clientVersion });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const forceRefreshClients = async (req, res) => {
    try {
        let config = await SystemConfig.findOne();
        if (!config) {
            config = await SystemConfig.create({ clientVersion: 1 });
        }
        config.clientVersion += 1;
        await config.save();
        res.json({ message: 'Clients forced to refresh', clientVersion: config.clientVersion });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

import Branch from '../models/Branch.js';

export const updateTelemetry = async (req, res) => {
    try {
        const { clientVersion } = req.body;
        if (req.user && req.user.role === 'branch' && clientVersion) {
            await Branch.findByIdAndUpdate(req.user._id, { appVersion: clientVersion });
        }
        res.json({ message: 'Telemetry logged' });
    } catch (error) {
        // Silent fail
        res.status(200).json({ message: 'Telemetry ignored' });
    }
};