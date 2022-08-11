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

/**
 * @param {string} query
 */
const search = query => {
  return db.data.filter(post => {
    return post.text.match(new RegExp(query, 'i'))
  })
}

/**
 * @param {string} id - if event is error, id is the error message
 * @param {string} event
 */
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
    case 'error':
      resp = `We got a problem: ${id}` // id is now the error message ha ha hahahhahaheg
  }

  bot.sendMessage('@' + helperChannelId, resp)
}

/**
 * @param {string} event 
 * @param {Object} msg 
 * @param {string} match - is null unless in deletePost event
 */
async function handle(event, msg, match) {
  try {
    switch (event) {

      case "newPost": 
        db.data.push({
          id: msg.message_id,
          text: msg.caption || '',
          height: msg.photo.at(-1).height,
          width: msg.photo.at(-1).width
        })
        await db.write()
        informMe(msg.message_id, event)
        break

      case "editPost":
        const index = db.data.findIndex(post => {
          return post.id == msg.message_id
        })
        if (index >= 0) {
          db.data[index].text = msg.caption
          await db.write()
        } else {
          throw "Editing a non-existing post."
        }
        informMe(msg.message_id, event)
        break

      case "deletePost":
        const updatedData = db.data.filter(p => {return p.id !== parseInt(match[1])})
        if (updatedData.length == db.data.length) {
          throw `Post #${match[1]} does not exist.`
        }
        db.data = updatedData
        await db.write()
        informMe(match[1], event)
        break
        
      case "inlineQuery":
        const results = search(msg.query).map(r => {
          return {
            id: r.id,
            type: 'photo',
            photo_url: `https://t.me/${channelId}/${r.id}`,
            thumb_url: `https://t.me/${channelId}/${r.id}`,
            photo_height: r.height,
            photo_width: r.width
          }
        }).slice(0, 50)

        bot.answerInlineQuery(msg.id, results)
    }
  } catch(error) {
    informMe(error, "error")
  }
}

bot.on('channel_post', msg => {
  if (msg.photo && msg.sender_chat.username == channelId) {
    handle("newPost", msg, null)
  }
})

bot.on('edited_channel_post_caption', msg => {
  if (msg.photo && msg.sender_chat.username == channelId) {
    handle("editPost", msg, null)
  }
})

bot.onText(/\/delete (.+)/, (msg, match) => {
  if (msg.from.username == myUsername) {
    handle("deletePost", msg, match)
  }
})

bot.on('inline_query', msg => {
  handle("inlineQuery", msg, null)
})
