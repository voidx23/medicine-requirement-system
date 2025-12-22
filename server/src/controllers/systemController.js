export const getCommits = async (req, res) => {
    try {
        // Fetch commits from GitHub Repository
        const response = await fetch('https://api.github.com/repos/voidx23/medicine-requirement-system/commits?per_page=100');
        
        if (!response.ok) {
             throw new Error(`GitHub API responded with ${response.status}`);
        }

        const data = await response.json();
        
        // Map GitHub response to our application's expected format
        const commits = data.map(item => ({
            hash: item.sha.substring(0, 7),
            message: item.commit.message.split('\n')[0], // Use first line of commit message
            date: item.commit.author.date,
            author: item.commit.author.name
        }));

        res.json(commits);
    } catch (error) {
        console.error('Error fetching commits from GitHub:', error);
        res.status(500).json({ message: 'Failed to fetch git history' });
    }
};