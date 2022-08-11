import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'
import { Low, JSONFile } from 'lowdb'

dotenv.config()

const token = process.env.TOKEN
const channelId = process.env.CHANNEL_ID
const helperChannelId = process.env.HELPER_CHANNEL_ID
const myUsername = process.env.ME

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
    case 'newPost':
      resp = `Added #${id} to the database.`
      break;
    case 'editPost':
      resp = `Edited #${id} in the database.`
      break;
    case 'deletePost':
      resp = `Deleted #${id} from the database.`
      break;
    case 'fail':
      resp = `We got a problem: ${id}` // id is now the error message ha ha hahahhahaheg
    default: 
      resp = "what the fuck"
  }

  bot.sendMessage('@' + helperChannelId, resp)
}

async function handlePost(msg) {
  db.data.push({
    id: msg.message_id,
    text: msg.caption || '',
    height: msg.photo.at(-1).height,
    width: msg.photo.at(-1).width
  })

  await db.write()
}

async function handleEdit(msg) {
  const index = db.data.findIndex(post => {
    return post.id == msg.message_id
  })

  if (index >= 0) {
    db.data[index].text = msg.caption
    await db.write()
  }
}

async function handleDelete(msg, match) {
  db.data = db.data.filter(post => {return post.id !== parseInt(match[1])})
  await db.write()
}

bot.on('channel_post', msg => {
  if (msg.photo && msg.sender_chat.username == channelId) {
    handlePost(msg).then(
    () => informMe(msg.message_id, 'newPost'),
    err => informMe(err, 'fail')
  )
  }
})

bot.on('edited_channel_post_caption', msg => {
  if (msg.photo && msg.sender_chat.username == channelId) {
    handleEdit(msg).then(
    () => informMe(msg.message_id, 'editPost'),
    err => informMe(err, 'fail')
  )
  }
})

bot.onText(/\/delete (.+)/, (msg, match) => {
  if (msg.from.username == myUsername) {
    handleDelete(msg, match).then(
    () => informMe(match[1], 'deletePost'),
    err => informMe(err, 'fail')
  )
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
