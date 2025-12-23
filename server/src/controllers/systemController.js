import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export const getCommits = async (req, res) => {
    try {
        // STRATEGY 1: Try Local Git Command (Fastest, best for Dev PCs)
        // %h=hash, %s=subject, %ad=date, %an=author
        const { stdout } = await execPromise('git log --pretty=format:"%h|%s|%ad|%an" --date=iso');
        
        const commits = stdout.split('\n')
            .filter(line => line)
            .map(line => {
                const parts = line.split('|');
                if (parts.length < 4) return null;
                const [hash, message, date, author] = parts;
                return { hash, message, date, author };
            })
            .filter(c => c !== null);

        // If we got commits, return them
        if (commits.length > 0) {
            return res.json(commits);
        }
        throw new Error('Local git returned empty');

    } catch (localError) {
        console.warn('Local git failed, falling back to GitHub API:', localError.message);

        // STRATEGY 2: Fallback to GitHub API (For Render/Vercel/Mobile where .git is missing)
        try {
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
            console.error('All fetch strategies failed:', apiError);
            res.status(500).json({ 
                message: 'Failed to fetch git history', 
                localError: localError.message,
                apiError: apiError.message 
            });
        }
    }
};