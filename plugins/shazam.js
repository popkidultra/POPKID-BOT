const fs = require('fs');
const acrcloud = require('acrcloud');

module.exports = {
    name: 'shazam',
    category: 'Tools',
    description: 'Identify music from audio/video',
    aliases: ['whatmusic', 'quemusica'],
    tags: ['tools'],
    command: /^\.?(shazam|whatmusic|quemusica)$/i,

    async execute(sock, m, args) {
        try {
            const acr = new acrcloud({
                host: 'identify-eu-west-1.acrcloud.com',
                access_key: 'c33c767d683f78bd17d4bd4991955d81',
                access_secret: 'bvgaIAEtADBTbLwiPGYlxupWqkNGIjT7J9Ag2vIu'
            });

            const quoted = m.quoted ? m.quoted : m;
            const mime = (quoted.msg || quoted).mimetype || '';

            if (!/audio|video/.test(mime)) {
                m.reply('Please respond to an audio or video message.');
                return;
            }

            m.reply('Identifying music...');

            const buffer = await quoted.download();
            const ext = mime.split('/')[1];
            const filePath = `./tmp/${m.sender.split('@')[0]}.${ext}`;

            if (!fs.existsSync('./tmp')) {
                fs.mkdirSync('./tmp', { recursive: true });
            }

            fs.writeFileSync(filePath, buffer);
            
            const res = await acr.identify(fs.readFileSync(filePath));
            const { code, msg } = res.status;

            if (code !== 0) {
                throw new Error(msg);
            }

            const { title, artists, album, genres, release_date } = res.metadata.music[0];
            
            const txt = `
RESULT
• TITLE: ${title}
• ARTIST: ${artists !== undefined ? artists.map(v => v.name).join(', ') : 'NOT FOUND'}
• ALBUM: ${album.name || 'NOT FOUND'}
• GENRE: ${genres !== undefined ? genres.map(v => v.name).join(', ') : 'NOT FOUND'}
• RELEASE DATE: ${release_date || 'NOT FOUND'}
            `.trim();

            fs.unlinkSync(filePath);
            
            m.reply(txt);

        } catch (err) {
            console.error('Shazam Error:', err);
            m.reply('Error identifying music: ' + err.message);
        }
    }
};
