import axios from 'axios';

export async function fetchTweetContent(tweetUrl: string) {
  // Extract tweet ID from url
  // e.g. https://twitter.com/user/status/1234567890 or https://x.com/user/status/1234567890
  const match = tweetUrl.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  if (!match) {
    throw new Error("Invalid Tweet URL - must be from twitter.com or x.com");
  }
  
  const tweetId = match[1];
  
  try {
    // Use the public syndication API which doesn't require auth
    const res = await axios.get(`https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en`);
    const data = res.data;
    
    const text = data.text || '';
    const imageUrls: string[] = [];
    
    // Extract images from various possible locations in the API response
    if (data.mediaDetails && Array.isArray(data.mediaDetails)) {
      for (const media of data.mediaDetails) {
        if (media.type === 'photo' && media.media_url_https) {
          // Use the largest available image (add :large suffix)
          imageUrls.push(media.media_url_https + ':large');
        }
      }
    }
    
    // Fallback: check for media in the entities field
    if (imageUrls.length === 0 && data.entities?.media) {
      for (const media of data.entities.media) {
        if (media.type === 'photo' && media.media_url_https) {
          imageUrls.push(media.media_url_https + ':large');
        }
      }
    }
    
    // Additional fallback: look for images in extended_entities
    if (imageUrls.length === 0 && data.extended_entities?.media) {
      for (const media of data.extended_entities.media) {
        if (media.type === 'photo' && media.media_url_https) {
          imageUrls.push(media.media_url_https + ':large');
        }
      }
    }
    
    // Debug logging
    if (imageUrls.length === 0) {
      console.warn(`No images found in tweet ${tweetId}. API response structure:`, {
        hasMediaDetails: !!data.mediaDetails,
        hasEntitiesMedia: !!data.entities?.media,
        hasExtendedEntities: !!data.extended_entities?.media,
        keys: Object.keys(data)
      });
    }
    
    return {
      text,
      imageUrls
    };
  } catch (error: any) {
    console.error("Failed to fetch tweet:", error.message);
    if (error.response?.status === 404) {
      throw new Error("Tweet not found - it may have been deleted.");
    }
    throw new Error("Could not fetch tweet data. Ensure the URL is correct and the tweet is public.");
  }
}
