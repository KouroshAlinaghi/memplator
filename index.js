const dotenv = require('dotenv')
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api')

dotenv.config()

let rawdata = fs.readFileSync('database.json');
let posts = JSON.parse(rawdata);
const token = process.env.TOKEN

const bot = new TelegramBot(token, {polling: true})

const search = query => {
  return posts.filter(m => {
    return m.text.match(new RegExp(query, 'i'))
  })
}

bot.on('inline_query', msg => {
  const results = search(msg.query).map(r => {
    return {
      id: r.id,
      type: "photo",
      photo_url: `https://t.me/memplate/${r.id}`,
      thumb_url: `https://t.me/memplate/${r.id}`,
      photo_height: r.height,
      photo_width: r.width
    }
  }).slice(0, 50)

  bot.answerInlineQuery(msg.id, results)
})
