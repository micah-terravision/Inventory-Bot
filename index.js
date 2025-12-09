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
       await say('Please specify an item. Example: `/inventory VT5`');
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
         await say(`No items found matching "${searchTerm}"`);
         return;
       }

       // Format results
       let message = `📦 *Inventory Results for "${searchTerm}"*\n\n`;
       
       response.results.forEach(page => {
         const props = page.properties;
         
         // Extract properties (adjust these to match YOUR database)
         const item = props.Item?.title[0]?.plain_text || 'N/A';
         const partNumber = props['Part Number']?.rich_text[0]?.plain_text || '';
         const category = props.Category?.select?.name || 'N/A';
         const startQty = props['Starting Quantity']?.number || 0;
         const currentStock = props['Current Stock']?.number || 0;
         
         message += `• *${item}*\n`;
         if (partNumber) message += `  Part #: ${partNumber}\n`;
         message += `  Category: ${category}\n`;
         message += `  Starting: ${startQty} | Current: ${currentStock}\n\n`;
       });

       await say(message);

     } catch (error) {
       console.error('Error:', error);
       await say('Sorry, there was an error querying the inventory.');
     }
   });

   // Start bot
   (async () => {
     await app.start();
     console.log('⚡️ Inventory bot is running!');
   })();
