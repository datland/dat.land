var path = require('path')

module.exports = {
  data: '',
  mixpanel: process.env.MIXPANEL || path.join('secrets', 'mixpanel'),
  township: {
    db: 'datland-township.db',
    publicKey: path.join('secrets', 'ecdsa-p521-public.pem'),
    privateKey: path.join('secrets', 'ecdsa-p521-private.pem'),
    algorithm: 'ES512'
  },
  email: {
    from: 'noreply@datproject.org',
    smtpConfig: {
      host: 'smtp.postmarkapp.com',
      port: 25,
      auth: {
        username: process.env.POSTMARK_KEY,
        password: process.env.POSTMARK_KEY
      }
    }
  },
  db: {
    dialect: 'sqlite3',
    connection: {
      filename: 'datland-production.db'
    },
    useNullAsDefault: true
  },
  whitelist: false
}
