const btn = document.querySelector(".get-lyrics");

export function onClick(data, id) {
  console.log(data);
  const song = data.filter((el) => el.id === Number(id));
  console.log(song[0].artist);
}
