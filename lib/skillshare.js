const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");
const slugify = require("slugify");
const mkdir = require("mkdirp");

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
    let DOWNLOAD_URL = `https://edge.api.brightcove.com/playback/v1/accounts/${this.account_id}/videos/${videoId}`;
    try {
      const response = await fetch(DOWNLOAD_URL, {
        headers: {
          Accept: `application/json;pk=${this.pk}`,
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
        let progress = document.querySelector("#progress");
        let res = await fetch(dw_url);
        let downloadResult = await new Promise((resolve, reject) => {
          res.body.pipe(fileStream);

          let len = parseInt(res.headers.get("content-length"), 10);
          let body = "";
          let cur = 0;
          let total = len / 1048576; //1048576 - bytes in  1Megabyte
          res.body.on("data", chunk => {
            body += chunk;
            cur += chunk.length;
            progress.innerHTML =
              "Downloading " +
              ((100.0 * cur) / len).toFixed(2) +
              "% " +
              (cur / 1048576).toFixed(2) +
              " mb\r" +
              ".<br/> Total size: " +
              total.toFixed(2) +
              " mb";
          });
          res.body.on("error", err => {
            progress.innerHTML = err;
            reject(err);
          });
          fileStream.on("finish", function() {
            progress.innerHTML = "Download Completed";
            document.querySelector("#submit_btn").disabled = false;
            resolve(body);
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

module.exports = SkillShare;
