const userInput = document.querySelector("#user-input");
const searchSection = document.querySelector(".search");
const searchResult = document.querySelector(".search-result");
const notificationSection = document.querySelector(".notification");
const nextButton = document.querySelector("#next");
const prevButton = document.querySelector("#prev");
const navButtons = document.querySelectorAll("#next,#prev")
const body = document.querySelector("body");
const video = document.querySelector("#video-wrapper");

/*
 * Parse data and display them in searchResult
 */
const showResult = (data) => {
  if (data.total === 0) {
    showNotification("Try another one or you can write your own song )))");
    nextButton.className = "notVisible";
    prevButton.className = "notVisible";
  } else {
    searchSection.classList.add("search-top");
    searchResult.style.display = "block";
    video.classList.remove("video")
    video.classList.add("video-result")
  }

  searchResult.innerHTML = "";
  searchResult.style.backgroundImage = "";

  data.data.forEach((lyrics) => {
    searchResult.innerHTML += `
            <div class="lyrics">
                <div>
                  <img src=${lyrics.album.cover} alt="cover">
                  <div class="singer">${lyrics.artist.name}</div>
                </div>
                <div class="about">
                    <p class="title">${lyrics.title}</p>
                    <audio controls>
                        <source src="${lyrics.preview}" type="audio/mpeg">
                    </audio>
                </div>
                <button class="get-lyrics" data-bg="${lyrics.album.cover_xl}" data-sourse="${lyrics.preview}"  data-artist="${lyrics.artist.name}" data-songtitle="${lyrics.title}" >Get Lyrics</button>
            </div>
        `;
  });

  if(data.next) {
    nextButton.classList.remove("notVisible");
    nextButton.setAttribute("data-url", data.next);
  } else {
    nextButton.className = "notVisible";
  }
  if (data.prev) {
    prevButton.classList.remove("notVisible");
    prevButton.setAttribute("data-url", data.prev);
  } else {
    prevButton.className = "notVisible";
  }
};

searchResult.addEventListener("click", (event) => {
  const targetElement = event.target;

  if (targetElement.tagName === "BUTTON") {
    searchResult.innerHTML = "";
    const artist = targetElement.getAttribute("data-artist");
    const title = targetElement.getAttribute("data-songtitle");
    const audioSrc = targetElement.getAttribute("data-sourse");
    const imgSrc = targetElement.getAttribute("data-bg");
    nextButton.classList.add("notVisible");
    prevButton.classList.add("notVisible");


    fetch(`https://api.lyrics.ovh/v1/${artist}/${title}`)
      .then((response) => response.json())
      .then((data) => {
        if(data.lyrics == undefined){
          showNotification('Lyrics does not exist. Try another one...')
        }else{
          searchResult.style.backgroundImage = `url('${imgSrc}')`
          const lyrics = data.lyrics.replace(/(\r\n|\r|\n)/g ,'<br>');

          searchResult.innerHTML = `
                  <h1 class="lyricsfont"><strong>${artist}</strong> - ${title}</h1>
                  <audio controls>
                        <source src="${audioSrc}" type="audio/mpeg">
                  </audio>
                  <p class="lyricsfont">${lyrics}</p>`;
        }
    });
  }
});

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

    const urrl = `http://api.deezer.com/search?limit=8&q=${searchStr}`
    doCORSRequest(urrl);
  } else if (event.key === "Backspace" && userInput.value === "") {
    searchResult.innerHTML = "";
  }
});


/*
 * CORS request error handler.
 * refer to: https://github.com/Rob--W/cors-anywhere
 */
function doCORSRequest(appUrl) {
  const cors_api_url = 'https://cors-anywhere.herokuapp.com/';
  let nUrl = cors_api_url + appUrl;
  fetch(nUrl)
    .then(response => {
      if(response.status !== 200) {
        showNotification("Error :( try later.")
        return;
      }
      response.json()
        .then(data => showResult(data))
    })
}

/*
 * next, prev buttons event listeners
 */
navButtons.forEach(
  btn => btn.addEventListener("click",(event) => {
    const nextUrl = event.target.dataset.url;
    event.preventDefault();
    doCORSRequest(nextUrl)
  })
)
