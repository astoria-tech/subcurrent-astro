export interface Feed {
  url: string;
  authorName: string;
}

export const feeds: Feed[] = [
  {
    url: "https://www.ashryan.io/rss/",
    authorName: "Ash Ryan Arnwine",
  },
  {
    url: "https://jtbx.substack.com/feed",
    authorName: "Jawaun",
  },
  {
    url: "https://nfraprado.net/feeds/all.atom.xml",
    authorName: "Nicolas F. R. A. Prado",
  },
  {
    url: "https://theunderlying.substack.com/feed",
    authorName: "The Underlying",
  },
  {
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCjkzTpA7V8AfJS9UKLKFZxA",
    authorName: "meremortaldev",
  },
];
