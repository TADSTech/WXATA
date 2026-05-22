import axios from 'axios';

export async function fetchTweetContent(tweetUrl: string) {
  // Extract tweet ID from url
  // e.g. https://twitter.com/user/status/1234567890
  const match = tweetUrl.match(/status\/(\d+)/);
  if (!match) {
    throw new Error("Invalid Tweet URL");
  }
  
  const tweetId = match[1];
  
  try {
    // We use the public syndication API which doesn't require auth
    const res = await axios.get(`https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}`);
    const data = res.data;
    
    const text = data.text;
    const imageUrls: string[] = [];
    
    if (data.mediaDetails) {
      for (const media of data.mediaDetails) {
        if (media.type === 'photo') {
          imageUrls.push(media.media_url_https);
        }
      }
    }
    
    return {
      text,
      imageUrls
    };
  } catch (error) {
    console.error("Failed to fetch tweet:", error);
    throw new Error("Could not fetch tweet data. It might be deleted or private.");
  }
}
