const axios = require('axios');
const { Client } = require('@notionhq/client');
const { WebClient } = require('@slack/web-api');
require('dotenv').config();  // Load environment variables from .env file

// Environment variables
const NYT_API_KEY = process.env.NYT_API_KEY;
const SLACK_TOKEN = process.env.SLACK_TOKEN;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL;
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.DATABASE_ID;

// Initialize Slack WebClient
const slackClient = new WebClient(SLACK_TOKEN);

// Initialize Notion Client with increased timeout
const notion = new Client({
  auth: NOTION_TOKEN,
  timeoutMs: 60000,  // Increase timeout to 60 seconds
});

// Function to fetch all NYT Best Sellers lists
async function getAllNytBestSellers() {
  const url = `https://api.nytimes.com/svc/books/v3/lists/full-overview.json`;
  const params = { 'api-key': NYT_API_KEY };
  try {
    const response = await axios.get(url, { params });
    const lists = response.data.results.lists;
    const allBooks = lists.flatMap(list => list.books.map(book => ({
      listName: list.list_name,
      title: book.title,
      author: book.author
    })));
    console.log(`Fetched ${allBooks.length} books from NYT Best Sellers`);
    return allBooks;
  } catch (error) {
    console.error('Error fetching NYT Best Sellers:', error);
    return [];
  }
}

// Function to fetch all pages of Notion Books
async function getAllNotionBooks() {
  let books = [];
  let hasMore = true;
  let startCursor = undefined;

  while (hasMore) {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      start_cursor: startCursor,
    });

    const results = response.results.map(result => {
      const titleProperty = "Book Title"; // Fixed title property name
      const authorProperty = "AUTHORS"; // Fixed author property name

      const title = result.properties[titleProperty]?.title?.[0]?.text?.content || "Unknown Title";
      const author = result.properties[authorProperty]?.rich_text?.map(text => text.plain_text).join(', ') || "Unknown Author";

      return { title, author };
    });

    books = books.concat(results);
    hasMore = response.has_more;
    startCursor = response.next_cursor;
  }

  console.log(`Fetched ${books.length} books from Notion`);
  return books;
}

// Function to extract substring up to the first colon
function extractTitleSubstring(title) {
  const colonIndex = title.indexOf(':');
  if (colonIndex !== -1) {
    return title.substring(0, colonIndex).trim();
  }
  return title;
}

// Function to find matching books with case-insensitive comparison
function findMatchingBooks(nytBooks, notionBooks) {
  const matchingBooks = [];
  nytBooks.forEach(nytBook => {
    notionBooks.forEach(notionBook => {
      const notionTitleSubstring = extractTitleSubstring(notionBook.title).toLowerCase();
      const nytBookTitle = nytBook.title.toLowerCase();

      // Debugging information
      console.log(`Comparing NYT title: "${nytBook.title}" with Notion title part: "${notionTitleSubstring}"`);

      if (notionTitleSubstring === nytBookTitle) {
        matchingBooks.push({
          title: nytBook.title,
          author: nytBook.author,
          listName: nytBook.listName
        });
        console.log(`Matched: "${notionBook.title}" with "${nytBook.title}"`);
      } else {
        console.log(`Not matched: "${notionBook.title}" with "${nytBook.title}"`);
      }
    });
  });
  return matchingBooks;
}

// Function to send message to Slack
async function sendToSlack(message) {
  try {
    await slackClient.chat.postMessage({
      channel: SLACK_CHANNEL,
      text: message,
    });
  } catch (error) {
    console.error('Error sending message to Slack:', error);
  }
}

// Main function to log and send matching books for all lists
(async function() {
  const nytBooks = await getAllNytBestSellers();
  console.log("NYT Best Seller Books:", JSON.stringify(nytBooks, null, 2));  // Log NYT Best Seller books to console
  
  const notionBooks = await getAllNotionBooks();
  console.log("Notion Books:", JSON.stringify(notionBooks, null, 2));  // Log Notion books to console

  if (nytBooks.length > 0 && notionBooks.length > 0) {
    let matchingBooks = findMatchingBooks(nytBooks, notionBooks);
    
    // Sort matching books alphabetically by title
    matchingBooks = matchingBooks.sort((a, b) => a.title.localeCompare(b.title));

    let message;
    if (matchingBooks.length > 0) {
      message = "Books on the NYT Best Seller lists also in Notion:\n";
      matchingBooks.forEach(book => {
        message += `*Title:* ${book.title}, *Author:* ${book.author} (List: ${book.listName})\n`;
      });
    } else {
      message = "No matching books found between the NYT Best Seller lists and Notion database.";
    }
    console.log(message);  // Log to console
    await sendToSlack(message);  // Send to Slack
  } else {
    console.log("No books found in either NYT Best Sellers or Notion database.");
  }
})();
