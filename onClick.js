const btn = document.querySelector(".get-lyrics");

export function onClick(data, id) {
  console.log(data);
  // console.log(id);
  const song = data.filter((el) => el.id === Number(id));
  //   for (let el of data) {
  //     if (el.id === Number(id)) {
  //       console.log(el);
  //     }
  //   }
  console.log(song[0].artist);
}
