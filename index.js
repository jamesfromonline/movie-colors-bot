require("dotenv").config();
const ColorThief = require("colorthief");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { createCanvas } = require("canvas");
const Twit = require("twit");
const fs = require("fs");

const t = new Twit({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_SECRET,
  timeout_ms: 60 * 1000,
  strictSSL: true,
});

let latestMovieId = null;
let randomMovie = null;

const getLatestMovie = async () => {
    return new Promise(async (resolve, reject) => {
        try {
          const url = `
              https://api.themoviedb.org/3/movie/latest?api_key=${process.env.MOVIE_DB_KEY}&language=en-US`;
          const response = await fetch(url);
          const data = await response.json();
          resolve(data?.id)
        } catch (e) {
          console.log(e.message);
          reject(e.message)
          process.exit(-1);
        }
    })
};


const sleep = (amt) => new Promise(resolve => setTimeout(resolve, amt))

const getRandomID = async () => Math.floor(Math.random() * (await getLatestMovie() - 10) + 10);

const usedIdsRaw = fs.readFileSync("movies.json");
const usedIdsJson = JSON.parse(usedIdsRaw);
const usedIds = usedIdsJson.ids;
let movieId;

const getRandomMovie = async () => {
    return new Promise(async (resolve, reject) => {

        try {
          const randomId = await getRandomID();
          const url = `https://api.themoviedb.org/3/movie/${randomId}?api_key=${process.env.MOVIE_DB_KEY}&language=en-US`;
          const response = await fetch(url);
          const data = await response.json();
          if (data?.poster_path && data.adult === false) {
              if (!usedIds.includes(data.id)) {
                  movieId = data.id;
                  const info = {
                      id: data.id,
                      title: data.original_title,
                      release: data.release_date.substr(0, 4),
                      poster: `https://image.tmdb.org/t/p/original/${data.poster_path}`,
                  };
            
                  resolve({ ...info })
            } else {
              console.log("ID used. Running again");
              await getRandomMovie();
              return
            }
          } else {
              console.log('ID with poster not found')
              await sleep(2000)
              await getRandomMovie()
              return
          }
      
        } catch (e) {
          console.log(e.message);
          reject(e.message)
          process.exit(-1);
        }

    })
}



const getColorPaletteFromImage = async () => {
    try {
        const movie = await getRandomMovie() || null;
        if (movie) {
        const colorPalette = await ColorThief.getPalette(movie.poster, 8);
        return {
            ...movie,
            palette: colorPalette,
        };
        }
    } catch (e) {
        console.log(e.message);
        process.exit(-1);
    }
};


const generateColorPaletteImage = async () => {
  const width = 1600;
  const height = 1400;

  try {
    const movie = await getColorPaletteFromImage() || null
    if (movie) {
      const p = movie.palette;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");

      const c1 = p[0];
      ctx.fillStyle = `rgb(${c1[0]}, ${c1[1]}, ${c1[2]})`;
      ctx.fillRect(0, 0, 800, 350);

      const c2 = p[1];
      ctx.fillStyle = `rgb(${c2[0]}, ${c2[1]}, ${c2[2]})`;
      ctx.fillRect(800, 0, 800, 350);

      const c3 = p[2];
      ctx.fillStyle = `rgb(${c3[0]}, ${c3[1]}, ${c3[2]})`;
      ctx.fillRect(0, 350, 800, 350);

      const c4 = p[3];
      ctx.fillStyle = `rgb(${c4[0]}, ${c4[1]}, ${c4[2]})`;
      ctx.fillRect(800, 350, 800, 350);

      const c5 = p[4];
      ctx.fillStyle = `rgb(${c5[0]}, ${c5[1]}, ${c5[2]})`;
      ctx.fillRect(0, 700, 800, 350);

      const c6 = p[5];
      ctx.fillStyle = `rgb(${c6[0]}, ${c6[1]}, ${c6[2]})`;
      ctx.fillRect(800, 700, 800, 350);

      const c7 = p[6];
      ctx.fillStyle = `rgb(${c7[0]}, ${c7[1]}, ${c7[2]})`;
      ctx.fillRect(0, 1050, 800, 350);

      const c8 = p[7];
      ctx.fillStyle = `rgb(${c8[0]}, ${c8[1]}, ${c8[2]})`;
      ctx.fillRect(800, 1050, 800, 350);

      const buffer = canvas.toBuffer("image/png");
      fs.writeFileSync(`./palette.png`, buffer);

      const posterResponse = await fetch(movie.poster);
      const posterBuffer = await posterResponse.buffer();
      fs.writeFileSync(`./poster.jpg`, posterBuffer);

      const result = {
        ...movie,
        palettePath: `./palette.png`,
        posterPath: `./poster.png`,
      };

      delete result?.palette;
      return { ...result };
    }
  } catch (e) {
    console.log(e.message);
    process.exit(-1);
  }
};

const updateStatus = (mediaIds, status) => {
  let meta_params = { media_id: mediaIds[0] };
  t.post("media/metadata/create", meta_params, function (err, data, response) {
    if (!err) {
      let params = { status: status, media_ids: mediaIds };
      t.post("statuses/update", params, function (err, data, response) {
        if (err) {
          console.log(`Error occured updating status\t${err}`);
        } else {
          fs.unlinkSync(`./poster.jpg`);
          fs.unlinkSync(`./palette.png`);
          usedIds.push(movieId);
          fs.writeFileSync("movies.json", JSON.stringify({ ids: usedIds }));
          console.log("tweet sent");
          process.exit()
        }
      });
    } else {
      console.log(`Error creating metadata\t${err}`);
      process.exit(-1);
    }
  });
};

const uploadMedia = (file, callback) => {
  t.post(
    "media/upload",
    { media: fs.readFileSync(file).toString("base64") },
    function (err, data, response) {
      if (!err) {
        let mediaId = data.media_id_string;
        callback(mediaId);
      } else {
        console.log(`Error occured uploading content\t${err}`);
        process.exit(-1);
      }
    }
  );
};

const tweetImages = (files, status) => {
  let mediaIds = new Array();
  files.forEach(function (file, index) {
    uploadMedia(file, function (mediaId) {
      mediaIds.push(mediaId);
      if (mediaIds.length === files.length) {
        updateStatus(mediaIds, status);
      }
    });
  });
};

const postToTwitter = async () => {
  try {
    const data = await generateColorPaletteImage() || null
    if (data) {
      const files = ["poster.jpg", "palette.png"];
      const status = `${data.title} (${data.release})`;
      tweetImages(files, status);
    }
  } catch (e) {
    console.log(e.message);
  }
};


postToTwitter()
