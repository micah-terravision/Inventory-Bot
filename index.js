const { App } = require('@slack/bolt');
const { Client } = require('@notionhq/client');

require('dotenv').config();

// Initialize apps
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

// Handle /inventory command
app.command('/inventory', async ({ command, ack, say }) => {
  await ack();
  
  const searchTerm = command.text.trim();
  
  if (!searchTerm) {
    await say('Please specify an item. Example: `/inventory VT5` or `/inventory RUT956700600`');
    return;
  }

  try {
    // Query Notion database
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

    // Format results
    let message = `📦 *Inventory Results for "${searchTerm}"*\n`;
    message += `Found ${response.results.length} item(s):\n\n`;
    
    response.results.forEach((page, index) => {
      const props = page.properties;
      
      // Extract properties matching your exact database structure
      const item = props.Item?.title[0]?.plain_text || 'N/A';
      const partNumber = props['Part Number']?.rich_text[0]?.plain_text || '';
      const category = props.Category?.select?.name || '';
      const startingQty = props['Starting Quantity']?.number;
      const currentStock = props['Current Stock']?.formula?.number;
      const movementTotal = props['Movement Total']?.number;
      
      message += `${index + 1}. *${item}*\n`;
      if (partNumber) {
        message += `   📋 Part #: ${partNumber}\n`;
      }
      if (category) {
        message += `   🏷️  Category: ${category}\n`;
      }
      if (startingQty !== undefined) {
        message += `   📊 Starting Quantity: ${startingQty}\n`;
      }
      if (movementTotal !== undefined) {
        message += `   📈 Movement Total: ${movementTotal > 0 ? '+' : ''}${movementTotal}\n`;
      }
      if (currentStock !== undefined) {
        message += `   ✅ *Current Stock: ${currentStock} units*\n`;
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

// Start bot
(async () => {
  await app.start();
  console.log('⚡️ Inventory bot is running!');
})();
```

## Key Changes:

1. **Current Stock** - I noticed "Current Stock" appears to be a **formula field** in Notion (it's calculated), so I'm accessing it as `props['Current Stock']?.formula?.number`
2. **All your columns** - Added support for:
   - Item (title field)
   - Part Number (rich text)
   - Category (select field)
   - Starting Quantity (number)
   - Movement Total (number)
   - Current Stock (formula)
3. **Better formatting** - Added emojis and clear labels

## Example Output in Slack:

When your boss types `/inventory VT5`, they'll see:
```
📦 Inventory Results for "VT5"
Found 2 item(s):

1. VT5 (Vehicle Tablet) - Second Hand
   🏷️  Category: 3R Tablets (MDT's)
   📊 Starting Quantity: 1
   📈 Movement Total: 0
   ✅ Current Stock: 1 units

2. VT5 (Vehicle Tablet)
   🏷️  Category: 3R Tablets (MDT's)
   📊 Starting Quantity: 8
   📈 Movement Total: -1
   ✅ Current Stock: 7 units
