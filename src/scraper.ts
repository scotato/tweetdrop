import * as fs from "fs"; // Filesystem
import { logger } from "./logger"; // Logging
import { providers } from "ethers"; // RPC for ENS names
import Twitter from "twitter";

// Regex matches for addresses and ENS names
const addressRegex: RegExp = /(0x[a-zA-Z0-9])\w+/;
const ENSRegex: RegExp = /([a-zA-Z0-9]\w+.(eth|ETH))/;
export default class Scraper {
  // Optional RPC to resolve ENS names to addresses
  rpc?: providers.JsonRpcProvider | null;
  // Tweet conversation ID
  conversationID: string;
  // Twitter tokens
  twitterBearer: string;
  twitterConsumerKey: string;
  twitterConsumerSecret: string;
  twitterAccessTokenKey: string;
  twitterAccessTokenSecret: string;
  twitterEndpoint: string;
  twitterQuery: string;
  client: Twitter;
  // Number of tokens to distribute per address
  numTokens: number;

  // Collected tweets from Twitter API
  tweets: { id: string; text: string }[] = [];
  // Cleaned addresses from tweets
  addresses: string[] = [];

  /**
   * Setup scraper
   * @param {string} conversationID to scrape
   * @param {string} twitterBearer 2.0 token
   * @param {string} twitterConsumerKey
   * @param {string} twitterConsumerSecret
   * @param {string} twitterAccessTokenKey
   * @param {string} twitterAccessTokenSecret
   * @param {string} twitterEndpoint
   * @param {string} twitterQuery
   * @param {number} numTokens to distribute per address
   * @param {string?} rpcProvider optional rpc endpoint to convert ENS names
   */
  constructor(
    conversationID: string,
    twitterBearer: string,
    twitterConsumerKey: string,
    twitterConsumerSecret: string,
    twitterAccessTokenKey: string,
    twitterAccessTokenSecret: string,
    twitterEndpoint: string,
    twitterQuery: string,
    numTokens: number,
    rpcProvider?: string
  ) {
    this.conversationID = conversationID;
    this.twitterBearer = twitterBearer;
    this.twitterConsumerKey = twitterConsumerKey;
    this.twitterConsumerSecret = twitterConsumerSecret;
    this.twitterAccessTokenKey = twitterAccessTokenKey;
    this.twitterAccessTokenSecret = twitterAccessTokenSecret;
    this.twitterEndpoint = twitterEndpoint;
    this.twitterQuery = twitterQuery;
    this.numTokens = numTokens;

    this.client = new Twitter({
      consumer_key: twitterConsumerKey,
      consumer_secret: twitterConsumerSecret,
      access_token_key: twitterAccessTokenKey,
      access_token_secret: twitterAccessTokenSecret
    });

    if (rpcProvider) {
      this.rpc = new providers.JsonRpcProvider(rpcProvider);
    }
  }

  /**
   * Recursively collect tweets from a thread (max. 100 per run)
   * @param {string?} nextSearchToken optional pagination token
   */
  async collectTweets(next?: string): Promise<void> {
    const get = new Promise((resolve, reject) => {
      this.client.get(
        this.twitterEndpoint,
        { query: this.twitterQuery, next },
        function (error, tweets, response) {
          resolve(tweets);
        }
      );
    });

    await get.then(async (tweets) => {
      // @ts-ignore
      this.tweets.push(...tweets.results);
      // @ts-ignore
      logger.info(`Collected ${tweets.results.length} tweets`);

      // @ts-ignore
      if (tweets.next) await this.collectTweets(tweets.next);
    });
  }

  /**
   * Cleans individual tweets, filtering for addresses
   */
  cleanTweetsForAddresses(): void {
    for (const tweet of this.tweets) {
      // Remove line-breaks, etc.
      const cleanedText: string = tweet.text.replace(/(\r\n|\n|\r)/gm, "");

      const foundAddress: RegExpMatchArray | null =
        cleanedText.match(addressRegex);
      const foundENS: RegExpMatchArray | null = cleanedText.match(ENSRegex);

      for (const foundArrs of [foundAddress, foundENS]) {
        // If match in tweet
        if (foundArrs && foundArrs.length > 0) {
          // If type(address)
          const addr: string = foundArrs[0].startsWith("0x")
            ? // Quick cleaning to only grab first 42 characters
              foundArrs[0].substring(0, 42)
            : foundArrs[0];

          // Push address or ENS name
          this.addresses.push(addr);
        }
      }
    }
  }

  /**
   * Convert ENS names to addresses
   */
  async convertENS(): Promise<void> {
    let convertedAddresses: string[] = [];

    for (let i = 0; i < this.addresses.length; i++) {
      // Force lowercase (to avoid .ETH, .eth, .eTh matching)
      const address: string = this.addresses[i].toLowerCase();

      // If ENS name
      if (address.includes(".eth")) {
        // Resolve name via RPC
        const parsed: string | null | undefined = await this.rpc?.resolveName(
          address
        );
        if (parsed) {
          // If successful resolve, push name
          convertedAddresses.push(parsed);
        }
      } else {
        // Else, push just address
        convertedAddresses.push(address);
      }
    }

    this.addresses = convertedAddresses;
  }

  /**
   * Outputs batched, copyable addresses to /output directory
   * Effects: Modifies filesystem, adds output directory and text files
   */
  outputAddresses(): void {
    // Create /output folder if it doesnt exist
    const outputDir: string = "./output";
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    for (let i = 0; i < this.addresses.length; i++) {
      // Batch file numbers by 100
      const fileNumber: number = Math.floor(i / 100);

      fs.appendFileSync(
        // Append to file-1...(numAddresses/100)
        `${outputDir}/batch-${fileNumber}.txt`,
        // "address, tokenAmount" per line
        `${this.addresses[i]}, ${this.numTokens}\n`
      );
    }
  }

  /**
   * Scrape tweets, find addresses, output batch copyable disperse files
   */
  async scrape() {
    // Collect all tweets from thread
    await this.collectTweets();
    logger.info(`Collected ${this.tweets.length} total tweets`);

    // Clean tweets, finding addresses and ENS names
    await this.cleanTweetsForAddresses();
    logger.info(`Collected ${this.addresses.length} addresses from tweets`);

    // If RPC provided
    if (this.rpc) {
      // Resolve ENS names to addresses
      await this.convertENS();
      logger.info("Converted ENS names to addresses");
    }

    // Output addresses to filesystem
    await this.outputAddresses();
    logger.info("Outputted addresses in 100-address batches to /output");
  }
}
