// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { dialog } = require("electron").remote;
const SkillShare = require("./lib/skillshare");
const data = require("./data");

window.addEventListener("DOMContentLoaded", () => {
  let formSubmission = document.querySelector("form");
  formSubmission.addEventListener("submit", async e => {
    e.preventDefault();

    let sk_url = document.querySelector("#courseUrl").value;
    try {
      let dirPath = await dialog.showOpenDialog({
        properties: ["openDirectory"]
      });
      if (dirPath) {
        setTimeout(() => {
          document.querySelector("#submit_btn").disabled = true;
          document.querySelector("em").style.display = "block";
          const skshare = new SkillShare(
            data.cookie,
            dirPath.filePaths[0],
            data.pk,
            data.account_id
          );

          skshare.downloadByUrl(sk_url);
        }, 2000);
      }
    } catch (err) {
      console.error(err);
    }
  });

  // skshare.downloadByUrl(
  //   "https://www.skillshare.com/classes/Pricing-Your-Work-and-Negotiating-with-Clients/1526419742?via=browse-featured"
  // );
});
