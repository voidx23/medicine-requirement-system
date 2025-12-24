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