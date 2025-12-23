export const getCommits = async (req, res) => {
    try {
        console.log('Fetching commits from GitHub API...');
        const response = await fetch('https://api.github.com/repos/voidx23/medicine-requirement-system/commits?per_page=100');
        
        if (!response.ok) {
                throw new Error(`GitHub API responded with ${response.status}`);
        }

        const data = await response.json();
        
        const commits = data.map(item => ({
            hash: item.sha.substring(0, 7),
            message: item.commit.message.split('\n')[0],
            date: item.commit.author.date,
            author: item.commit.author.name
        }));

        res.json(commits);
    } catch (apiError) {
        console.error('GitHub API failed:', apiError);
        res.status(500).json({ 
            message: 'Failed to fetch git history', 
            apiError: apiError.message 
        });
    }
};