const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");
const slugify = require("slugify");
const mkdir = require("mkdirp");

const data = require("./data");

class SkillShare {
  constructor(cookie, downloadPath, pk, account_id) {
    this.cookie = cookie.trim().replace('"', "");
    this.downloadPath = downloadPath;
    this.pk = pk.trim();
    this.account_id = account_id;
  }

  downloadByUrl(url) {
    let skillShareRegex = new RegExp(
      "https://www.skillshare.com/classes/.*?/(\\d+)"
    );

    let matches = url.match(skillShareRegex);
    let classId = matches[1];
    this.downloadByClassId(classId);
  }

  async downloadByClassId(classId) {
    let data = await this.fetchByClassId(classId);
    const title = data.title;
    if (data) {
      let teacherName = null;
      if (data["_embedded"]["teacher"]["vanity_username"]) {
        teacherName = data["_embedded"]["teacher"]["vanity_username"];
      } else {
        teacherName = data["_embedded"]["teacher"]["full_name"];
      }

      const basePath = path.join(
        this.downloadPath,
        slugify(teacherName),
        slugify(title)
      );

      let pathCreated = await mkdir(basePath);
      if (pathCreated) {
        let downloadVideosPromises = [];
        // Loop over data object
        data["_embedded"]["units"]["_embedded"]["units"].forEach(unit => {
          Object.values(
            unit["_embedded"]["sessions"]["_embedded"]["sessions"]
          ).forEach(session => {
            let videoId = null;
            if (session["video_hashed_id"]) {
              videoId = session["video_hashed_id"].split(":")[1];
              let sessionTitle = session["title"];
              let fileName = `${this.pad(session.index + 1)} - ${slugify(
                sessionTitle
              )}`;
              let filePath = `${basePath}/${fileName}.mp4`;
              downloadVideosPromises.push(
                this.downloadVideo(filePath, videoId)
              );
            } else {
              console.error("Failed to read video id");
            }
          });
        });

        await Promise.all(downloadVideosPromises);
      } else {
        console.log("Path exists");
      }
    }
  }

  async fetchByClassId(classId) {
    try {
      const response = await fetch(
        `https://api.skillshare.com/classes/${classId}`,
        {
          headers: {
            Accept: "application/vnd.skillshare.class+json;,version=0.8",
            "User-Agent": "Skillshare/4.1.1; Android 5.1.1",
            Host: "api.skillshare.com",
            cookie: this.cookie
          }
        }
      );

      const data = await response.json();
      return data;
    } catch (err) {
      console.log(err);
    }
  }

  async downloadVideo(filePath, videoId) {
    let DOWNLOAD_URL = `https://edge.api.brightcove.com/playback/v1/accounts/${data.account_id}/videos/${videoId}`;
    try {
      const response = await fetch(DOWNLOAD_URL, {
        headers: {
          Accept: `application/json;pk=${data.pk}`,
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64; rv:52.0) Gecko/20100101 Firefox/52.0",
          Origin: "https://www.skillshare.com"
        }
      });

      let jsonData = await response.json();
      let dw_url = null;
      if (jsonData) {
        jsonData.sources.forEach(source => {
          if (source.container && source.container === "MP4" && source.src) {
            dw_url = source.src;
          }
        });

        if (fs.existsSync(filePath)) {
          console.log("Video Downloaded, skipping...");
          return;
        }

        const fileStream = fs.createWriteStream(filePath);
        let res = await fetch(dw_url);
        await new Promise((resolve, reject) => {
          res.body.pipe(fileStream);
          res.body.on("data", chunk => {
            console.log(chunk);
          });
          res.body.on("error", err => {
            reject(err);
          });
          fileStream.on("finish", function() {
            resolve();
          });
        });
      }
    } catch (err) {
      console.error(err);
    }
  }

  pad(string, size) {
    var s = String(string);
    while (s.length < (size || 2)) {
      s = "0" + s;
    }
    return s;
  }
}

const skshare = new SkillShare(
  data.cookie,
  path.join(__dirname, "./SkillShare"),
  data.pk,
  data.account_id
);

skshare.downloadByUrl(
  "https://www.skillshare.com/classes/Pricing-Your-Work-and-Negotiating-with-Clients/1526419742?via=browse-featured"
);
