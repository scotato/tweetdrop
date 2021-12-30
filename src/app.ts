import Scraper from "./scraper"; // Scraper
import * as dotenv from "dotenv"; // Env vars
import { logger } from "./logger"; // Logging

// Setup env
dotenv.config();

(async () => {
  // Collect environment variables
  const conversationID: string | undefined = process.env.CONVERSATION_ID;
  const twitterBearer: string | undefined = process.env.TWITTER_BEARER;
  const numTokens: number = Number(process.env.NUM_TOKENS) ?? 0;
  const rpcProvider: string | undefined = process.env.RPC_PROVIDER;
  const twitterConsumerKey: string | undefined =
    process.env.TWITTER_CONSUMER_KEY;
  const twitterConsumerSecret: string | undefined =
    process.env.TWITTER_CONSUMER_SECRET;
  const twitterAccessTokenKey: string | undefined =
    process.env.TWITTER_ACCESS_TOKEN_KEY;
  const twitterAccessTokenSecret: string | undefined =
    process.env.TWITTER_ACCESS_TOKEN_SECRET;
  const twitterEndpoint: string | undefined = process.env.TWITTER_ENDPOINT;
  const twitterQuery: string | undefined = process.env.TWITTER_QUERY;

  // If no conversation id or twitter token provided
  if (
    !conversationID ||
    !twitterBearer ||
    !twitterConsumerKey ||
    !twitterConsumerSecret ||
    !twitterAccessTokenKey ||
    !twitterAccessTokenSecret ||
    !twitterEndpoint ||
    !twitterQuery
  ) {
    // Throw error and exit
    logger.error("Missing required parameters, update .env");
    process.exit(1);
  }

  // Scrape tweets for addresses
  const scraper = new Scraper(
    conversationID,
    twitterBearer,
    twitterConsumerKey,
    twitterConsumerSecret,
    twitterAccessTokenKey,
    twitterAccessTokenSecret,
    twitterEndpoint,
    twitterQuery,
    numTokens,
    rpcProvider
  );
  await scraper.scrape();
})();
