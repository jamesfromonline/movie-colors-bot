require("dotenv").config()
const ColorThief = require("colorthief")
const { createCanvas } = require("canvas")
const Twit = require("twit")
const fs = require("fs")

const t = new Twit({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  timeout_ms: 60 * 1000,
  strictSSL: true,
})

// // return color palette array from the movie poster
const getColorPaletteFromImage = async (url) => {
  try {
    const colorPalette = await ColorThief.getPalette(url, 8)
    return colorPalette
  } catch (e) {
    console.log(e.message)
    process.exit(0)
  }
}

// // draw the color palette data into a grid and save it as a png, also fetch save the poster image
const generateColorPaletteImage = async (colors, id) => {
  const width = 1600
  const height = 900

  try {
    // const movie = (await getColorPaletteFromImage()) || null
    if (colors) {
      const p = colors
      const canvas = createCanvas(width, height)
      const ctx = canvas.getContext("2d")

      const c1 = p[0]
      ctx.fillStyle = `rgb(${c1[0]}, ${c1[1]}, ${c1[2]})`
      ctx.fillRect(0, 0, 320, 900)

      const c2 = p[1]
      ctx.fillStyle = `rgb(${c2[0]}, ${c2[1]}, ${c2[2]})`
      ctx.fillRect(320, 0, 320, 900)

      const c3 = p[2]
      ctx.fillStyle = `rgb(${c3[0]}, ${c3[1]}, ${c3[2]})`
      ctx.fillRect(640, 0, 320, 900)

      const c4 = p[3]
      ctx.fillStyle = `rgb(${c4[0]}, ${c4[1]}, ${c4[2]})`
      ctx.fillRect(960, 0, 320, 900)

      const c5 = p[4]
      ctx.fillStyle = `rgb(${c5[0]}, ${c5[1]}, ${c5[2]})`
      ctx.fillRect(1280, 0, 320, 900)

      const buffer = canvas.toBuffer("image/png")
      fs.writeFileSync(`./palette-${id}.png`, buffer)

      return `./palette-${id}.png`
    }
  } catch (e) {
    console.log(e.message)
    process.exit(0)
  }
}

// // adds media ID to status before posting
const updateStatus = (mediaIds, status) => {
  let meta_params = { media_id: mediaIds[0] }
  t.post("media/metadata/create", meta_params, (err, data, response) => {
    if (!err) {
      let params = {
        status: status.status,
        in_reply_to_status_id: status.in_reply_to_status_id,
        media_ids: mediaIds,
      }
      t.post("statuses/update", params, (err, data, response) => {
        if (err) {
          console.log(`Error occured updating status\t${err}`)
        } else {
          fs.unlinkSync(status.palettePath)
          console.log("tweet sent")
        }
      })
    } else {
      console.log(`Error creating metadata\t${err}`)
      process.exit(0)
    }
  })
}

// // send the media metadata endpoint the images
const uploadMedia = (file, callback) => {
  t.post(
    "media/upload",
    { media: fs.readFileSync(file).toString("base64") },
    (err, data) => {
      if (!err) {
        let mediaId = data.media_id_string
        callback(mediaId)
      } else {
        console.log(`Error occured uploading content\t${err}`)
        process.exit(0)
      }
    }
  )
}

const tweetImages = (files, response) => {
  let mediaIds = new Array()
  files.forEach((file) => {
    setTimeout(() => {
      uploadMedia(file, (mediaId) => {
        mediaIds.push(mediaId)
        if (mediaIds.length === files.length) {
          updateStatus(mediaIds, response)
        }
      })
    }, 1000)
  })
}

const handleColorPaletteCreationEvent = async (input) => {
  const { parentTweet, callingTweetID, username } = input
  try {
    t.get(
      "statuses/show/:id",
      { id: parentTweet.toString() },
      async (err, data, res) => {
        if (!err) {
          const {
            entities: { media },
          } = data
          if (media.length > 0) {
            const mediaUrl = media[0].media_url_https
            const colors = await getColorPaletteFromImage(mediaUrl)
            const colorPalettePath = await generateColorPaletteImage(
              colors,
              media[0].id_str
            )
            const response = {
              status: `@${username}`,
              in_reply_to_status_id: callingTweetID,
              palettePath: colorPalettePath,
            }
            tweetImages([colorPalettePath], response)

          } else {
            // handle no media response
          }
        }
      }
    )
  } catch (e) {
    console.log(e.message)
  }
}

const { Autohook } = require("twitter-autohook")

const listenForHooks = async () => {
  try {
    const webhook = new Autohook({
      token: process.env.TWITTER_ACCESS_TOKEN,
      token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
      consumer_key: process.env.TWITTER_CONSUMER_KEY,
      consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
      env: process.env.TWITTER_WEBHOOK_ENV,
      port: 5555,
    })

    // Removes existing webhooks
    await webhook.removeWebhooks()

    webhook.on("event", (event) => {
      if (event?.tweet_create_events && event?.tweet_create_events[0]?.text === "@colorpaletteb0t") {
        const {
          in_reply_to_status_id_str,
          id_str,
          user: { id, screen_name },
        } = event.tweet_create_events[0]
        const params = {
          parentTweet: in_reply_to_status_id_str,
          callingTweetID: id_str,
          username: screen_name,
        }
        handleColorPaletteCreationEvent(params)
      }
    })

    await webhook.start()

    await webhook.subscribe({
      oauth_token: process.env.TWITTER_ACCESS_TOKEN,
      oauth_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    })
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}

listenForHooks()
