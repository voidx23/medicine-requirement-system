import { exec } from 'child_process';

//@ Get local git commits
//@ GET /api/system/commits

export const getCommits = (req, res) => {
    // Run git log command
    // %h=hash, %s=subject, %ad=date, %an=author
    exec('git log --pretty=format:"%h|%s|%ad|%an" --date=iso', (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).json({ message: 'Failed to fetch git log' });
        }
        // Parse output line by line
        const commits = stdout.split('\n')
            .filter(line => line)
            .map(line => {
                const [hash, message, date, author] = line.split('|');
                return { hash, message, date, author };
            });
        res.json(commits);
    });

};