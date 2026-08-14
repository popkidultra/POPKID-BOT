require('dotenv').config();
global.sessionid = process.env.SESSION_ID || 'POPKID~H4sIAAAAAAAAA5VU246jRhD9lahfbe2AuVsaKdjjKxdjYzCeaB/a0EAb3OCmsY1XftzvyE/kPd+SL8gvRHhmdldJdjNB9dBUt6pO1alTnwApcIUM1ID+J1BSfIIMtUfWlAj0waCOY0RBF0SQQdAHB3NbONCrR0Uk9KbakpCGR3avwGZKzWO8OWWJxZcitQ7VI7h1QVnvchz+IKDuH2kWPQfL/UzumFCnTUdxLqcR3YrUrXgzuISN5UJKku0juLURIaaYJKMyRQdEYW6gxoGYvg9+Yzyd5p08WUzjyHbQRjB2EB0edK4Yp4pTauEitS4b0fS87fvgV4V+dSHjRGNurvZy7xrbHJoWknsddnJaN6cD25g0pTThXuBXOCEomkWIMMyad/d9O0/1fI93rrPbk+fsYa/ulMs2D1YTdc+8SFkNPXcZmLtjMHsf8NBnnpUarnyZDazlUFcWlpjhJoiU8JA7e7VQqAypqFx98VvgDn2blez/9J0b1pF7xPkomi2uHcl/Ojuqrz5EQ2kp1NIoe7I6q8EktVM+fB/85ewS7HpSeJIWm0iysCq7wqC35J6oqhnY0YjTWc5SUZTW1lf4kNX0Ryivp008UMPA6521zXk5gabujLN5tOG34owMKUol73JUVGTvzj5uslp+xigYeVJwXXcccVq6apEHkhjbE1scG0dZ9iY4ebxXlKFmFoE+f+sCihJcMQoZLkjr64lSF8Do5KKQInZvL+CJltbeUQmP5maKuKQZjzvKcM7r0/FqoExjucm3F9uKV5n6CLqgpEWIqgpFU1yxgjYWqiqYoAr0f/nYBQRd2AtxbTqB74IY04p5pC7zAkZvrL5dwjAsasLchoTD9oAo6HNf3YgxTJKq7WNNIA1TfELDFLIK9GOYV+hLhYiiCPQZrdEX1Q6LqG38XN9avcDkQRcc7oTgCPRBTxJ5jlMlQdD4vsj/XH04t2FhWX4giIEuyO/PeJWTBVVUNUmU1Z7YvmwvuoDANhj48/ff/mY//dP1xf74/Ov3rKXttegWY4QYxHkF+mBo9ax07S1VO2DcebvVXV03dL0l4q1Jb9P2wqa/iueKOypgPJeGU2GUeZuQPjAy4LHmD54tV2B8navXfBL+W5B2z6iWpnJxmMiLanXNZOZLydPAFjZz1Y3H8uT54kzZgkah6Wwn3BnOLUNMN+sJoxPbuF4H5cTs1G59QeS6TXdji85oqp8f22wROuEQfZssmCceI/LQnaZX/LTSxvZ0NDf254fdKB5ke+Fh5R/U8tTR4PQwV6XE71imcGGD7LhPe2R8PYykk6uMbLzxRSPH08xbQ3x+0cFdh/nr/sP3CW3pb39jjO7r5JXH/xyHF+Dt1HK37jcxXhfUd0Q+8L2gQVxqTEiDlql2mY/HxHhQns/R9uQvN+sRU6JdGVvSioDb7WMXlDlkcUEPoA8giWhxHzZa1K0MZiQufpBsOJjN9CSx28pzWDH9q7TW+IAqBg8l6POKKouK0ON7XXBo9LJ0GWRvigR6+000G9z+AoojZHStBwAA';
global.BOT_PREFIX = '.';
global.owners = ['254100853391@lid', ''];
global.dev = ['254100853391@s.whatsapp.net','254100853391@lid'];
global.menuImage = 'https://i.ibb.co/WNv1hWXT/file-000000001f5c81f4a38f20223ae695d1.png';
global.ownerName = '😷popkid😷';

// Auto features (toggle at runtime with the .autofeature command)
global.autoRead = false;      // mark every incoming chat message as read
global.autoView = true;       // mark statuses as viewed (kept on, matches previous behavior)
global.autoLike = true;       // react to statuses with an emoji
global.autoReactEmoji = 'random'; // set to a specific emoji e.g. '❤️' to always use that one
global.statusReactThrottleMs = 5000; // min ms between status reactions (prevents burst-spam)
global.statusReactDelayMs = 2000;    // pause after reacting before handling the next status
global.presenceMode = 'none'; // 'none' | 'typing' | 'recording' | 'online'
global.updateZipUrl = 'https://github.com/popkidultra/POPKID-BOT/archive/refs/heads/main.zip';
global.antidelete = 'false';  // 'false' | 'inchat' | 'indm' — toggle at runtime with .antidelete
