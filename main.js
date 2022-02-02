//importing onclick func
import { onClick } from "./onClick.js";

const userInput = document.querySelector("#user-input");
const searchSection = document.querySelector(".search");
const searchResult = document.querySelector(".search-result");
const notificationSection = document.querySelector(".notification");

/*
 * Parse data and display them in searchResult
 */
const showResult = (data) => {
  console.log(data);
  // onClick();
  if (data.total === 0) {
    showNotification("Try another one or you can write it )))");
  } else {
    searchSection.classList.add("search-top");
    searchResult.style.display = "block";
  }
  data.data.forEach((lyrics) => {
    console.log(lyrics.id);
    searchResult.innerHTML += `
            <div class="lyrics">
                <div class="about">
                    <div class="singer">${lyrics.artist.name}</div>
                    -
                    <p class="title">${lyrics.title}</p>
                </div>
                <audio controls>
                    <source src="${lyrics.preview}" type="audio/mpeg">
                </audio>
                <button id=${lyrics.id} class="get-lyrics">Get Lyrics</button>
            </div>
        `;
  });
};

const showNotification = (msg) => {
  notificationSection.innerText = msg;
  notificationSection.style.display = "block";
  setTimeout(() => {
    notificationSection.style.display = "none";
  }, 5000);
};

/*
 * This code listens when user hit Enter key on search field.
 * When it happens, code goes and takes data from API according to user's input.
 * We get them as an object, that consists of 3 attributes:
 * 1. data: -> an array of objects. max 15;
 * 2. next: -> URL for the next portion of list if there are more then 15 items.
 * 3. total: -> total number of found items.
 */
userInput.addEventListener("keyup", (event) => {
  if (event.keyCode === 13) {
    // << Enter key pressed!
    let searchStr = new String();
    if (userInput.value === "") {
      searchStr = "without lyrics";
      showNotification("Without lyrics? Nice choice!");
    } else {
      searchStr = userInput.value;
    }

    fetch(`https://api.lyrics.ovh/suggest/${searchStr}`)
      .then((response) => response.json())
      .then((data) => {
        showResult(data);
        //adding eventlistener for button
        const btn = document.querySelectorAll(".get-lyrics");
        btn.forEach((item) =>
          item.addEventListener("click", () => onClick(data.data, item.id))
        );
      });
  }
});
