import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'
import { Low, JSONFile } from 'lowdb'

dotenv.config()

const token = process.env.TOKEN
const channel_id = process.env.CHANNEL_ID
const helper_channel_id = process.env.HELPER_CHANNEL_ID
const my_username = process.env.ME

const adapter = new JSONFile('database.json')
const db = new Low(adapter)

await db.read()

const bot = new TelegramBot(token, {polling: true})

const search = query => {
  return db.data.filter(post => {
    return post.text.match(new RegExp(query, 'i'))
  })
}

const informMe = (id, event) => {
  let resp = ''
  switch (event) {
    case 'new_post':
      resp = `Added #${id} to the database.`
      break;
    case 'edit_post':
      resp = `Edited #${id} in the database.`
      break;
    case 'delete_post':
      resp = `Deleted #${id} from the database.`
  }

  bot.sendMessage('@' + helper_channel_id, resp)
}

async function handle_post(msg) {
  db.data.push({
    id: msg.message_id,
    text: msg.caption || '',
    height: msg.photo[msg.photo.length - 1].height,
    width: msg.photo[msg.photo.length - 1].width
  })

  db.write()
}

async function handle_edit(msg) {
  const index = db.data.findIndex(post => {
    return post.id == msg.message_id
  })

  if (index >= 0) {
    db.data[index].text = msg.caption
    db.write()
  }
}

async function handle_delete(msg, match) {
  db.data = db.data.filter(post => {return post.id !== parseInt(match[1])})
  db.write()
}

bot.on('channel_post', msg => {
  if (msg.photo && msg.sender_chat.username == channel_id) {
    handle_post(msg).then(informMe(msg.message_id, 'new_post'))
  }
})

bot.on('edited_channel_post_caption', msg => {
  if (msg.photo && msg.sender_chat.username == channel_id) {
    handle_edit(msg).then(informMe(msg.message_id, 'edit_post'))
  }
})

bot.onText(/\/delete (.+)/, (msg, match) => {
  if (msg.from.username == my_username) {
    handle_delete(msg, match).then(informMe(match[1], 'delete_post'))
  }
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
