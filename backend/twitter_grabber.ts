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
    const res = await axios.get(`https://api.vxtwitter.com/Twitter/status/${tweetId}`);
    const data = res.data;
    
    const text = data.text || '';
    const imageUrls: string[] = data.mediaURLs || [];
    
    return {
      text,
      imageUrls,
      user: {
        name: data.user_name,
        handle: data.user_screen_name,
        profileImage: data.user_profile_image_url
      }
    };
  } catch (error: any) {
    console.error("Failed to fetch tweet:", error.message);
    if (error.response?.status === 404) {
      throw new Error("Tweet not found - it may have been deleted.");
    }
    throw new Error("Could not fetch tweet data. Ensure the URL is correct and the tweet is public.");
  }
}
