const { App } = require('@slack/bolt');
const { Client } = require('@notionhq/client');

require('dotenv').config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

app.command('/inventory', async ({ command, ack, say }) => {
  await ack();
  
  const searchTerm = command.text.trim();
  
  if (!searchTerm) {
    await say('Please specify an item. Example: `/inventory VT5` or `/inventory RUT956700600`');
    return;
  }

  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        or: [
          {
            property: 'Item',
            title: {
              contains: searchTerm
            }
          },
          {
            property: 'Part Number',
            rich_text: {
              contains: searchTerm
            }
          }
        ]
      }
    });

    if (response.results.length === 0) {
      await say(`❌ No items found matching "${searchTerm}"`);
      return;
    }

    console.log('Full Notion Response:', JSON.stringify(response.results[0].properties, null, 2));

    let message = `📦 *Inventory Results for "${searchTerm}"*\n`;
    message += `Found ${response.results.length} item(s):\n\n`;
    
    response.results.forEach((page, index) => {
      const props = page.properties;
      
      const item = props.Item?.title[0]?.plain_text || 'N/A';
      const partNumber = props['Part Number']?.rich_text[0]?.plain_text || '';
      const category = props.Category?.select?.name || '';
      const startingQty = props['Starting Quantity']?.number;
      
      const currentStock = 
        props['Current Stock']?.number ||
        props['Current Stock']?.formula?.number ||
        props['Current Stock']?.rollup?.number;
      
      const movementTotal = props['Movement Total']?.number;
      
      message += `${index + 1}. *${item}*\n`;
      if (partNumber) {
        message += `   📋 Part #: ${partNumber}\n`;
      }
      if (category) {
        message += `   🏷️  Category: ${category}\n`;
      }
      if (startingQty !== undefined && startingQty !== null) {
        message += `   📊 Starting Quantity: ${startingQty}\n`;
      }
      if (movementTotal !== undefined && movementTotal !== null) {
        message += `   📈 Movement Total: ${movementTotal > 0 ? '+' : ''}${movementTotal}\n`;
      }
      if (currentStock !== undefined && currentStock !== null) {
        message += `   ✅ *Current Stock: ${currentStock} units*\n`;
      } else {
        message += `   ⚠️  Current Stock: Not available\n`;
      }
      
      message += `\n`;
    });

    await say(message);

  } catch (error) {
    console.error('Error querying Notion:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    await say('❌ Sorry, there was an error querying the inventory database. Please check the logs.');
  }
});

(async () => {
  await app.start();
  console.log('⚡️ Inventory bot is running!');
})();
