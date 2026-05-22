const fs = require('fs');

['primary', 'secondary'].forEach(acc => {
    const file = '/data/' + acc + '/botinfo.json';
    if (fs.existsSync(file)) {
        let d = JSON.parse(fs.readFileSync(file, 'utf8'));
        d.tvMode = true;
        d.tvConfig = {
            triggerText: 'hey, i want to join tadstech. my name is ',
            welcomeMessage: 'Welcome! I’ve saved your number as {{name}}.'
        };
        fs.writeFileSync(file, JSON.stringify(d, null, 2));
        console.log('Updated ' + file);
    }
});
