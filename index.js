import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'
import { Low, JSONFile } from 'lowdb'

const token=process.env.TOKEN
const channel_id=process.env.CHANNEL_ID
const helper_channel_id=process.env.HELPER_CHANNEL_ID

dotenv.config()

const adapter = new JSONFile('database.json')
const db = new Low(adapter)

await db.read()

const bot = new TelegramBot(token, {polling: true})

const search = query => {
  return db.data.filter(post => {
    return post.text.match(new RegExp(query, 'i'))
  })
}

const informMe = (msg, event) => {
  bot.sendMessage('@' + helper_channel_id, `${event}ed https://t.me/${channel_id}/${msg.message_id} in database.`)
}

async function handle_post(msg) {
  if (msg.photo && msg.sender_chat.username == channel_id) {
    db.data.push({
      id: msg.message_id,
      text: msg.caption,
      height: msg.photo[msg.photo.length - 1].height,
      width: msg.photo[msg.photo.length - 1].width
    })

    db.write()
  }
}

async function handle_edit(msg) {
  if (msg.photo && msg.sender_chat.username == channel_id) {
    const index = db.data.findIndex(post => {
      return post.id == msg.message_id
    })

    if (index >= 0) {
      db.data[index].text = msg.caption
      db.write()
    }
  }
}

bot.on('channel_post', msg => {
  handle_post(msg).then(informMe(msg, 'Add'))
})

bot.on('edited_channel_post_caption', msg => {
  handle_edit(msg).then(informMe(msg, 'Edit'))
})

bot.on('inline_query', msg => {
  const results = search(msg.query).map(r => {
    return {
      id: r.id,
      type: 'photo',
      photo_url: `https://t.me/${channel_id}/${r.id}`,
      thumb_url: `https://t.me/${channel_id}/${r.id}`,
      photo_height: r.height,
      photo_width: r.width
    }
  }).slice(0, 50)

  bot.answerInlineQuery(msg.id, results)
})
