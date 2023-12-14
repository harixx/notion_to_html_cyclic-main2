const express = require('express');
const app = express();
const axios = require('axios');

// Replace 'YOUR_NOTION_API_KEY' and 'YOUR_DATABASE_ID' with your actual Notion API key and database ID
// const NOTION_API_KEY = 'secret_NFRU7c0DdzRRpHLyp2WYiE3szWplbDegp9FVRyLlSvY'; // Sadeed's key
const NOTION_API_KEY = 'secret_BxuXuKSNl1bPvQhgcZOUdAZUv73yXvIgy1y2Ur7QAy4';
// const DATABASE_ID = '5f170183a8da48bea66032fa5f0c6d19'; // Sadeed's database
const DATABASE_ID = '58e22306a3a04f6696621867f18c365b';

const NOTION_API_URL = `https://api.notion.com/v1/databases/${DATABASE_ID}/query`;

const headers = {
    'Authorization': `Bearer ${NOTION_API_KEY}`,
    'Notion-Version': '2022-06-28',
};

async function fetchNotionData() {
    try {
        const response = await axios.post(NOTION_API_URL, {}, { headers });
        return response.data.results;
    } catch (error) {
        throw new Error(`Error fetching Notion data: ${error.message}`);
    }
}

async function getPageHTMLContent(pageId) {
    const PAGE_API_URL = `https://api.notion.com/v1/pages/${pageId}`;
    try {
        const response = await axios.get(PAGE_API_URL, { headers });
        return response.data?.html || 'No HTML content available';
    } catch (error) {
        throw new Error(`Error fetching HTML content for page ${pageId}: ${error.message}`);
    }
}


async function getBlock(pageId) {
    const BLOCK_API_URL = `https://api.notion.com/v1/blocks/${pageId}/children`;
    try {
        const response = await axios.get(BLOCK_API_URL, { headers });
        // console.log('\n************ BLOCK CONTENT ************\n')
        const children = response.data.results;
        let content = ''
        children.map(child => {
            const type = child.type;
            const text = child[type].rich_text;
            // parse text depending on type and then append to content
            // check if type contains heading
            if (type.includes('heading')) {
                const headingLevel = type.replace('heading_', '');
                const headingText = text.map(textObj => textObj.text.content).join('');
                const headingHTML = `<h${headingLevel}>${headingText}</h${headingLevel}>`
                content += headingHTML;
            }
            else if (type.includes('paragraph')) {
                const paragraphText = text.map(textObj => textObj.text.content).join('');
                const paragraphHTML = `<p>${paragraphText}</p>`
                content += paragraphHTML;
            }
            else if (type.includes('bulleted_list_item')) {
                const bulletText = text.map(textObj => textObj.text.content).join('');
                const bulletHTML = `<li>${bulletText}</li>`
                content += bulletHTML;
            }
            else if (type.includes('numbered_list_item')) {
                const numberText = text.map(textObj => textObj.text.content).join('');
                const numberHTML = `<li>${numberText}</li>`
                content += numberHTML;
            }
            else if (type.includes('to_do')) {
                const todoText = text.map(textObj => textObj.text.content).join('');
                const todoHTML = `<li>${todoText}</li>`
                content += todoHTML;
            }
            else if (type.includes('toggle')) {
                const toggleText = text.map(textObj => textObj.text.content).join('');
                const toggleHTML = `<li>${toggleText}</li>`
                content += toggleHTML;
            }
            else if (type.includes('image')){
                const imageType = child[type].type;
                const imageSource = imageType === 'external' ? child[type].external.url : child[type].file.url;
                const imageHTML = `<img src="${imageSource}">`
                content += imageHTML;
            }
            else {
                console.log(child)
            }
        });
        // console.log(content)
        // console.log('\n************ BLOCK CONTENT ************\n')
        // return the content
        return content;
    } catch (error) {
        throw new Error(`Error fetching HTML content for page ${pageId}: ${error.message}`);
    }
}


function extractTextFromRichText(properties) {
    const richTextProperties = properties['Description']?.rich_text || properties['Description']?.children || properties['AI summary']?.rich_text || [];

    if (richTextProperties.length > 0) {
        const plainText = richTextProperties.map(textObj => textObj.text.content).join('');
        const htmlContent = richTextProperties.map(textObj => {
            const text = textObj.text.content;
            const isBold = textObj.annotations?.bold || false;
            const formattedText = isBold ? `<b>${text}</b>` : text;
            return formattedText;
        }).join('');

        return { plainText, htmlContent };
    }

    return { plainText: 'No content available', htmlContent: 'No content available' };
}

app.get('/', async (req, res) => {
    try {
        const notionItems = await fetchNotionData();

        const formattedData = await Promise.all(notionItems.map(async (item) => {
            const id = item.id;
            const createdTime = item.created_time;
            const lastEditedTime = item.last_edited_time;
            const iconType = item.icon?.type || 'No icon type';
            const iconEmoji = item.icon?.emoji || 'No icon emoji';
            const coverType = item.cover?.type || 'No cover type';
            const coverExternal = item.cover?.external || 'No cover external';
            const parentType = item.parent?.type || 'No parent type';
            const parentWorkspace = item.parent?.workspace || 'No parent workspace';
            const parentPageID = item.parent?.page_id || 'No parent page ID';
            const parentDatabaseID = item.parent?.database_id || 'No parent database ID';
            const isArchived = item.archived;
            const properties = item.properties;

            const title = properties.Name.title[0]?.plain_text || 'No title'; // Access the title property

            const { plainText, htmlContent } = extractTextFromRichText(properties);

            // Fix: Use the correct page ID (item.id) instead of parentPageID
            const pageHTML = await getPageHTMLContent(id);

            let blockHTML = await getBlock(id);
            // console.log(blockHTML);

            return {
                id,
                createdTime,
                lastEditedTime,
                iconType,
                iconEmoji,
                coverType,
                coverExternal,
                parentType,
                parentWorkspace,
                parentPageID,
                parentDatabaseID,
                isArchived,
                title,
                properties,
                richTextContent: { plainText, htmlContent, blockHTML },
                pageHTML,
            };
        }));

        res.json(formattedData); // Send the formatted data as JSON to the browser
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});